import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DatePickerModal } from '../../components/DatePickerModal';
import { BarcodeScanner } from '../../components/BarcodeScanner';
import { purchasesApi } from '../../api/purchases';
import { COLORS, FONTS } from '../../config/theme';
import { useProductStore } from '../../store/productStore';
import { ProductRepository } from '../../database/repositories/productRepository';
import { SyncQueueRepository } from '../../database/repositories/syncQueueRepository';
import { syncService } from '../../services/sync/syncService';
import { formatCurrency } from '../../utils/currency';
import { moderateScale, fontScale } from '../../utils/responsive';
import { Product } from '../../types';
import { SHOP_FEATURES, useFeature } from '../../hooks/useFeature';

const todayValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export const StockInScreen = ({ navigation }: any) => {
  const canUseStockIn = useFeature(SHOP_FEATURES.STOCK_IN);
  const { products, fetchProducts } = useProductStore();
  const [query, setQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(todayValue());
  const [note, setNote] = useState('');
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!canUseStockIn) {
      Alert.alert('Feature မဖွင့်ရသေးပါ', 'Stock In feature ကိုသုံးရန် Super Admin မှဖွင့်ပေးရန်လိုအပ်ပါသည်။', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
      return;
    }
    fetchProducts();
  }, [canUseStockIn, fetchProducts, navigation]);

  const filteredProducts = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return products.slice(0, 8);
    return products
      .filter(product =>
        product.name.toLowerCase().includes(keyword) ||
        product.barcode?.toLowerCase().includes(keyword)
      )
      .slice(0, 12);
  }, [products, query]);

  const totalCost = (Number(quantity) || 0) * (Number(unitCost) || 0);

  if (!canUseStockIn) {
    return (
      <View style={styles.lockedContainer}>
        <Ionicons name="lock-closed-outline" size={46} color={COLORS.gray} />
        <Text style={styles.lockedTitle}>Stock In မဖွင့်ရသေးပါ</Text>
        <Text style={styles.lockedText}>ဒီ feature ကိုသုံးရန် Super Admin မှဖွင့်ပေးရန်လိုအပ်ပါသည်။</Text>
      </View>
    );
  }

  const handleBarcodeScan = async (barcode: string): Promise<Product | null> => {
    setScannerVisible(false);
    setQuery(barcode);
    const foundProduct = products.find(product => product.barcode === barcode) || null;
    if (foundProduct) {
      setSelectedProduct(foundProduct);
      setUnitCost(String(foundProduct.costPrice || ''));
    } else {
      Alert.alert('မတွေ့ပါ', `Barcode ${barcode} အတွက် product မတွေ့ပါ`);
    }
    return foundProduct;
  };

  const submit = async () => {
    if (!selectedProduct) {
      Alert.alert('Product ရွေးပါ', 'Stock ဝင်မည့် product ကို အရင်ရွေးပါ');
      return;
    }
    const qty = Number(quantity);
    const cost = Number(unitCost);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isInteger(qty)) {
      Alert.alert('Quantity မှားနေသည်', 'Quantity ကို positive whole number ထည့်ပါ');
      return;
    }
    if (!Number.isFinite(cost) || cost <= 0) {
      Alert.alert('Cost price မှားနေသည်', 'အရင်းစျေးကို မှန်ကန်စွာ ထည့်ပါ');
      return;
    }

    setSaving(true);
    const applyLocalStockIn = async (syncStatus: 'synced' | 'pending') => {
      const localProduct = await ProductRepository.getById(selectedProduct.id);
      if (!localProduct) {
        throw new Error('Local product မတွေ့ပါ');
      }
      await ProductRepository.save({
        ...localProduct,
        stock: localProduct.stock + qty,
        costPrice: cost,
        syncStatus,
      });
    };
    const request = {
      productId: selectedProduct.id,
      supplierName: supplierName.trim() || undefined,
      supplierPhone: supplierPhone.trim() || undefined,
      quantity: qty,
      unitCost: cost,
      purchaseDate,
      note: note.trim() || undefined,
    };
    try {
      const shouldQueueOnly = selectedProduct.id < 0;
      try {
        if (shouldQueueOnly) {
          throw new Error('QUEUE_LOCAL_PRODUCT');
        }
        await purchasesApi.stockIn(request);
        await applyLocalStockIn('synced');
      } catch (networkError: any) {
        const canQueueOffline =
          shouldQueueOnly ||
          !networkError.response &&
          (networkError.code === 'ERR_NETWORK' ||
            networkError.code === 'ECONNABORTED' ||
            networkError.message === 'Network Error' ||
            networkError.message === 'QUEUE_LOCAL_PRODUCT');
        if (!canQueueOffline) throw networkError;
        await applyLocalStockIn('pending');
        await SyncQueueRepository.add('PURCHASE', { request });
        syncService.forceSync().catch(() => undefined);
      }
      await fetchProducts();
      Alert.alert('Stock ဝင်ပြီးပါပြီ', `${selectedProduct.name} ကို ${qty} ခု ထည့်ပြီးပါပြီ`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert('Stock In မအောင်မြင်ပါ', error.response?.data?.message || error.message || 'Internet နှင့် server ကို စစ်ပြီး ထပ်လုပ်ပါ');
    } finally {
      setSaving(false);
    }
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const selected = selectedProduct?.id === item.id;
    return (
      <TouchableOpacity
        style={[styles.productRow, selected && styles.productRowSelected]}
        onPress={() => {
          setSelectedProduct(item);
          setUnitCost(String(item.costPrice || ''));
        }}
      >
        <View style={[styles.productIcon, selected && styles.productIconSelected]}>
          <Ionicons name="cube-outline" size={20} color={selected ? COLORS.white : COLORS.primary} />
        </View>
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{item.name}</Text>
          <Text style={styles.productMeta}>Stock {item.stock} • Cost {formatCurrency(item.costPrice || 0)}</Text>
        </View>
        {selected ? <Ionicons name="checkmark-circle" size={22} color={COLORS.success} /> : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Product ရွေးရန်</Text>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={20} color={COLORS.gray} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Product name / barcode"
              placeholderTextColor={COLORS.gray}
              multiline={false}
              numberOfLines={1}
              scrollEnabled={false}
            />
            {query ? (
              <TouchableOpacity style={styles.searchIconButton} onPress={() => setQuery('')} activeOpacity={1}>
                <Ionicons name="close-circle" size={20} color={COLORS.gray} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.scanButton} onPress={() => setScannerVisible(true)} activeOpacity={1}>
              <Ionicons name="barcode-outline" size={22} color={COLORS.white} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={filteredProducts}
            renderItem={renderProduct}
            keyExtractor={item => String(item.id)}
            scrollEnabled={false}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Purchase Detail</Text>
          <Text style={styles.label}>Supplier</Text>
          <TextInput style={styles.input} value={supplierName} onChangeText={setSupplierName} placeholder="Supplier name" placeholderTextColor={COLORS.gray} />
          <Text style={styles.label}>Supplier Phone</Text>
          <TextInput style={styles.input} value={supplierPhone} onChangeText={setSupplierPhone} keyboardType="phone-pad" placeholder="Phone number" placeholderTextColor={COLORS.gray} />
          <View style={styles.twoColumns}>
            <View style={styles.column}>
              <Text style={styles.label}>Quantity</Text>
              <TextInput style={styles.input} value={quantity} onChangeText={setQuantity} keyboardType="number-pad" placeholder="0" placeholderTextColor={COLORS.gray} />
            </View>
            <View style={styles.column}>
              <Text style={styles.label}>Unit Cost</Text>
              <TextInput style={styles.input} value={unitCost} onChangeText={setUnitCost} keyboardType="numeric" placeholder="0" placeholderTextColor={COLORS.gray} />
            </View>
          </View>
          <Text style={styles.label}>Date</Text>
          <TouchableOpacity style={styles.dateButton} onPress={() => setDatePickerVisible(true)}>
            <Ionicons name="calendar-outline" size={19} color={COLORS.primary} />
            <Text style={styles.dateText}>{purchaseDate}</Text>
          </TouchableOpacity>
          <Text style={styles.label}>Note</Text>
          <TextInput
            style={[styles.input, styles.noteInput]}
            value={note}
            onChangeText={setNote}
            placeholder="Optional note"
            placeholderTextColor={COLORS.gray}
            multiline
          />
        </View>

        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>Total Purchase Cost</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totalCost)}</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.submitButton, saving && styles.disabledButton]} onPress={submit} disabled={saving}>
          {saving ? <ActivityIndicator color={COLORS.white} /> : <Ionicons name="download-outline" size={20} color={COLORS.white} />}
          <Text style={styles.submitText}>Stock In သိမ်းမည်</Text>
        </TouchableOpacity>
      </View>

      <DatePickerModal
        visible={datePickerVisible}
        value={purchaseDate}
        onSelect={setPurchaseDate}
        onClear={() => setPurchaseDate(todayValue())}
        onClose={() => setDatePickerVisible(false)}
      />
      <BarcodeScanner
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScan={handleBarcodeScan}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F8' },
  lockedContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: moderateScale(24), backgroundColor: '#F4F6F8' },
  lockedTitle: { fontFamily: FONTS.bold, color: COLORS.dark, fontSize: fontScale(18), marginTop: moderateScale(12), textAlign: 'center' },
  lockedText: { fontFamily: FONTS.regular, color: COLORS.gray, fontSize: fontScale(13), lineHeight: fontScale(21), marginTop: moderateScale(6), textAlign: 'center' },
  content: { padding: moderateScale(14), paddingBottom: moderateScale(110) },
  section: { backgroundColor: COLORS.white, borderRadius: 8, padding: moderateScale(14), marginBottom: moderateScale(12) },
  sectionTitle: { fontFamily: FONTS.bold, fontSize: fontScale(17), color: COLORS.dark, marginBottom: moderateScale(10) },
  searchBox: { minHeight: moderateScale(48), borderWidth: 1, borderColor: COLORS.grayLight, borderRadius: 8, paddingLeft: moderateScale(11), paddingRight: moderateScale(5), flexDirection: 'row', alignItems: 'center', gap: moderateScale(8), marginBottom: moderateScale(8) },
  searchInput: { flex: 1, height: moderateScale(45), fontFamily: FONTS.regular, color: COLORS.dark, fontSize: fontScale(14), lineHeight: fontScale(24), margin: 0, paddingVertical: 0, includeFontPadding: true, textAlignVertical: 'center' },
  searchIconButton: { width: moderateScale(34), height: moderateScale(34), alignItems: 'center', justifyContent: 'center' },
  scanButton: { width: moderateScale(38), height: moderateScale(38), borderRadius: 8, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  productRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: moderateScale(10), borderBottomWidth: 1, borderBottomColor: COLORS.grayLight },
  productRowSelected: { backgroundColor: COLORS.primary + '08' },
  productIcon: { width: moderateScale(38), height: moderateScale(38), borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary + '12', marginRight: moderateScale(10) },
  productIconSelected: { backgroundColor: COLORS.primary },
  productInfo: { flex: 1 },
  productName: { fontFamily: FONTS.bold, fontSize: fontScale(13), color: COLORS.dark },
  productMeta: { fontFamily: FONTS.regular, fontSize: fontScale(10), color: COLORS.gray, marginTop: 2 },
  label: { fontFamily: FONTS.medium, fontSize: fontScale(12), color: COLORS.dark, marginTop: moderateScale(12), marginBottom: moderateScale(5) },
  input: { minHeight: moderateScale(44), borderWidth: 1, borderColor: COLORS.grayLight, borderRadius: 8, paddingHorizontal: moderateScale(12), fontFamily: FONTS.regular, color: COLORS.dark, fontSize: fontScale(14), backgroundColor: COLORS.white },
  twoColumns: { flexDirection: 'row', gap: moderateScale(10) },
  column: { flex: 1 },
  dateButton: { minHeight: moderateScale(44), borderWidth: 1, borderColor: COLORS.grayLight, borderRadius: 8, paddingHorizontal: moderateScale(12), flexDirection: 'row', alignItems: 'center', gap: moderateScale(8) },
  dateText: { fontFamily: FONTS.bold, color: COLORS.dark, fontSize: fontScale(13) },
  noteInput: { minHeight: moderateScale(78), textAlignVertical: 'top', paddingTop: moderateScale(10) },
  summary: { backgroundColor: COLORS.primary, borderRadius: 8, padding: moderateScale(16) },
  summaryLabel: { fontFamily: FONTS.medium, color: COLORS.white + 'BB', fontSize: fontScale(12) },
  summaryValue: { fontFamily: FONTS.bold, color: COLORS.white, fontSize: fontScale(24), marginTop: 4 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: moderateScale(14), backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.grayLight },
  submitButton: { minHeight: moderateScale(50), borderRadius: 8, backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: moderateScale(8) },
  submitText: { fontFamily: FONTS.bold, color: COLORS.white, fontSize: fontScale(15) },
  disabledButton: { opacity: 0.65 },
});

export default StockInScreen;
