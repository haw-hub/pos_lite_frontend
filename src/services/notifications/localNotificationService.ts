import Constants from 'expo-constants';
import { Platform } from 'react-native';

type ExpoNotifications = typeof import('expo-notifications');

const isAndroidExpoGo = () =>
  Platform.OS === 'android' && Constants.appOwnership === 'expo';

let notificationsModule: ExpoNotifications | null | undefined;

const getNotifications = async (): Promise<ExpoNotifications | null> => {
  if (isAndroidExpoGo()) {
    return null;
  }
  if (notificationsModule !== undefined) {
    return notificationsModule;
  }
  try {
    notificationsModule = await import('expo-notifications');
    return notificationsModule;
  } catch (error) {
    console.log('Notifications unavailable in this runtime:', error);
    notificationsModule = null;
    return null;
  }
};

export const localNotificationService = {
  configureHandler: async (): Promise<void> => {
    const Notifications = await getNotifications();
    if (!Notifications) return;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  },

  configureInventoryChannel: async (): Promise<void> => {
    const Notifications = await getNotifications();
    if (!Notifications || Platform.OS !== 'android') return;
    await Notifications.setNotificationChannelAsync('inventory-alerts', {
      name: 'Inventory alerts',
      importance: Notifications.AndroidImportance.HIGH,
    });
  },

  ensurePermission: async (request = false): Promise<boolean> => {
    const Notifications = await getNotifications();
    if (!Notifications) return false;
    const permission = await Notifications.getPermissionsAsync();
    if (permission.granted) return true;
    if (!request) return false;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  },

  scheduleNow: async (content: {
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }): Promise<void> => {
    const Notifications = await getNotifications();
    if (!Notifications) return;
    await Notifications.scheduleNotificationAsync({
      content,
      trigger: null,
    });
  },
};
