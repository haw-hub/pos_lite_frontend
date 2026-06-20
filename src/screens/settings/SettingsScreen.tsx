import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
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
import { fontScale, moderateScale } from '../../utils/responsive';
import { subscriptionService } from '../../services/subscription/subscriptionService';
import { PaymentProofUploader } from '../../components/PaymentProofUploader';
import { localShopProfileService, LocalShopProfile } from '../../services/shop/localShopProfileService';
import { SHOP_FEATURES, useFeature } from '../../hooks/useFeature';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type SettingsSection = 'shop' | 'users' | 'subscription' | 'payment' | 'alerts' | 'backup';

const InfoRow = ({ label, value }: { label: string; value?: string | number | null }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue} numberOfLines={2}>{value || '-'}</Text>
  </View>
);

const ActionButton = ({
  icon,
  label,
  onPress,
  danger = false,
  disabled = false,
  loading = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
  loading?: boolean;
}) => (
  <TouchableOpacity
    style={[styles.actionButton, danger && styles.dangerButton, disabled && styles.disabledButton]}
    onPress={onPress}
    disabled={disabled || loading}
    activeOpacity={1}
  >
    {loading ? (
      <ActivityIndicator color={COLORS.white} />
    ) : (
      <Ionicons name={icon} size={moderateScale(19)} color={COLORS.white} />
    )}
    <Text style={styles.actionButtonText}>{label}</Text>
  </TouchableOpacity>
);

const MenuCard = ({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  onPress: () => void;
}) => (
  <TouchableOpacity style={styles.menuCard} onPress={onPress} activeOpacity={1}>
    <View style={styles.menuIcon}>
      <Ionicons name={icon} size={moderateScale(22)} color={COLORS.primary} />
    </View>
    <View style={styles.menuTextWrap}>
      <Text style={styles.menuTitle} numberOfLines={1}>{title}</Text>
      <Text style={styles.menuSubtitle} numberOfLines={2}>{subtitle}</Text>
    </View>
    <Ionicons name="chevron-forward" size={moderateScale(20)} color={COLORS.gray} />
  </TouchableOpacity>
);

const DetailModal = ({
  icon,
  title,
  subtitle,
  visible,
  onClose,
  children,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <Pressable style={styles.modalOverlay} onPress={onClose}>
      <Pressable style={styles.modalCard}>
        <View style={styles.detailTopRow}>
          <View style={styles.detailIcon}>
            <Ionicons name={icon} size={moderateScale(22)} color={COLORS.primary} />
          </View>
          <View style={styles.detailTitleWrap}>
            <Text style={styles.detailTitle}>{title}</Text>
            <Text style={styles.detailSubtitle}>{subtitle}</Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={1}>
            <Ionicons name="close" size={moderateScale(22)} color={COLORS.dark} />
          </TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalContent}>
          {children}
        </ScrollView>
      </Pressable>
    </Pressable>
  </Modal>
);

export const SettingsScreen = ({ navigation }: any) => {
  const [settings, setSettings] = useState<InventoryAlertSettings>(DEFAULT_ALERT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [clearingCache, setClearingCache] = useState(false);
  const [verifyingSubscription, setVerifyingSubscription] = useState(false);
  const [selectedSection, setSelectedSection] = useState<SettingsSection | null>(null);
  const [localShopProfile, setLocalShopProfile] = useState<LocalShopProfile>({});
  const user = useAuthStore(state => state.user);
  const subscriptionState = useAuthStore(state => state.subscriptionState);
  const verifySubscription = useAuthStore(state => state.verifySubscription);
  const logout = useAuthStore(state => state.logout);
  const canPrintVoucher = useFeature(SHOP_FEATURES.VOUCHER_PRINT);
  const shopLogoUrl = localShopProfile.logoUri || (user as any)?.shopLogoUrl || (user as any)?.logoUrl;
  const shopDisplayName = localShopProfile.displayName || user?.shopName || 'ဆိုင်အမည်';

  useEffect(() => {
    inventoryAlertService.getSettings().then(value => {
      setSettings(value);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const loadLocalProfile = async () => {
      const profile = await localShopProfileService.getProfile(user?.shopId, user?.username);
      setLocalShopProfile(profile);
    };
    loadLocalProfile();
    const unsubscribe = navigation.addListener?.('focus', loadLocalProfile);
    return unsubscribe;
  }, [navigation, user?.shopId, user?.username]);

  const updateNumber = (key: 'expiryDays' | 'lowStockCount', value: string) => {
    const number = Math.max(0, Number(value.replace(/\D/g, '')) || 0);
    setSettings(current => ({ ...current, [key]: number }));
  };

  const saveAlertSettings = async () => {
    await inventoryAlertService.saveSettings(settings);
    await inventoryAlertService.checkAndNotify(true);
    Alert.alert('သိမ်းပြီးပါပြီ', 'Alert သတ်မှတ်ချက်များ ပြင်ဆင်ပြီးပါပြီ။');
  };

  const checkSubscription = async () => {
    setVerifyingSubscription(true);
    const allowed = await verifySubscription();
    setVerifyingSubscription(false);
    Alert.alert(
      allowed ? 'စစ်ဆေးပြီးပါပြီ' : 'အသုံးပြုခွင့် မရှိပါ',
      allowed ? 'Subscription အခြေအနေကို အတည်ပြုပြီးပါပြီ။' : 'Internet connection သို့မဟုတ် subscription သက်တမ်းကို စစ်ဆေးပါ။',
    );
  };

  const clearCurrentAccountCache = () => {
    Alert.alert(
      'Local data ပြန်ယူမည်',
      `${user?.username || 'လက်ရှိ'} account ၏ ဒီဖုန်းထဲရှိ local data ကိုရှင်းပြီး server မှ ပြန်ယူမည်။ Sync မတက်ရသေးသော offline data များ ပျောက်သွားနိုင်သည်။`,
      [
        { text: 'မလုပ်တော့ပါ', style: 'cancel' },
        {
          text: 'Restore လုပ်မည်',
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
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  const subscriptionEndDate = subscriptionState?.subscriptionEndsAt || subscriptionState?.trialEndsAt;
  const remainingDays = subscriptionState ? Math.max(0, subscriptionService.daysRemaining(subscriptionState)) : 0;
  const canManageStaff = user?.role === 'ADMIN';

  const confirmLogout = () => {
    Alert.alert(
      'Account မှ ထွက်မည်',
      'ဒီဖုန်းတွင် login ထွက်မည်။ Offline မတင်ရသေးသော data ရှိပါက internet ရသောအခါ sync ပြီးမှထွက်တာ ပိုကောင်းပါသည်။',
      [
        { text: 'မလုပ်တော့ပါ', style: 'cancel' },
        { text: 'ထွက်မည်', style: 'destructive', onPress: logout },
      ],
    );
  };

  const renderMenu = () => (
    <>
      <View style={styles.headerCard}>
        <View style={styles.headerLogo}>
          <Ionicons name={shopLogoUrl ? 'image-outline' : 'storefront-outline'} size={moderateScale(28)} color={COLORS.primary} />
        </View>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>{shopDisplayName}</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {user?.fullName || user?.username || 'အကောင့်'} • {user?.role || 'ဝန်ထမ်း'}
          </Text>
        </View>
      </View>

      <MenuCard
        icon="storefront-outline"
        title="ဆိုင် Logo နှင့် ဆိုင်နာမည်"
        subtitle="ဆိုင်အချက်အလက်"
        onPress={() => navigation.navigate('ShopProfile')}
      />
      {canManageStaff ? (
        <MenuCard
          icon="people-outline"
          title="ဝန်ထမ်းအကောင့် စီမံရန်"
          subtitle="ဝန်ထမ်း account နှင့် role များ"
          onPress={() => navigation.navigate('UserManagement')}
        />
      ) : null}
      <MenuCard
        icon="calendar-outline"
        title="သုံးခွင့်သက်တမ်း စစ်ရန်"
        subtitle="သုံးခွင့်သက်တမ်း စစ်ရန်"
        onPress={() => setSelectedSection('subscription')}
      />
      <MenuCard
        icon="image-outline"
        title="ငွေလွှဲ Screenshot"
        subtitle="ငွေလွှဲ screenshot ပို့ရန်"
        onPress={() => setSelectedSection('payment')}
      />
      <MenuCard
        icon="notifications-outline"
        title="သတိပေးချက် စီမံရန်"
        subtitle="Stock နှင့် သက်တမ်းကုန် alert"
        onPress={() => setSelectedSection('alerts')}
      />
      {canPrintVoucher ? (
        <MenuCard
          icon="bluetooth-outline"
          title="Bluetooth Printer / Scanner"
          subtitle="Voucher printer နှင့် barcode scanner ချိတ်ရန်"
          onPress={() => navigation.navigate('BluetoothSettings')}
        />
      ) : null}
      <MenuCard
        icon="cloud-download-outline"
        title="Local Data ပြန်ယူရန်"
        subtitle="ဆိုင် data ကို server မှပြန်ယူရန်"
        onPress={() => setSelectedSection('backup')}
      />
      <TouchableOpacity style={styles.logoutCard} onPress={confirmLogout} activeOpacity={1}>
        <View style={styles.logoutIcon}>
          <Ionicons name="log-out-outline" size={moderateScale(22)} color={COLORS.danger} />
        </View>
        <View style={styles.menuTextWrap}>
          <Text style={styles.logoutTitle}>Account မှ ထွက်မည်</Text>
          <Text style={styles.menuSubtitle} numberOfLines={2}>လက်ရှိ account ကို logout လုပ်ရန်</Text>
        </View>
        <Ionicons name="chevron-forward" size={moderateScale(20)} color={COLORS.gray} />
      </TouchableOpacity>
    </>
  );

  const renderDetail = () => {
    switch (selectedSection) {
      case 'shop':
        return (
          <DetailModal
            icon="storefront-outline"
            title="ဆိုင် Logo နှင့် ဆိုင်နာမည်"
            subtitle="Voucher တွင်ပြမည့် ဆိုင်အချက်အလက်"
            visible={selectedSection === 'shop'}
            onClose={() => setSelectedSection(null)}
          >
            <View style={styles.shopProfile}>
              <View style={styles.logoBox}>
                <Ionicons name={shopLogoUrl ? 'image-outline' : 'storefront-outline'} size={moderateScale(30)} color={COLORS.primary} />
              </View>
              <View style={styles.shopProfileText}>
                <Text style={styles.shopName} numberOfLines={1}>{user?.shopName || 'ဆိုင်အမည်'}</Text>
                <Text style={styles.shopHint}>{shopLogoUrl ? 'Logo ထည့်ထားပြီး' : 'Logo မထည့်ရသေးပါ'}</Text>
              </View>
            </View>
            <InfoRow label="အကောင့်" value={user?.username} />
            <InfoRow label="အသုံးပြုသူ" value={user?.fullName} />
            <InfoRow label="Role" value={user?.role} />
          </DetailModal>
        );
      case 'subscription':
        return (
          <DetailModal
            icon="calendar-outline"
            title="သုံးခွင့်သက်တမ်း စစ်ရန်"
            subtitle="သုံးခွင့်သက်တမ်းနှင့် server verification"
            visible={selectedSection === 'subscription'}
            onClose={() => setSelectedSection(null)}
          >
            <View style={styles.statusRow}>
              <View>
                <Text style={styles.statusLabel}>အခြေအနေ</Text>
                <Text style={styles.statusMain}>{subscriptionState?.status || user?.subscriptionStatus || '-'}</Text>
              </View>
              <View style={[
                styles.statusBadge,
                subscriptionState?.canUseApp ? styles.statusActive : styles.statusExpired,
              ]}>
                <Text style={[
                  styles.statusText,
                  subscriptionState?.canUseApp ? styles.statusActiveText : styles.statusExpiredText,
                ]}>
                  {subscriptionState?.canUseApp ? 'ACTIVE' : 'CHECK'}
                </Text>
              </View>
            </View>
            <InfoRow label="ကျန်ရက်" value={`${remainingDays} ရက်`} />
            <InfoRow label="ကုန်ဆုံးမည့်နေ့" value={subscriptionEndDate ? new Date(subscriptionEndDate).toLocaleDateString() : '-'} />
            <InfoRow
              label="နောက်ဆုံးစစ်ဆေးချိန်"
              value={subscriptionState?.lastVerifiedAt ? new Date(subscriptionState.lastVerifiedAt).toLocaleString() : '-'}
            />
            <ActionButton
              icon="refresh-outline"
              label="သုံးခွင့်သက်တမ်း စစ်မည်"
              onPress={checkSubscription}
              loading={verifyingSubscription}
            />
          </DetailModal>
        );
      case 'payment':
        return (
          <DetailModal
            icon="image-outline"
            title="ငွေလွှဲ Screenshot"
            subtitle="သက်တမ်းတိုးရန် screenshot ပို့ရန်"
            visible={selectedSection === 'payment'}
            onClose={() => setSelectedSection(null)}
          >
            <PaymentProofUploader onSubmitted={verifySubscription} />
          </DetailModal>
        );
      case 'alerts':
        return (
          <DetailModal
            icon="notifications-outline"
            title="သတိပေးချက် စီမံရန်"
            subtitle="Expiry နှင့် low stock သတိပေးချက်"
            visible={selectedSection === 'alerts'}
            onClose={() => setSelectedSection(null)}
          >
            <View style={styles.switchRow}>
              <View style={styles.switchTextWrap}>
                <Text style={styles.settingTitle}>Alert ဖွင့်ထားမည်</Text>
                <Text style={styles.settingHint}>Dashboard တွင် သတိပေးချက်များ ပြမည်</Text>
              </View>
              <Switch
                value={settings.enabled}
                onValueChange={enabled => setSettings(current => ({ ...current, enabled }))}
                trackColor={{ true: COLORS.primary }}
              />
            </View>
            <View style={styles.settingRow}>
              <View style={styles.labelGroup}>
                <Text style={styles.settingTitle}>သက်တမ်းကုန်ရန် ကျန်ရက်</Text>
                <Text style={styles.settingHint}>Default: 3 ရက်</Text>
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
                <Text style={styles.settingTitle}>Stock ကျန်အရေအတွက်</Text>
                <Text style={styles.settingHint}>Default: 10 ခု</Text>
              </View>
              <TextInput
                style={styles.numberInput}
                value={String(settings.lowStockCount)}
                onChangeText={value => updateNumber('lowStockCount', value)}
                keyboardType="number-pad"
              />
            </View>
            <ActionButton icon="save-outline" label="သတိပေးချက် သိမ်းမည်" onPress={saveAlertSettings} />
          </DetailModal>
        );
      case 'backup':
        return (
          <DetailModal
            icon="cloud-download-outline"
            title="Local Data ပြန်ယူရန်"
            subtitle="Server data ဖြင့် SQLite restore"
            visible={selectedSection === 'backup'}
            onClose={() => setSelectedSection(null)}
          >
            <InfoRow label="ဆိုင်" value={user?.shopName} />
            <InfoRow label="အကောင့်" value={user?.username} />
            <InfoRow label="Database" value={getCurrentDatabaseName()} />
            <Text style={styles.warningText}>
              ဖုန်းပြောင်းခြင်း၊ app ပြန်သွင်းခြင်း၊ account ပြောင်းပြီး data မမှန်ခြင်းတို့တွင် server မှ shop data ပြန်ယူနိုင်သည်။
            </Text>
            <ActionButton
              icon="refresh-outline"
              label={clearingCache ? 'Restore လုပ်နေသည်...' : 'ဆိုင် data ပြန်ယူမည်'}
              onPress={clearCurrentAccountCache}
              danger
              loading={clearingCache}
            />
          </DetailModal>
        );
      default:
        return null;
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {renderMenu()}
      {renderDetail()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.light,
  },
  contentContainer: {
    padding: moderateScale(16),
    paddingBottom: moderateScale(34),
    gap: moderateScale(12),
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: moderateScale(18),
  },
  modalCard: {
    width: '100%',
    maxWidth: 430,
    maxHeight: '84%',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: moderateScale(15),
  },
  modalContent: {
    paddingBottom: moderateScale(4),
  },
  closeButton: {
    width: moderateScale(38),
    height: moderateScale(38),
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F4F7',
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: moderateScale(14),
    borderRadius: 10,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#E8ECF2',
    gap: moderateScale(12),
  },
  headerLogo: {
    width: moderateScale(58),
    height: moderateScale(58),
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF4FB',
  },
  headerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontFamily: FONTS.bold,
    fontSize: fontScale(20),
    lineHeight: fontScale(31),
    color: COLORS.dark,
    includeFontPadding: true,
  },
  headerSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: fontScale(13),
    lineHeight: fontScale(21),
    color: COLORS.gray,
    includeFontPadding: true,
  },
  menuCard: {
    minHeight: moderateScale(78),
    flexDirection: 'row',
    alignItems: 'center',
    padding: moderateScale(14),
    borderRadius: 10,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#E8ECF2',
    gap: moderateScale(12),
  },
  logoutCard: {
    minHeight: moderateScale(76),
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(12),
    padding: moderateScale(12),
    backgroundColor: COLORS.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.danger + '33',
  },
  logoutIcon: {
    width: moderateScale(46),
    height: moderateScale(46),
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.danger + '10',
  },
  logoutTitle: {
    fontFamily: FONTS.bold,
    fontSize: fontScale(15),
    lineHeight: fontScale(24),
    color: COLORS.danger,
    includeFontPadding: true,
  },
  menuIcon: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F6FB',
  },
  menuTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  menuTitle: {
    fontFamily: FONTS.bold,
    fontSize: fontScale(16),
    lineHeight: fontScale(26),
    color: COLORS.dark,
    includeFontPadding: true,
  },
  menuSubtitle: {
    marginTop: 2,
    fontFamily: FONTS.regular,
    fontSize: fontScale(12),
    lineHeight: fontScale(20),
    color: COLORS.gray,
    includeFontPadding: true,
  },
  detailCard: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: moderateScale(15),
    borderWidth: 1,
    borderColor: '#E8ECF2',
  },
  detailTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: moderateScale(14),
    gap: moderateScale(10),
  },
  backButton: {
    width: moderateScale(38),
    height: moderateScale(38),
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F6FB',
  },
  detailIcon: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF4FB',
  },
  detailTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  detailTitle: {
    fontFamily: FONTS.bold,
    fontSize: fontScale(17),
    lineHeight: fontScale(27),
    color: COLORS.dark,
    includeFontPadding: true,
  },
  detailSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: fontScale(12),
    lineHeight: fontScale(20),
    color: COLORS.gray,
    includeFontPadding: true,
  },
  shopProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: moderateScale(12),
    borderRadius: 10,
    backgroundColor: '#F7F9FC',
    marginBottom: moderateScale(8),
    gap: moderateScale(12),
  },
  logoBox: {
    width: moderateScale(58),
    height: moderateScale(58),
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  shopProfileText: {
    flex: 1,
    minWidth: 0,
  },
  shopName: {
    fontFamily: FONTS.bold,
    fontSize: fontScale(18),
    lineHeight: fontScale(29),
    color: COLORS.primary,
    includeFontPadding: true,
  },
  shopHint: {
    fontFamily: FONTS.regular,
    fontSize: fontScale(12),
    lineHeight: fontScale(20),
    color: COLORS.gray,
    includeFontPadding: true,
  },
  infoRow: {
    minHeight: moderateScale(42),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: moderateScale(12),
    borderTopWidth: 1,
    borderTopColor: '#EEF1F5',
  },
  infoLabel: {
    fontFamily: FONTS.regular,
    fontSize: fontScale(12),
    lineHeight: fontScale(20),
    color: COLORS.gray,
    includeFontPadding: true,
  },
  infoValue: {
    flex: 1,
    textAlign: 'right',
    fontFamily: FONTS.bold,
    fontSize: fontScale(13),
    lineHeight: fontScale(22),
    color: COLORS.dark,
    includeFontPadding: true,
  },
  bodyText: {
    fontFamily: FONTS.regular,
    fontSize: fontScale(13),
    lineHeight: fontScale(23),
    color: COLORS.gray,
    includeFontPadding: true,
  },
  actionButton: {
    minHeight: moderateScale(48),
    marginTop: moderateScale(14),
    borderRadius: 9,
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(10),
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: moderateScale(8),
  },
  dangerButton: {
    backgroundColor: COLORS.danger,
  },
  disabledButton: {
    opacity: 0.6,
  },
  actionButtonText: {
    fontFamily: FONTS.bold,
    color: COLORS.white,
    fontSize: fontScale(14),
    lineHeight: fontScale(22),
    includeFontPadding: true,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: moderateScale(8),
  },
  statusLabel: {
    fontFamily: FONTS.regular,
    fontSize: fontScale(12),
    color: COLORS.gray,
  },
  statusMain: {
    marginTop: 2,
    fontFamily: FONTS.bold,
    fontSize: fontScale(16),
    color: COLORS.dark,
  },
  statusBadge: {
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(6),
    borderRadius: 7,
  },
  statusActive: {
    backgroundColor: '#E7F4ED',
  },
  statusExpired: {
    backgroundColor: '#FBE8E6',
  },
  statusText: {
    fontFamily: FONTS.bold,
    fontSize: fontScale(11),
  },
  statusActiveText: {
    color: '#237751',
  },
  statusExpiredText: {
    color: COLORS.danger,
  },
  switchRow: {
    minHeight: moderateScale(48),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: moderateScale(12),
    paddingBottom: moderateScale(12),
  },
  switchTextWrap: {
    flex: 1,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: moderateScale(12),
    paddingVertical: moderateScale(13),
    borderTopWidth: 1,
    borderTopColor: '#EEF1F5',
  },
  labelGroup: {
    flex: 1,
  },
  settingTitle: {
    fontFamily: FONTS.medium,
    fontSize: fontScale(14),
    lineHeight: fontScale(23),
    color: COLORS.dark,
    includeFontPadding: true,
  },
  settingHint: {
    marginTop: 2,
    fontFamily: FONTS.regular,
    fontSize: fontScale(11),
    lineHeight: fontScale(18),
    color: COLORS.gray,
    includeFontPadding: true,
  },
  numberInput: {
    width: moderateScale(76),
    minHeight: moderateScale(42),
    borderWidth: 1,
    borderColor: '#DDE3EA',
    borderRadius: 8,
    paddingVertical: moderateScale(7),
    textAlign: 'center',
    fontFamily: FONTS.bold,
    fontSize: fontScale(14),
    color: COLORS.dark,
  },
  warningText: {
    marginTop: moderateScale(12),
    fontFamily: FONTS.regular,
    color: COLORS.gray,
    fontSize: fontScale(12),
    lineHeight: fontScale(21),
    includeFontPadding: true,
  },
});
