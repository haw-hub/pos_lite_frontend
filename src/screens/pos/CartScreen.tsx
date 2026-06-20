// src/screens/pos/CartScreen.tsx
import React from 'react';
import {
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CartItem, useCartStore } from '../../store/cartStore';
import { formatCurrency } from '../../utils/currency';
import { COLORS, FONTS } from '../../config/theme';
import { fontScale, moderateScale } from '../../utils/responsive';

export const CartScreen = ({ navigation }: any) => {
  const { items, total, itemCount, updateQuantity, removeFromCart, clearCart } = useCartStore();

  const confirmClear = () => {
    Alert.alert('စျေးခြင်းဖျက်မည်', 'စျေးခြင်းထဲရှိပစ္စည်းအားလုံး ဖျက်မည်လား', [
      { text: 'မလုပ်တော့ပါ', style: 'cancel' },
      { text: 'ဖျက်မည်', style: 'destructive', onPress: clearCart },
    ]);
  };

  const changeQuantity = (item: CartItem, quantity: number) => {
    const ok = updateQuantity(item.product.id, quantity);
    if (!ok) {
      Alert.alert('Stock မလုံလောက်ပါ', `${item.product.name} က ${item.product.stock} ${item.product.unitName || 'ခု'} သာကျန်ပါသည်`);
    }
  };

  const renderItem = ({ item }: { item: CartItem }) => (
    <View style={styles.cartCard}>
      <View style={styles.itemTop}>
        <View style={styles.itemIcon}>
          <Ionicons name="cube-outline" size={22} color={COLORS.primary} />
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={2}>{item.product.name}</Text>
          <Text style={styles.itemMeta} numberOfLines={1}>
            {formatCurrency(item.unitPrice)} / {item.unitLabel}
            {item.priceType !== 'RETAIL' ? ` • ${item.priceType}` : ''}
          </Text>
          {item.product.barcode ? (
            <View style={styles.barcodeRow}>
              <Ionicons name="barcode-outline" size={12} color={COLORS.gray} />
              <Text style={styles.barcodeText} numberOfLines={1}>{item.product.barcode}</Text>
            </View>
          ) : null}
        </View>
        <TouchableOpacity style={styles.removeButton} onPress={() => removeFromCart(item.product.id)} activeOpacity={1}>
          <Ionicons name="trash-outline" size={19} color={COLORS.danger} />
        </TouchableOpacity>
      </View>

      <View style={styles.itemBottom}>
        <View style={styles.qtyGroup}>
          <TouchableOpacity style={styles.qtyButton} onPress={() => changeQuantity(item, item.quantity - 1)} activeOpacity={1}>
            <Ionicons name="remove" size={18} color={COLORS.primary} />
          </TouchableOpacity>
          <View style={styles.qtyValueBox}>
            <Text style={styles.qtyValue}>{item.quantity}</Text>
          </View>
          <TouchableOpacity style={styles.qtyButton} onPress={() => changeQuantity(item, item.quantity + 1)} activeOpacity={1}>
            <Ionicons name="add" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.lineTotal}>
          <Text style={styles.lineTotalLabel}>စုစုပေါင်း</Text>
          <Text style={styles.lineTotalValue}>{formatCurrency(item.totalPrice)}</Text>
        </View>
      </View>
    </View>
  );

  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Ionicons name="cart-outline" size={54} color={COLORS.primary} />
        </View>
        <Text style={styles.emptyTitle}>စျေးခြင်းထဲတွင် ပစ္စည်းမရှိပါ</Text>
        <Text style={styles.emptySubtitle}>POS screen မှ product ရွေးပြီး စျေးခြင်းထဲထည့်ပါ</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('POS')} activeOpacity={1}>
          <Ionicons name="storefront-outline" size={19} color={COLORS.white} />
          <Text style={styles.primaryButtonText}>POS သို့သွားမည်</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={item => `${item.product.id}-${item.priceType}-${item.unitLabel}`}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>စျေးခြင်း</Text>
              <Text style={styles.subtitle}>{itemCount} ခု ရွေးထားသည်</Text>
            </View>
            <TouchableOpacity style={styles.clearButton} onPress={confirmClear} activeOpacity={1}>
              <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
              <Text style={styles.clearText}>ရှင်းမည်</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <View style={styles.footer}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>စုစုပေါင်း</Text>
          <Text style={styles.summaryValue}>{formatCurrency(total)}</Text>
        </View>
        <TouchableOpacity style={styles.checkoutButton} onPress={() => navigation.navigate('Checkout')} activeOpacity={1}>
          <Text style={styles.checkoutText}>ငွေရှင်းမည်</Text>
          <Ionicons name="arrow-forward" size={20} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F8' },
  listContent: { padding: moderateScale(14), paddingBottom: moderateScale(132) },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: moderateScale(12) },
  title: { fontFamily: FONTS.bold, fontSize: fontScale(22), color: COLORS.dark, lineHeight: fontScale(34), includeFontPadding: true },
  subtitle: { fontFamily: FONTS.regular, fontSize: fontScale(13), color: COLORS.gray },
  clearButton: { minHeight: moderateScale(38), flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: moderateScale(12), borderRadius: 8, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.danger + '30' },
  clearText: { fontFamily: FONTS.bold, color: COLORS.danger, fontSize: fontScale(12) },
  cartCard: { backgroundColor: COLORS.white, borderRadius: 8, padding: moderateScale(12), marginBottom: moderateScale(10), borderWidth: 1, borderColor: '#E8EDF3', ...Platform.select({ android: { elevation: 1 }, ios: { shadowOpacity: 0.04, shadowRadius: 3 } }) },
  itemTop: { flexDirection: 'row', alignItems: 'center' },
  itemIcon: { width: moderateScale(44), height: moderateScale(44), borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary + '10' },
  itemInfo: { flex: 1, marginLeft: moderateScale(10) },
  itemName: { fontFamily: FONTS.bold, color: COLORS.dark, fontSize: fontScale(15), lineHeight: fontScale(24), includeFontPadding: true },
  itemMeta: { fontFamily: FONTS.medium, color: COLORS.gray, fontSize: fontScale(12), marginTop: 2 },
  barcodeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  barcodeText: { flex: 1, fontFamily: FONTS.regular, color: COLORS.gray, fontSize: fontScale(10) },
  removeButton: { width: moderateScale(38), height: moderateScale(38), borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.danger + '10' },
  itemBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: moderateScale(12), paddingTop: moderateScale(12), borderTopWidth: 1, borderTopColor: COLORS.grayLight },
  qtyGroup: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F4F6F8', borderRadius: 8, padding: 4 },
  qtyButton: { width: moderateScale(34), height: moderateScale(34), alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white, borderRadius: 7 },
  qtyValueBox: { minWidth: moderateScale(42), alignItems: 'center' },
  qtyValue: { fontFamily: FONTS.bold, color: COLORS.dark, fontSize: fontScale(15) },
  lineTotal: { alignItems: 'flex-end' },
  lineTotalLabel: { fontFamily: FONTS.regular, color: COLORS.gray, fontSize: fontScale(11) },
  lineTotalValue: { fontFamily: FONTS.bold, color: COLORS.primary, fontSize: fontScale(16), marginTop: 2 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: COLORS.white, padding: moderateScale(14), borderTopWidth: 1, borderTopColor: COLORS.grayLight },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: moderateScale(10) },
  summaryLabel: { fontFamily: FONTS.medium, color: COLORS.gray, fontSize: fontScale(13) },
  summaryValue: { fontFamily: FONTS.bold, color: COLORS.dark, fontSize: fontScale(22) },
  checkoutButton: { minHeight: moderateScale(50), borderRadius: 8, backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  checkoutText: { fontFamily: FONTS.bold, color: COLORS.white, fontSize: fontScale(16) },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: moderateScale(24), backgroundColor: '#F4F6F8' },
  emptyIcon: { width: moderateScale(92), height: moderateScale(92), borderRadius: 18, backgroundColor: COLORS.primary + '10', alignItems: 'center', justifyContent: 'center', marginBottom: moderateScale(18) },
  emptyTitle: { fontFamily: FONTS.bold, color: COLORS.dark, fontSize: fontScale(18), textAlign: 'center', lineHeight: fontScale(29), includeFontPadding: true },
  emptySubtitle: { fontFamily: FONTS.regular, color: COLORS.gray, fontSize: fontScale(13), textAlign: 'center', marginTop: 5, marginBottom: moderateScale(18), lineHeight: fontScale(21) },
  primaryButton: { minHeight: moderateScale(46), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: moderateScale(18), borderRadius: 8, backgroundColor: COLORS.primary },
  primaryButtonText: { fontFamily: FONTS.bold, color: COLORS.white, fontSize: fontScale(14) },
});

export default CartScreen;
