import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, FONTS } from '../../config/theme';
import { fontScale, moderateScale } from '../../utils/responsive';
import {
  BluetoothPrinterDevice,
  bluetoothPrinterService,
} from '../../services/printing/bluetoothPrinterService';

export const BluetoothSettingsScreen = () => {
  const [devices, setDevices] = useState<BluetoothPrinterDevice[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<BluetoothPrinterDevice | null>(null);
  const [loading, setLoading] = useState(false);
  const [connectingAddress, setConnectingAddress] = useState<string | null>(null);

  const loadSaved = useCallback(async () => {
    const saved = await bluetoothPrinterService.getSavedPrinter();
    setSelectedPrinter(saved);
  }, []);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    try {
      await loadSaved();
      const pairedDevices = await bluetoothPrinterService.listPairedDevices();
      setDevices(pairedDevices);
    } catch (error: any) {
      setDevices([]);
      Alert.alert('Bluetooth မရနိုင်ပါ', error?.message || 'Bluetooth device list မဖတ်နိုင်ပါ');
    } finally {
      setLoading(false);
    }
  }, [loadSaved]);

  useFocusEffect(
    useCallback(() => {
      loadDevices();
    }, [loadDevices])
  );

  const connectPrinter = async (device: BluetoothPrinterDevice) => {
    setConnectingAddress(device.address);
    try {
      await bluetoothPrinterService.connect(device);
      setSelectedPrinter(device);
      Alert.alert('ချိတ်ဆက်ပြီးပါပြီ', `${device.name} ကို voucher printer အဖြစ်ရွေးထားပါသည်။`);
    } catch (error: any) {
      Alert.alert('ချိတ်ဆက်မရပါ', error?.message || 'Printer ချိတ်ဆက်ရာတွင် အမှားရှိပါသည်');
    } finally {
      setConnectingAddress(null);
    }
  };

  const testPrint = async () => {
    if (!selectedPrinter) {
      Alert.alert('Printer မရွေးရသေးပါ', 'အောက်က paired printer တစ်ခုကိုအရင်ရွေးပါ။');
      return;
    }
    setConnectingAddress(selectedPrinter.address);
    try {
      await bluetoothPrinterService.printTest(selectedPrinter);
      Alert.alert('Test print ပို့ပြီးပါပြီ', 'Printer မှ စာထွက်မထွက် စစ်ပါ။');
    } catch (error: any) {
      Alert.alert('Test print မအောင်မြင်ပါ', error?.message || 'Printer ချိတ်ဆက်မှု စစ်ပါ။');
    } finally {
      setConnectingAddress(null);
    }
  };

  const clearPrinter = async () => {
    if (selectedPrinter) {
      await bluetoothPrinterService.disconnect(selectedPrinter).catch(() => undefined);
    }
    await bluetoothPrinterService.clearPrinter();
    setSelectedPrinter(null);
  };

  const renderDevice = ({ item }: { item: BluetoothPrinterDevice }) => {
    const selected = selectedPrinter?.address === item.address;
    const busy = connectingAddress === item.address;
    return (
      <TouchableOpacity
        style={[styles.deviceCard, selected && styles.deviceCardSelected]}
        onPress={() => connectPrinter(item)}
        activeOpacity={1}
      >
        <View style={[styles.deviceIcon, selected && styles.deviceIconSelected]}>
          <Ionicons name={selected ? 'print' : 'print-outline'} size={22} color={selected ? COLORS.white : COLORS.primary} />
        </View>
        <View style={styles.deviceInfo}>
          <Text style={styles.deviceName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.deviceAddress} numberOfLines={1}>{item.address}</Text>
        </View>
        {busy ? (
          <ActivityIndicator color={COLORS.primary} />
        ) : (
          <Ionicons name={selected ? 'checkmark-circle' : 'chevron-forward'} size={22} color={selected ? COLORS.success : COLORS.gray} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="bluetooth" size={30} color={COLORS.white} />
        </View>
        <View style={styles.heroText}>
          <Text style={styles.heroTitle}>Bluetooth Printer / Scanner</Text>
          <Text style={styles.heroSubtitle}>
            Voucher printer နှင့် Bluetooth barcode scanner ကို phone Bluetooth setting မှ pair လုပ်ပြီး သုံးနိုင်ပါသည်။
          </Text>
        </View>
      </View>

      <View style={styles.selectedCard}>
        <Text style={styles.sectionTitle}>ရွေးထားသော Printer</Text>
        {selectedPrinter ? (
          <View style={styles.selectedRow}>
            <View style={styles.selectedInfo}>
              <Text style={styles.selectedName}>{selectedPrinter.name}</Text>
              <Text style={styles.selectedAddress}>{selectedPrinter.address}</Text>
            </View>
            <TouchableOpacity style={styles.clearButton} onPress={clearPrinter} activeOpacity={1}>
              <Text style={styles.clearButtonText}>ဖြုတ်မည်</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.emptyHint}>Printer မရွေးရသေးပါ</Text>
        )}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionButton} onPress={loadDevices} activeOpacity={1}>
            <Ionicons name="refresh-outline" size={18} color={COLORS.primary} />
            <Text style={styles.actionText}>ပြန်ရှာမည်</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.testButton]} onPress={testPrint} activeOpacity={1}>
            <Ionicons name="receipt-outline" size={18} color={COLORS.white} />
            <Text style={styles.testText}>Test Print</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.scannerCard}>
        <View style={styles.scannerIcon}>
          <Ionicons name="barcode-outline" size={22} color={COLORS.primary} />
        </View>
        <View style={styles.scannerText}>
          <Text style={styles.scannerTitle}>Bluetooth Barcode Scanner</Text>
          <Text style={styles.scannerBody}>
            Scanner ကို HID/Keyboard mode ဖြင့် pair လုပ်ပါ။ POS screen ဖွင့်ထားချိန် scan လုပ်ပါက product ကို auto add လုပ်ပါမည်။
          </Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Paired Devices</Text>
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Bluetooth device များရှာနေသည်...</Text>
        </View>
      ) : (
        <FlatList
          data={devices}
          keyExtractor={item => item.address}
          renderItem={renderDevice}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="bluetooth-outline" size={40} color={COLORS.gray} />
              <Text style={styles.emptyTitle}>Paired device မတွေ့ပါ</Text>
              <Text style={styles.emptyText}>
                {Platform.OS === 'android'
                  ? 'Phone Bluetooth setting မှ printer/scanner ကိုအရင် pair လုပ်ပြီး ပြန်ရှာပါ။'
                  : 'iOS တွင် Bluetooth Classic printer များသည် MFi support လိုနိုင်ပါသည်။'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F8', padding: moderateScale(14) },
  hero: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, borderRadius: 12, padding: moderateScale(14), marginBottom: moderateScale(12) },
  heroIcon: { width: moderateScale(52), height: moderateScale(52), borderRadius: 12, backgroundColor: COLORS.white + '18', alignItems: 'center', justifyContent: 'center', marginRight: moderateScale(12) },
  heroText: { flex: 1 },
  heroTitle: { fontFamily: FONTS.bold, fontSize: fontScale(18), lineHeight: fontScale(29), color: COLORS.white, includeFontPadding: true },
  heroSubtitle: { fontFamily: FONTS.regular, fontSize: fontScale(12.5), lineHeight: fontScale(21), color: COLORS.white + 'CC', includeFontPadding: true },
  selectedCard: { backgroundColor: COLORS.white, borderRadius: 12, padding: moderateScale(13), borderWidth: 1, borderColor: '#E8ECF2', marginBottom: moderateScale(12) },
  sectionTitle: { fontFamily: FONTS.bold, fontSize: fontScale(16), lineHeight: fontScale(26), color: COLORS.dark, includeFontPadding: true, marginBottom: moderateScale(8) },
  selectedRow: { flexDirection: 'row', alignItems: 'center', gap: moderateScale(8), marginBottom: moderateScale(10) },
  selectedInfo: { flex: 1 },
  selectedName: { fontFamily: FONTS.bold, fontSize: fontScale(15), color: COLORS.dark },
  selectedAddress: { fontFamily: FONTS.regular, fontSize: fontScale(11.5), color: COLORS.gray, marginTop: 2 },
  emptyHint: { fontFamily: FONTS.regular, color: COLORS.gray, fontSize: fontScale(13), marginBottom: moderateScale(10) },
  clearButton: { minHeight: moderateScale(36), paddingHorizontal: moderateScale(12), borderRadius: 8, backgroundColor: COLORS.danger + '10', alignItems: 'center', justifyContent: 'center' },
  clearButtonText: { fontFamily: FONTS.bold, fontSize: fontScale(12), color: COLORS.danger },
  actionRow: { flexDirection: 'row', gap: moderateScale(8) },
  actionButton: { flex: 1, minHeight: moderateScale(42), borderRadius: 8, borderWidth: 1, borderColor: COLORS.primary + '30', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: COLORS.white },
  actionText: { fontFamily: FONTS.bold, fontSize: fontScale(13), color: COLORS.primary },
  testButton: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  testText: { fontFamily: FONTS.bold, fontSize: fontScale(13), color: COLORS.white },
  scannerCard: { flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: 12, padding: moderateScale(13), borderWidth: 1, borderColor: '#E8ECF2', marginBottom: moderateScale(12) },
  scannerIcon: { width: moderateScale(44), height: moderateScale(44), borderRadius: 10, backgroundColor: COLORS.primary + '10', alignItems: 'center', justifyContent: 'center', marginRight: moderateScale(10) },
  scannerText: { flex: 1 },
  scannerTitle: { fontFamily: FONTS.bold, fontSize: fontScale(15), color: COLORS.dark, lineHeight: fontScale(24), includeFontPadding: true },
  scannerBody: { fontFamily: FONTS.regular, fontSize: fontScale(12.5), lineHeight: fontScale(21), color: COLORS.gray, includeFontPadding: true, marginTop: 2 },
  listContent: { paddingBottom: moderateScale(30) },
  deviceCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 10, padding: moderateScale(12), borderWidth: 1, borderColor: '#E8ECF2', marginBottom: moderateScale(9) },
  deviceCardSelected: { borderColor: COLORS.success + '66', backgroundColor: '#F7FCF9' },
  deviceIcon: { width: moderateScale(44), height: moderateScale(44), borderRadius: 10, backgroundColor: COLORS.primary + '10', alignItems: 'center', justifyContent: 'center', marginRight: moderateScale(10) },
  deviceIconSelected: { backgroundColor: COLORS.success },
  deviceInfo: { flex: 1, minWidth: 0 },
  deviceName: { fontFamily: FONTS.bold, fontSize: fontScale(14.5), color: COLORS.dark },
  deviceAddress: { fontFamily: FONTS.regular, fontSize: fontScale(11.5), color: COLORS.gray, marginTop: 2 },
  loading: { paddingVertical: moderateScale(30), alignItems: 'center' },
  loadingText: { marginTop: moderateScale(10), fontFamily: FONTS.regular, fontSize: fontScale(13), color: COLORS.gray },
  emptyState: { alignItems: 'center', paddingVertical: moderateScale(34), paddingHorizontal: moderateScale(14) },
  emptyTitle: { marginTop: moderateScale(10), fontFamily: FONTS.bold, fontSize: fontScale(15), color: COLORS.dark },
  emptyText: { marginTop: moderateScale(5), fontFamily: FONTS.regular, fontSize: fontScale(12.5), lineHeight: fontScale(21), color: COLORS.gray, textAlign: 'center' },
});

export default BluetoothSettingsScreen;
