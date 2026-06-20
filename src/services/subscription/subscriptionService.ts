import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import apiClient from '../../api/client';
import { AuthResponse } from '../../api/auth';
import { localNotificationService } from '../notifications/localNotificationService';

export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED';

export interface SubscriptionState {
  status: SubscriptionStatus;
  trialEndsAt?: string;
  subscriptionEndsAt?: string;
  lastVerifiedAt: string;
  offlineGraceEndsAt: string;
  canUseApp: boolean;
  isOfflineGrace: boolean;
  enabledFeatures: string[];
}

const CACHE_KEY = 'subscription_state';
const ALERT_KEY = 'subscription_alert_state';
export const OFFLINE_GRACE_DAYS = 3;

const graceEnd = (verifiedAt: Date, entitlementEndsAt?: string) => {
  const graceTime = verifiedAt.getTime() + OFFLINE_GRACE_DAYS * 86400000;
  const entitlementTime = entitlementEndsAt ? new Date(entitlementEndsAt).getTime() : graceTime;
  return new Date(Math.min(graceTime, entitlementTime)).toISOString();
};

const expiryOf = (state: Pick<SubscriptionState, 'trialEndsAt' | 'subscriptionEndsAt'>) =>
  state.subscriptionEndsAt ?? state.trialEndsAt;

const remainingDays = (value?: string) => {
  if (!value) return 0;
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86400000);
};

export const subscriptionService = {
  cacheFromAuth: async (auth: AuthResponse): Promise<SubscriptionState> => {
    const verifiedAt = new Date();
    const state: SubscriptionState = {
      status: auth.subscriptionStatus,
      trialEndsAt: auth.trialEndsAt,
      subscriptionEndsAt: auth.subscriptionEndsAt,
      lastVerifiedAt: verifiedAt.toISOString(),
      offlineGraceEndsAt: graceEnd(verifiedAt, auth.subscriptionEndsAt ?? auth.trialEndsAt),
      canUseApp: auth.subscriptionStatus === 'TRIAL' || auth.subscriptionStatus === 'ACTIVE',
      isOfflineGrace: false,
      enabledFeatures: auth.enabledFeatures || [],
    };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(state));
    await subscriptionService.notifyIfNeeded(state);
    return state;
  },

  getCached: async (): Promise<SubscriptionState | null> => {
    const stored = await AsyncStorage.getItem(CACHE_KEY);
    return stored ? JSON.parse(stored) : null;
  },

  verify: async (): Promise<SubscriptionState> => {
    const network = await NetInfo.fetch();
    if (!network.isConnected) return subscriptionService.evaluateOffline();

    const response = await apiClient.get('/subscription/status');
    const verifiedAt = new Date(response.data.serverTime ?? Date.now());
    const state: SubscriptionState = {
      status: response.data.status,
      trialEndsAt: response.data.trialEndsAt,
      subscriptionEndsAt: response.data.subscriptionEndsAt,
      lastVerifiedAt: verifiedAt.toISOString(),
      offlineGraceEndsAt: graceEnd(verifiedAt, response.data.subscriptionEndsAt ?? response.data.trialEndsAt),
      canUseApp: Boolean(response.data.canUseApp),
      isOfflineGrace: false,
      enabledFeatures: response.data.enabledFeatures || [],
    };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(state));
    await subscriptionService.notifyIfNeeded(state);
    return state;
  },

  evaluateOffline: async (): Promise<SubscriptionState> => {
    const cached = await subscriptionService.getCached();
    if (!cached) {
      return {
        status: 'EXPIRED',
        lastVerifiedAt: '',
        offlineGraceEndsAt: '',
        canUseApp: false,
        isOfflineGrace: false,
        enabledFeatures: [],
      };
    }
    const graceValid = cached.canUseApp && new Date(cached.offlineGraceEndsAt).getTime() >= Date.now();
    return { ...cached, canUseApp: graceValid, isOfflineGrace: graceValid };
  },

  canSync: async (): Promise<boolean> => {
    const cached = await subscriptionService.getCached();
    return Boolean(cached?.canUseApp && !cached.isOfflineGrace);
  },

  daysRemaining: (state?: SubscriptionState | null) => remainingDays(state ? expiryOf(state) : undefined),

  notifyIfNeeded: async (state: SubscriptionState): Promise<void> => {
    if (!state.canUseApp) return;
    const days = remainingDays(expiryOf(state));
    const alertThreshold = days <= 1 ? 1 : days <= 3 ? 3 : days <= 7 ? 7 : null;
    if (alertThreshold === null || days < 0) return;
    const key = `${state.status}:${alertThreshold}:${expiryOf(state)}`;
    if (await AsyncStorage.getItem(ALERT_KEY) === key) return;

    const granted = await localNotificationService.ensurePermission();
    if (!granted) return;
    await localNotificationService.scheduleNow({
      title: 'POS အသုံးပြုခွင့် သက်တမ်းသတိပေးချက်',
      body: `သင့်ဆိုင်၏ ${state.status === 'TRIAL' ? 'Free Trial' : 'Subscription'} သက်တမ်း ${days} ရက်သာ ကျန်ပါတော့သည်။`,
      data: { screen: 'Settings' },
    });
    await AsyncStorage.setItem(ALERT_KEY, key);
  },

  blockFromServer: async (): Promise<SubscriptionState> => {
    const cached = await subscriptionService.getCached();
    const state: SubscriptionState = {
      status: cached?.status === 'SUSPENDED' ? 'SUSPENDED' : 'EXPIRED',
      trialEndsAt: cached?.trialEndsAt,
      subscriptionEndsAt: cached?.subscriptionEndsAt,
      lastVerifiedAt: new Date().toISOString(),
      offlineGraceEndsAt: cached?.offlineGraceEndsAt ?? '',
      canUseApp: false,
      isOfflineGrace: false,
      enabledFeatures: cached?.enabledFeatures || [],
    };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(state));
    return state;
  },

  clear: async () => {
    await AsyncStorage.multiRemove([CACHE_KEY, ALERT_KEY]);
  },
};
