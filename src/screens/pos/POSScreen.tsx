// src/screens/pos/POSScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
  Alert,
  ActivityIndicator,
  Vibration,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useProductStore } from '../../store/productStore';
import { useCartStore } from '../../store/cartStore';
import { BarcodeScanner } from '../../components/BarcodeScanner';
import { COLORS, FONTS } from '../../config/theme';
import { getButtonHeight, moderateScale } from '../../utils/responsive';
import { formatCurrency } from '../../utils/currency';
import { Product } from '../../types';

export const POSScreen = ({ navigation }: any) => {
  const { products, fetchProducts, searchProducts } = useProductStore();
  const { items, total, addToCart, updateQuantity, removeFromCart } = useCartStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isCartVisible, setIsCartVisible] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [successSound, setSuccessSound] = useState<Audio.Sound | null>(null);
  const [errorSound, setErrorSound] = useState<Audio.Sound | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchProducts();
    loadSounds();
    
    return () => {
      if (successSound) {
        successSound.unloadAsync();
      }
      if (errorSound) {
        errorSound.unloadAsync();
      }
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProducts();
    }, [fetchProducts])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProducts();
    setRefreshing(false);
  };

  const loadSounds = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      
      const { sound: success } = await Audio.Sound.createAsync(
        require('../../assets/sounds/success-beep.mp3'),
        { 
          shouldPlay: false,
          volume: 1.0,
          isLooping: false,
        }
      );
      setSuccessSound(success);
      
      const { sound: error } = await Audio.Sound.createAsync(
        require('../../assets/sounds/error-beep.mp3'),
        { 
          shouldPlay: false,
          volume: 1.0,
          isLooping: false,
        }
      );
      setErrorSound(error);
      
      console.log('✅ Sounds loaded successfully');
    } catch (error) {
      console.log('Error loading sounds:', error);
    }
  };

  const playBeep = async (success: boolean = true) => {
    try {
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        Vibration.vibrate(success ? 50 : 200);
      }
      
      if (success && successSound) {
        await successSound.replayAsync();
      } else if (!success && errorSound) {
        await errorSound.replayAsync();
      }
    } catch (error) {
      console.log('Error playing beep:', error);
    }
  };

  const addProductToCart = async (product: Product): Promise<boolean> => {
    if (!product.costPrice || product.costPrice <= 0) {
      await playBeep(false);
      Alert.alert(
        'အရင်းဈေးလိုအပ်ပါသည်',
        `${product.name} အတွက် အရင်းဈေးအရင်ဖြည့်ပြီးမှ ရောင်းနိုင်ပါမည်။`
      );
      return false;
    }

    const expired = product.expiryDate
      ? new Date(`${product.expiryDate}T23:59:59`).getTime() < Date.now()
      : false;
    if (expired) {
      await playBeep(false);
      Alert.alert('သက်တမ်းကုန်ပြီး', `${product.name} သည် ${product.expiryDate} တွင် သက်တမ်းကုန်ပြီးဖြစ်သည်`);
      return false;
    }
    const added = addToCart(product);
    if (!added) {
      await playBeep(false);
      Alert.alert(
        'Stock မလုံလောက်ပါ',
        `${product.name} သည် ${product.stock} ခုသာ ကျန်ရှိပါသည်`
      );
      return false;
    }
    await playBeep(true);
    return true;
  };

  const handleBarcodeScan = async (barcode: string): Promise<Product | null> => {
    setIsLoading(true);
    
    try {
      const matchedProduct = products.find(p => p.barcode === barcode);
      
      if (matchedProduct) {
        if (matchedProduct.stock <= 0) {
          await playBeep(false);
          Alert.alert('မရနိုင်ပါ', `${matchedProduct.name} ပစ္စည်း ကုန်သွားပါပြီ`);
          return null;
        }
        
        const added = await addProductToCart(matchedProduct);
        if (!added) return null;
        console.log(`✅ Added ${matchedProduct.name} to cart`);
        return matchedProduct;
        
      } else {
        await playBeep(false);
        Alert.alert('❌ မတွေ့ပါ', `ဘားကုဒ် ${barcode} အတွက် ပစ္စည်းမတွေ့ပါ`);
        return null;
      }
    } catch (error) {
      console.error('Barcode scan error:', error);
      await playBeep(false);
      Alert.alert('အမှား', 'ဘားကုဒ် ဖတ်ရှုရာတွင် အမှားရှိပါသည်');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // NEW: Handle "ဈေးခြင်း" button from scanner - opens cart modal
  const handleGoToCartFromScanner = () => {
    setScannerVisible(false);
    setIsCartVisible(true);
  };

  const renderProductItem = ({ item }: { item: Product }) => {
    const cartQuantity = items.find(cartItem => cartItem.product.id === item.id)?.quantity || 0;
    const unavailable = item.stock === 0 || !item.costPrice || item.costPrice <= 0;
    return (
      <TouchableOpacity
      style={[
        styles.productCard,
        unavailable && styles.productCardDisabled
      ]}
      onPress={() => {
        if (item.stock > 0) {
          addProductToCart(item);
        } else {
          playBeep(false);
          Alert.alert('မရနိုင်ပါ', `${item.name} ပစ္စည်း ကုန်သွားပါပြီ`);
        }
      }}
      disabled={item.stock === 0}
    >
      <View style={styles.productCardTop}>
        <View style={styles.productAvatar}>
          <Ionicons name="cube-outline" size={22} color={COLORS.primary} />
        </View>
        <View style={[
          styles.stockBadge,
          { backgroundColor: item.stock === 0 ? COLORS.danger + '14' : item.stock < 10 ? COLORS.warning + '18' : '#E8F5EF' }
        ]}>
          <Text style={[
            styles.stockBadgeText,
            { color: item.stock === 0 ? COLORS.danger : item.stock < 10 ? '#9A6A00' : '#16845B' }
          ]}>
            {item.stock === 0 ? 'ကုန်ပြီ' : `${item.stock} ခု`}
          </Text>
        </View>
      </View>
      <Text style={[styles.productName, unavailable && styles.textDisabled]} numberOfLines={2}>
        {item.name}
      </Text>
      <Text style={[
        styles.productPrice,
        unavailable && styles.textDisabled
      ]}>
        {formatCurrency(item.price)}
      </Text>
      <View style={styles.productCardFooter}>
        <View style={styles.barcodeBadge}>
          <Ionicons name={item.barcode ? 'barcode-outline' : 'pricetag-outline'} size={12} color={COLORS.gray} />
          <Text style={styles.barcodeText} numberOfLines={1}>
            {item.barcode || 'Barcode မရှိ'}
          </Text>
        </View>
        <View style={[styles.addIcon, cartQuantity > 0 && styles.addIconActive]}>
          <Ionicons name={cartQuantity > 0 ? 'checkmark' : 'add'} size={18} color={cartQuantity > 0 ? COLORS.white : COLORS.primary} />
        </View>
      </View>
      {cartQuantity > 0 && (
        <View style={styles.inCartBadge}>
          <Text style={styles.inCartText}>ဈေးခြင်းထဲ {cartQuantity} ခု</Text>
        </View>
      )}
      {!item.costPrice || item.costPrice <= 0 ? (
        <Text style={styles.costMissingText}>အရင်းဈေးဖြည့်ရန်လို</Text>
      ) : null}
    </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color={COLORS.gray} />
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
          {searchQuery ? (
            <TouchableOpacity onPress={() => { setSearchQuery(''); fetchProducts(); }}>
              <Ionicons name="close-circle" size={21} color={COLORS.gray} />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.scanHeaderButton}
          onPress={() => setScannerVisible(true)}
          accessibilityLabel="Barcode scan"
        >
          <Ionicons name="barcode-outline" size={24} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={products}
        renderItem={renderProductItem}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        contentContainerStyle={styles.productGrid}
        columnWrapperStyle={styles.productRow}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        ListEmptyComponent={
          <View style={styles.emptyProducts}>
            <Ionicons name="search-outline" size={42} color={COLORS.gray} />
            <Text style={styles.emptyProductsText}>ပစ္စည်းမတွေ့ပါ</Text>
          </View>
        }
      />

      {/* Cart Button (Bottom) */}
      {items.length > 0 && (
        <TouchableOpacity
          style={styles.cartButton}
          onPress={() => setIsCartVisible(true)}
        >
          <View style={styles.cartButtonCount}>
            <Ionicons name="cart" size={20} color={COLORS.white} />
            <Text style={styles.cartCountText}>{items.reduce((sum, i) => sum + i.quantity, 0)}</Text>
          </View>
          <View style={styles.cartButtonInfo}>
            <Text style={styles.cartButtonLabel}>ဈေးခြင်းကြည့်ရန်</Text>
            <Text style={styles.cartButtonText}>{formatCurrency(total)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={COLORS.white} />
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
                <Ionicons name="close" size={25} color={COLORS.dark} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={items}
              renderItem={({ item }) => (
                <View style={styles.cartItem}>
                  <View style={styles.cartItemInfo}>
                    <Text style={styles.cartItemName}>{item.product.name}</Text>
                    {item.product.barcode && (
                      <Text style={styles.cartItemBarcode}>{item.product.barcode}</Text>
                    )}
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
                      <Ionicons name="remove" size={19} color={COLORS.dark} />
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{item.quantity}</Text>
                    <TouchableOpacity
                      style={styles.qtyButton}
                      onPress={() => {
                        const updated = updateQuantity(item.product.id, item.quantity + 1);
                        if (!updated) {
                          playBeep(false);
                          Alert.alert(
                            'Stock မလုံလောက်ပါ',
                            `${item.product.name} သည် ${item.product.stock} ခုသာ ကျန်ရှိပါသည်`
                          );
                        }
                      }}
                    >
                      <Ionicons name="add" size={19} color={COLORS.dark} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => removeFromCart(item.product.id)}
                    >
                      <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
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

      {/* Barcode Scanner */}
      <BarcodeScanner
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScan={handleBarcodeScan}
        onGoToCart={handleGoToCartFromScanner}
        cartItems={items}
        cartTotal={total}
      />

      {/* Loading Overlay - only shown when needed */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>ဖတ်နေပါသည်...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6F8',
  },
  scanHeaderButton: {
    width: moderateScale(45),
    height: moderateScale(45),
    borderRadius: moderateScale(8),
    backgroundColor: COLORS.white + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: moderateScale(15),
    paddingTop: moderateScale(10),
    paddingBottom: moderateScale(14),
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(10),
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: moderateScale(8),
    paddingHorizontal: moderateScale(12),
    gap: moderateScale(8),
  },
  searchInput: {
    flex: 1,
    height: moderateScale(45),
    fontSize: moderateScale(14),
    fontFamily: FONTS.regular,
    color: COLORS.dark,
  },
  productGrid: {
    paddingHorizontal: moderateScale(10),
    paddingTop: moderateScale(12),
    paddingBottom: moderateScale(95),
  },
  productRow: {
    justifyContent: 'space-between',
    gap: moderateScale(10),
  },
  productCard: {
    flex: 1,
    minHeight: moderateScale(164),
    backgroundColor: COLORS.white,
    borderRadius: moderateScale(8),
    padding: moderateScale(12),
    marginBottom: moderateScale(10),
    borderWidth: 1,
    borderColor: '#E9EDF2',
    ...Platform.select({
      ios: { shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
      android: { elevation: 1 },
    }),
  },
  productCardDisabled: {
    backgroundColor: '#F2F3F5',
  },
  productCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: moderateScale(9),
  },
  productAvatar: {
    width: moderateScale(38),
    height: moderateScale(38),
    borderRadius: moderateScale(8),
    backgroundColor: COLORS.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stockBadge: {
    paddingHorizontal: moderateScale(7),
    paddingVertical: moderateScale(4),
    borderRadius: moderateScale(6),
  },
  stockBadgeText: {
    fontSize: moderateScale(9),
    fontFamily: FONTS.bold,
  },
  productName: {
    minHeight: moderateScale(38),
    fontSize: moderateScale(13),
    lineHeight: moderateScale(18),
    fontFamily: FONTS.bold,
    color: COLORS.dark,
    marginBottom: moderateScale(5),
  },
  productPrice: {
    fontSize: moderateScale(14),
    fontFamily: FONTS.bold,
    color: COLORS.primary,
    marginBottom: moderateScale(9),
  },
  productCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'auto',
  },
  barcodeBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: moderateScale(6),
  },
  barcodeText: {
    flex: 1,
    fontSize: moderateScale(8),
    fontFamily: FONTS.regular,
    color: COLORS.gray,
  },
  addIcon: {
    width: moderateScale(30),
    height: moderateScale(30),
    borderRadius: moderateScale(8),
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIconActive: {
    backgroundColor: COLORS.primary,
  },
  inCartBadge: {
    marginTop: moderateScale(7),
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary + '10',
    paddingHorizontal: moderateScale(6),
    paddingVertical: moderateScale(3),
    borderRadius: moderateScale(5),
  },
  inCartText: {
    fontSize: moderateScale(8),
    fontFamily: FONTS.medium,
    color: COLORS.primary,
  },
  costMissingText: {
    marginTop: moderateScale(6),
    fontSize: moderateScale(8),
    fontFamily: FONTS.medium,
    color: COLORS.danger,
  },
  textDisabled: {
    color: COLORS.gray,
  },
  cartButton: {
    position: 'absolute',
    bottom: moderateScale(20),
    right: moderateScale(20),
    left: moderateScale(20),
    height: getButtonHeight('normal'),
    backgroundColor: COLORS.primary,
    borderRadius: moderateScale(10),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: moderateScale(14),
    ...Platform.select({
      ios: { shadowOpacity: 0.3, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 5 },
    }),
  },
  cartButtonText: {
    color: COLORS.white,
    fontSize: moderateScale(15),
    fontFamily: FONTS.bold,
  },
  cartButtonCount: {
    minWidth: moderateScale(48),
    height: moderateScale(38),
    paddingHorizontal: moderateScale(8),
    borderRadius: moderateScale(8),
    backgroundColor: COLORS.white + '18',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: moderateScale(4),
  },
  cartCountText: {
    color: COLORS.white,
    fontSize: moderateScale(12),
    fontFamily: FONTS.bold,
  },
  cartButtonInfo: {
    flex: 1,
    marginLeft: moderateScale(11),
  },
  cartButtonLabel: {
    fontSize: moderateScale(9),
    fontFamily: FONTS.regular,
    color: COLORS.white + 'B8',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: moderateScale(14),
    borderTopRightRadius: moderateScale(14),
    maxHeight: '86%',
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
  cartItemBarcode: {
    fontSize: moderateScale(11),
    fontFamily: FONTS.regular,
    color: COLORS.gray,
    marginTop: 2,
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
    justifyContent: 'flex-end',
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
    width: moderateScale(35),
    height: moderateScale(35),
    backgroundColor: COLORS.danger + '12',
    borderRadius: moderateScale(6),
    marginLeft: moderateScale(10),
    alignItems: 'center',
    justifyContent: 'center',
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
    borderRadius: moderateScale(8),
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: moderateScale(10),
  },
  checkoutButtonText: {
    color: COLORS.white,
    fontSize: moderateScale(18),
    fontFamily: FONTS.bold,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: moderateScale(10),
    color: COLORS.white,
    fontSize: moderateScale(16),
    fontFamily: FONTS.regular,
  },
  emptyProducts: {
    alignItems: 'center',
    paddingVertical: moderateScale(60),
  },
  emptyProductsText: {
    marginTop: moderateScale(10),
    color: COLORS.gray,
    fontFamily: FONTS.regular,
    fontSize: moderateScale(12),
  },
});
