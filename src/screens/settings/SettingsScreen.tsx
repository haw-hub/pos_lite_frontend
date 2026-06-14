import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../../config/theme';
import {
  DEFAULT_ALERT_SETTINGS,
  InventoryAlertSettings,
  inventoryAlertService,
} from '../../services/alerts/inventoryAlertService';
import { clearAllData, getCurrentDatabaseName } from '../../database/sqlite';
import { syncService } from '../../services/sync/syncService';
import { useAuthStore } from '../../store/authStore';
import { useCartStore } from '../../store/cartStore';
import { useProductStore } from '../../store/productStore';
import { moderateScale } from '../../utils/responsive';

export const SettingsScreen = () => {
  const [settings, setSettings] = useState<InventoryAlertSettings>(DEFAULT_ALERT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [clearingCache, setClearingCache] = useState(false);
  const user = useAuthStore(state => state.user);

  useEffect(() => {
    inventoryAlertService.getSettings().then(value => {
      setSettings(value);
      setLoading(false);
    });
  }, []);

  const updateNumber = (key: 'expiryDays' | 'lowStockCount', value: string) => {
    const number = Math.max(0, Number(value.replace(/\D/g, '')) || 0);
    setSettings(current => ({ ...current, [key]: number }));
  };

  const save = async () => {
    await inventoryAlertService.saveSettings(settings);
    await inventoryAlertService.checkAndNotify(true);
    Alert.alert('သိမ်းပြီးပါပြီ', 'Notification သတ်မှတ်ချက်များ ပြင်ဆင်ပြီးပါပြီ။');
  };

  const clearCurrentAccountCache = () => {
    Alert.alert(
      'Local data ပြန်စမည်',
      `${user?.username || 'လက်ရှိ'} account ၏ ဒီဖုန်းထဲရှိ local data ကိုသာရှင်းပြီး server မှ ပြန်ယူမည်။ Sync မတက်ရသေးသော offline data များ ပျောက်သွားနိုင်သည်။`,
      [
        { text: 'မလုပ်တော့ပါ', style: 'cancel' },
        {
          text: 'ရှင်းပြီး Sync လုပ်မည်',
          style: 'destructive',
          onPress: async () => {
            setClearingCache(true);
            syncService.destroy();

            try {
              await clearAllData();
              useProductStore.setState({ products: [], deletedProducts: [], isInitialized: false });
              useCartStore.getState().clearCart();

              await syncService.init();
              await syncService.forceSync();
              await useProductStore.getState().fetchProducts();

              Alert.alert('ပြီးပါပြီ', 'လက်ရှိ account ၏ local data ကို server မှ ပြန်ယူပြီးပါပြီ။');
            } catch (error) {
              console.error('Failed to reset current account local data:', error);
              await syncService.init().catch(() => undefined);
              Alert.alert('မအောင်မြင်ပါ', 'Internet connection နှင့် server ကိုစစ်ပြီး ထပ်မံကြိုးစားပါ။');
            } finally {
              setClearingCache(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator color={COLORS.primary} /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.titleRow}>
            <Ionicons name="notifications-outline" size={22} color={COLORS.primary} />
            <Text style={styles.title}>ပစ္စည်းသတိပေးချက်</Text>
          </View>
          <Switch
            value={settings.enabled}
            onValueChange={enabled => setSettings(current => ({ ...current, enabled }))}
            trackColor={{ true: COLORS.primary }}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.labelGroup}>
            <Text style={styles.label}>သက်တမ်းကုန်ရန် ကျန်ရက်</Text>
            <Text style={styles.hint}>Default: 3 ရက်</Text>
          </View>
          <TextInput
            style={styles.numberInput}
            value={String(settings.expiryDays)}
            onChangeText={value => updateNumber('expiryDays', value)}
            keyboardType="number-pad"
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.labelGroup}>
            <Text style={styles.label}>Stock ကျန်အရေအတွက်</Text>
            <Text style={styles.hint}>Default: 10 ခု</Text>
          </View>
          <TextInput
            style={styles.numberInput}
            value={String(settings.lowStockCount)}
            onChangeText={value => updateNumber('lowStockCount', value)}
            keyboardType="number-pad"
          />
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={save}>
          <Ionicons name="save-outline" size={20} color={COLORS.white} />
          <Text style={styles.saveText}>သိမ်းမည်</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.section, styles.dataSection]}>
        <View style={styles.titleRow}>
          <Ionicons name="phone-portrait-outline" size={22} color={COLORS.primary} />
          <Text style={styles.title}>ဒီဖုန်း၏ Local Data</Text>
        </View>
        <Text style={styles.accountText}>Account: {user?.username || '-'}</Text>
        <Text style={styles.databaseText}>Database: {getCurrentDatabaseName() || '-'}</Text>
        <Text style={styles.warningText}>
          Account ပြောင်းပြီး data အဟောင်းများကျန်နေပါက လက်ရှိ account ၏ cache ကိုရှင်းပြီး server မှပြန်ယူနိုင်သည်။
        </Text>

        <TouchableOpacity
          style={[styles.clearButton, clearingCache && styles.disabledButton]}
          onPress={clearCurrentAccountCache}
          disabled={clearingCache}
        >
          {clearingCache ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Ionicons name="refresh-outline" size={20} color={COLORS.white} />
          )}
          <Text style={styles.saveText}>
            {clearingCache ? 'ပြန်လည် Sync လုပ်နေသည်...' : 'Local Data ရှင်းပြီး Sync လုပ်မည်'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.light },
  contentContainer: { padding: moderateScale(16), paddingBottom: moderateScale(32) },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  section: { backgroundColor: COLORS.white, borderRadius: 8, padding: moderateScale(16) },
  dataSection: { marginTop: moderateScale(16) },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: moderateScale(12),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLight,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: moderateScale(8) },
  title: { fontFamily: FONTS.bold, fontSize: moderateScale(17), color: COLORS.dark },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: moderateScale(16),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLight,
  },
  labelGroup: { flex: 1 },
  label: { fontFamily: FONTS.medium, fontSize: moderateScale(14), color: COLORS.dark },
  hint: { fontFamily: FONTS.regular, fontSize: moderateScale(11), color: COLORS.gray, marginTop: 3 },
  numberInput: {
    width: moderateScale(70),
    borderWidth: 1,
    borderColor: COLORS.grayLight,
    borderRadius: 6,
    paddingVertical: moderateScale(8),
    textAlign: 'center',
    fontFamily: FONTS.bold,
    color: COLORS.dark,
  },
  saveButton: {
    marginTop: moderateScale(18),
    height: moderateScale(48),
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: moderateScale(8),
  },
  saveText: { fontFamily: FONTS.bold, color: COLORS.white, fontSize: moderateScale(15) },
  accountText: {
    marginTop: moderateScale(16),
    fontFamily: FONTS.medium,
    color: COLORS.dark,
    fontSize: moderateScale(14),
  },
  databaseText: {
    marginTop: moderateScale(4),
    fontFamily: FONTS.regular,
    color: COLORS.gray,
    fontSize: moderateScale(12),
  },
  warningText: {
    marginTop: moderateScale(12),
    fontFamily: FONTS.regular,
    color: COLORS.gray,
    fontSize: moderateScale(12),
    lineHeight: moderateScale(18),
  },
  clearButton: {
    marginTop: moderateScale(16),
    minHeight: moderateScale(48),
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(10),
    backgroundColor: COLORS.danger,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: moderateScale(8),
  },
  disabledButton: { opacity: 0.65 },
});
