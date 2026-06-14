import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { ProductRepository } from '../../database/repositories/productRepository';

const accountKey = async (base: string) => {
  const userData = await AsyncStorage.getItem('user_data');
  const username = userData ? JSON.parse(userData).username : 'guest';
  return `${base}_${String(username).toLowerCase()}`;
};

export interface InventoryAlertSettings {
  enabled: boolean;
  expiryDays: number;
  lowStockCount: number;
}

export const DEFAULT_ALERT_SETTINGS: InventoryAlertSettings = {
  enabled: true,
  expiryDays: 3,
  lowStockCount: 10,
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const inventoryAlertService = {
  getSettings: async (): Promise<InventoryAlertSettings> => {
    const stored = await AsyncStorage.getItem(await accountKey('inventory_alert_settings'));
    return stored
      ? { ...DEFAULT_ALERT_SETTINGS, ...JSON.parse(stored) }
      : DEFAULT_ALERT_SETTINGS;
  },

  saveSettings: async (settings: InventoryAlertSettings): Promise<void> => {
    await AsyncStorage.setItem(
      await accountKey('inventory_alert_settings'),
      JSON.stringify(settings)
    );
  },

  initialize: async (): Promise<void> => {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('inventory-alerts', {
        name: 'Inventory alerts',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) {
      const requested = await Notifications.requestPermissionsAsync();
      if (!requested.granted) return;
    }
    await inventoryAlertService.checkAndNotify();
  },

  checkAndNotify: async (force = false): Promise<void> => {
    const settings = await inventoryAlertService.getSettings();
    if (!settings.enabled) return;
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return;

    const products = await ProductRepository.getAll();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiryProducts = products.filter(product => {
      if (!product.expiryDate) return false;
      const expiry = new Date(`${product.expiryDate}T00:00:00`);
      const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
      return daysLeft >= 0 && daysLeft <= settings.expiryDays;
    });
    const expiredProducts = products.filter(product => {
      if (!product.expiryDate) return false;
      return new Date(`${product.expiryDate}T23:59:59`).getTime() < Date.now();
    });
    const lowStockProducts = products.filter(
      product => product.stock <= settings.lowStockCount
    );
    const alertState = JSON.stringify({
      expiry: expiryProducts.map(product => product.id).sort(),
      expired: expiredProducts.map(product => product.id).sort(),
      lowStock: lowStockProducts.map(product => `${product.id}:${product.stock}`).sort(),
      expiryDays: settings.expiryDays,
      lowStockCount: settings.lowStockCount,
    });
    const lastAlertStateKey = await accountKey('inventory_alert_last_state');
    const previousState = await AsyncStorage.getItem(lastAlertStateKey);
    if (!force && previousState === alertState) return;

    if (expiryProducts.length + expiredProducts.length > 0) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'သက်တမ်းကုန်ဆုံးမှု သတိပေးချက်',
          body: `သက်တမ်းကုန်ပြီး ${expiredProducts.length} မျိုး၊ ${settings.expiryDays} ရက်အတွင်းကုန်မည့် ${expiryProducts.length} မျိုးရှိသည်။`,
          data: { screen: 'Inventory' },
        },
        trigger: null,
      });
    }

    if (lowStockProducts.length > 0) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Stock ကျန်နည်း သတိပေးချက်',
          body: `${settings.lowStockCount} ခုနှင့်အောက် ကျန်သော ပစ္စည်း ${lowStockProducts.length} မျိုးရှိသည်။`,
          data: { screen: 'Inventory' },
        },
        trigger: null,
      });
    }

    await AsyncStorage.setItem(lastAlertStateKey, alertState);
  },
};
