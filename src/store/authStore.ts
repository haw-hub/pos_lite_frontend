// src/store/authStore.ts
import { create } from 'zustand';
import { authApi, AuthResponse } from '../api/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { switchShopDatabase } from '../database/sqlite';
import { useProductStore } from './productStore';
import { useCartStore } from './cartStore';
import { syncService } from '../services/sync/syncService';
import { SubscriptionState, subscriptionService } from '../services/subscription/subscriptionService';

interface AuthState {
  user: AuthResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  subscriptionRequired: boolean;
  subscriptionState: SubscriptionState | null;
  loginError: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  verifySubscription: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  subscriptionRequired: false,
  subscriptionState: null,
  loginError: null,

  login: async (username: string, password: string) => {
    try {
      const response = await authApi.login({ username, password });
      const subscriptionState = await subscriptionService.cacheFromAuth(response);
      syncService.destroy();
      await switchShopDatabase(response.shopId, response.username);
      useProductStore.setState({ products: [], deletedProducts: [], isInitialized: false });
      useCartStore.getState().clearCart();
      set({
        user: response,
        isAuthenticated: true,
        subscriptionRequired: !subscriptionState.canUseApp,
        subscriptionState,
        loginError: null,
      });
      await syncService.init();
      syncService.forceSync().catch(() => undefined);
      return true;
    } catch (error: any) {
      console.error('Login failed:', error);
      const subscriptionExpired =
        error.response?.status === 402 || error.response?.data?.code === 'SUBSCRIPTION_REQUIRED';
      set({
        loginError: subscriptionExpired
          ? 'ဆိုင်၏ Free Trial သို့မဟုတ် Subscription သက်တမ်းကုန်သွားပါပြီ။ Super Admin ထံ ဆက်သွယ်ပြီး သက်တမ်းတိုးပါ။'
          : error.response?.data?.message || 'အသုံးပြုသူအမည် သို့မဟုတ် စကားဝှက် မှားယွင်းနေပါသည်။',
      });
      return false;
    }
  },

  logout: async () => {
    await authApi.logout();
    await subscriptionService.clear();
    syncService.destroy();
    await switchShopDatabase(null, null);
    useProductStore.setState({ products: [], deletedProducts: [], isInitialized: false });
    useCartStore.getState().clearCart();
    set({ user: null, isAuthenticated: false, subscriptionRequired: false, subscriptionState: null, loginError: null });
    await syncService.init();
  },

  checkAuth: async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const userData = await AsyncStorage.getItem('user_data');
      
      if (token && userData) {
        const user = JSON.parse(userData);
        if (!user.shopId) {
          await AsyncStorage.multiRemove(['auth_token', 'user_data']);
          await switchShopDatabase(null, null);
          set({ user: null, isAuthenticated: false, isLoading: false });
          return;
        }
        await switchShopDatabase(user.shopId, user.username);
        let subscriptionState: SubscriptionState;
        try {
          subscriptionState = await subscriptionService.verify();
        } catch (error: any) {
          if (error.response?.status === 401) {
            await switchShopDatabase(null, null);
            set({ user: null, isAuthenticated: false, isLoading: false, subscriptionState: null });
            return;
          }
          subscriptionState = await subscriptionService.evaluateOffline();
        }
        const hydratedUser = { ...user, enabledFeatures: subscriptionState.enabledFeatures ?? user.enabledFeatures ?? [] };
        await AsyncStorage.setItem('user_data', JSON.stringify(hydratedUser));
        set({
          user: hydratedUser,
          isAuthenticated: true,
          isLoading: false,
          subscriptionRequired: !subscriptionState.canUseApp,
          subscriptionState,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      set({ isLoading: false });
    }
  },

  verifySubscription: async () => {
    try {
      const subscriptionState = await subscriptionService.verify();
      let nextUser: AuthResponse | null = null;
      set(state => ({
        subscriptionState,
        subscriptionRequired: !subscriptionState.canUseApp,
        user: state.user
          ? (nextUser = { ...state.user, enabledFeatures: subscriptionState.enabledFeatures ?? state.user.enabledFeatures ?? [] })
          : state.user,
      }));
      if (nextUser) {
        await AsyncStorage.setItem('user_data', JSON.stringify(nextUser));
      }
      if (subscriptionState.canUseApp) {
        syncService.forceSync().catch(() => undefined);
      }
      return subscriptionState.canUseApp;
    } catch (error: any) {
      if (error.response?.status === 401) {
        set({ subscriptionRequired: false, subscriptionState: null });
        return false;
      }
      const subscriptionState = await subscriptionService.evaluateOffline();
      let nextUser: AuthResponse | null = null;
      set(state => ({
        subscriptionState,
        subscriptionRequired: !subscriptionState.canUseApp,
        user: state.user
          ? (nextUser = { ...state.user, enabledFeatures: subscriptionState.enabledFeatures ?? state.user.enabledFeatures ?? [] })
          : state.user,
      }));
      if (nextUser) {
        await AsyncStorage.setItem('user_data', JSON.stringify(nextUser));
      }
      return subscriptionState.canUseApp;
    }
  },
}));
