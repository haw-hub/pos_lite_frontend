// src/screens/pos/POSScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { useProductStore } from '../../store/productStore';
import { useCartStore } from '../../store/cartStore';
import { COLORS, SIZES, FONTS } from '../../config/theme';
import { getButtonHeight, moderateScale, scale } from '../../utils/responsive';
import { formatCurrency } from '../../utils/currency';
import { Product } from '../../types';

export const POSScreen = ({ navigation }: any) => {
  const { products, fetchProducts, searchProducts } = useProductStore();
  const { items, total, addToCart, updateQuantity, removeFromCart } = useCartStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isCartVisible, setIsCartVisible] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const renderProductItem = ({ item }: { item: Product }) => (
    <TouchableOpacity
      style={styles.productCard}
      onPress={() => addToCart(item)}
    >
      <Text style={styles.productName}>{item.name}</Text>
      <Text style={styles.productPrice}>{formatCurrency(item.price)}</Text>
      <Text style={[
        styles.productStock,
        item.stock < 10 && styles.lowStockText
      ]}>
        ကျန်: {item.stock}
      </Text>
    </TouchableOpacity>
  );

  const renderCartItem = ({ item }: any) => (
    <View style={styles.cartItem}>
      <View style={styles.cartItemInfo}>
        <Text style={styles.cartItemName}>{item.product.name}</Text>
        <Text style={styles.cartItemPrice}>
          {formatCurrency(item.product.price)} x {item.quantity}
        </Text>
        <Text style={styles.cartItemTotal}>
          {formatCurrency(item.totalPrice)}
        </Text>
      </View>
      <View style={styles.cartItemActions}>
        <TouchableOpacity
          style={styles.qtyButton}
          onPress={() => updateQuantity(item.product.id, item.quantity - 1)}
        >
          <Text style={styles.qtyButtonText}>-</Text>
        </TouchableOpacity>
        <Text style={styles.qtyText}>{item.quantity}</Text>
        <TouchableOpacity
          style={styles.qtyButton}
          onPress={() => updateQuantity(item.product.id, item.quantity + 1)}
        >
          <Text style={styles.qtyButtonText}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => removeFromCart(item.product.id)}
        >
          <Text style={styles.deleteButtonText}>ဖျက်</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="ပစ္စည်းရှာရန် (အမည် သို့မဟုတ် ဘားကုဒ်)..."
          placeholderTextColor={COLORS.gray}
          value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            if (text) {
              searchProducts(text);
            } else {
              fetchProducts();
            }
          }}
        />
      </View>

      {/* Products Grid */}
      <FlatList
        data={products}
        renderItem={renderProductItem}
        keyExtractor={(item) => item.id.toString()}
        numColumns={3}
        contentContainerStyle={styles.productGrid}
        columnWrapperStyle={styles.productRow}
      />

      {/* Cart Button (Floating) */}
      {items.length > 0 && (
        <TouchableOpacity
          style={styles.cartButton}
          onPress={() => setIsCartVisible(true)}
        >
          <Text style={styles.cartButtonText}>
            🛒 {items.reduce((sum: any, i: { quantity: any; }) => sum + i.quantity, 0)} | {formatCurrency(total)}
          </Text>
        </TouchableOpacity>
      )}

      {/* Cart Modal */}
      <Modal
        visible={isCartVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsCartVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>ဈေးခြင်း</Text>
              <TouchableOpacity onPress={() => setIsCartVisible(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={items}
              renderItem={renderCartItem}
              keyExtractor={(item) => item.product.id.toString()}
              style={styles.cartList}
            />

            <View style={styles.modalFooter}>
              <Text style={styles.totalLabel}>စုစုပေါင်း</Text>
              <Text style={styles.totalAmount}>{formatCurrency(total)}</Text>
              <TouchableOpacity
                style={styles.checkoutButton}
                onPress={() => {
                  setIsCartVisible(false);
                  navigation.navigate('Checkout');
                }}
              >
                <Text style={styles.checkoutButtonText}>ငွေရှင်းမည်</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.light,
  },
  searchBar: {
    backgroundColor: COLORS.white,
    padding: moderateScale(10),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLight,
  },
  searchInput: {
    height: moderateScale(45),
    borderWidth: 1,
    borderColor: COLORS.grayLight,
    borderRadius: moderateScale(8),
    paddingHorizontal: moderateScale(15),
    fontSize: moderateScale(16),
    fontFamily: FONTS.regular,
  },
  productGrid: {
    padding: moderateScale(10),
  },
  productRow: {
    justifyContent: 'space-between',
    marginBottom: moderateScale(10),
  },
  productCard: {
    width: '31%',
    backgroundColor: COLORS.white,
    borderRadius: moderateScale(10),
    padding: moderateScale(12),
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowOpacity: 0.1 },
      android: { elevation: 2 },
    }),
  },
  productName: {
    fontSize: moderateScale(14),
    fontFamily: FONTS.medium,
    textAlign: 'center',
    marginBottom: moderateScale(5),
  },
  productPrice: {
    fontSize: moderateScale(16),
    fontFamily: FONTS.bold,
    color: COLORS.primary,
    marginBottom: moderateScale(3),
  },
  productStock: {
    fontSize: moderateScale(12),
    fontFamily: FONTS.regular,
    color: COLORS.gray,
  },
  lowStockText: {
    color: COLORS.warning,
  },
  cartButton: {
    position: 'absolute',
    bottom: moderateScale(20),
    right: moderateScale(20),
    left: moderateScale(20),
    height: getButtonHeight('normal'),
    backgroundColor: COLORS.primary,
    borderRadius: moderateScale(30),
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowOpacity: 0.3 },
      android: { elevation: 5 },
    }),
  },
  cartButtonText: {
    color: COLORS.white,
    fontSize: moderateScale(18),
    fontFamily: FONTS.bold,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: moderateScale(20),
    borderTopRightRadius: moderateScale(20),
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: moderateScale(15),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLight,
  },
  modalTitle: {
    fontSize: moderateScale(20),
    fontFamily: FONTS.bold,
  },
  closeButton: {
    fontSize: moderateScale(24),
    fontFamily: FONTS.bold,
    color: COLORS.gray,
  },
  cartList: {
    maxHeight: '70%',
  },
  cartItem: {
    padding: moderateScale(12),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLight,
  },
  cartItemInfo: {
    marginBottom: moderateScale(8),
  },
  cartItemName: {
    fontSize: moderateScale(16),
    fontFamily: FONTS.medium,
  },
  cartItemPrice: {
    fontSize: moderateScale(12),
    color: COLORS.gray,
  },
  cartItemTotal: {
    fontSize: moderateScale(14),
    color: COLORS.primary,
    fontFamily: FONTS.bold,
  },
  cartItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyButton: {
    width: moderateScale(35),
    height: moderateScale(35),
    backgroundColor: COLORS.light,
    borderRadius: moderateScale(5),
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyButtonText: {
    fontSize: moderateScale(20),
    fontFamily: FONTS.bold,
  },
  qtyText: {
    fontSize: moderateScale(16),
    marginHorizontal: moderateScale(15),
    minWidth: moderateScale(30),
    textAlign: 'center',
    fontFamily: FONTS.medium,
  },
  deleteButton: {
    backgroundColor: COLORS.danger,
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(6),
    borderRadius: moderateScale(5),
    marginLeft: moderateScale(10),
  },
  deleteButtonText: {
    color: COLORS.white,
    fontSize: moderateScale(12),
    fontFamily: FONTS.medium,
  },
  modalFooter: {
    padding: moderateScale(15),
    borderTopWidth: 1,
    borderTopColor: COLORS.grayLight,
  },
  totalLabel: {
    fontSize: moderateScale(16),
    fontFamily: FONTS.regular,
  },
  totalAmount: {
    fontSize: moderateScale(24),
    fontFamily: FONTS.bold,
    color: COLORS.primary,
    marginVertical: moderateScale(5),
  },
  checkoutButton: {
    height: getButtonHeight('normal'),
    backgroundColor: COLORS.success,
    borderRadius: moderateScale(10),
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: moderateScale(10),
  },
  checkoutButtonText: {
    color: COLORS.white,
    fontSize: moderateScale(18),
    fontFamily: FONTS.bold,
  },
});