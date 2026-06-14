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
  Alert,
  ActivityIndicator,
  Vibration,
} from 'react-native';
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

  const renderProductItem = ({ item }: { item: Product }) => (
    <TouchableOpacity
      style={[
        styles.productCard,
        item.stock === 0 && styles.productCardDisabled
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
      <Text style={[
        styles.productName,
        item.stock === 0 && styles.textDisabled
      ]}>
        {item.name}
      </Text>
      <Text style={[
        styles.productPrice,
        item.stock === 0 && styles.textDisabled
      ]}>
        {formatCurrency(item.price)}
      </Text>
      {item.barcode && (
        <View style={styles.barcodeBadge}>
          <Ionicons name="barcode-outline" size={10} color={item.stock === 0 ? COLORS.gray : COLORS.gray} />
          <Text style={[styles.barcodeText, item.stock === 0 && styles.textDisabled]}>
            {item.barcode}
          </Text>
        </View>
      )}
      <Text style={[
        styles.productStock,
        item.stock < 10 && item.stock > 0 && styles.lowStockText,
        item.stock === 0 && styles.outOfStockText
      ]}>
        {item.stock === 0 ? 'ကုန်သွားပြီ' : `ကျန်: ${item.stock}`}
      </Text>
    </TouchableOpacity>
  );

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
          <TouchableOpacity onPress={() => setScannerVisible(true)}>
            <Ionicons name="barcode-outline" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={products}
        renderItem={renderProductItem}
        keyExtractor={(item) => item.id.toString()}
        numColumns={3}
        contentContainerStyle={styles.productGrid}
        columnWrapperStyle={styles.productRow}
      />

      {/* Cart Button (Bottom) */}
      {items.length > 0 && (
        <TouchableOpacity
          style={styles.cartButton}
          onPress={() => setIsCartVisible(true)}
        >
          <Text style={styles.cartButtonText}>
            🛒 {items.reduce((sum, i) => sum + i.quantity, 0)} | {formatCurrency(total)}
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
                      <Text style={styles.qtyButtonText}>-</Text>
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
    backgroundColor: COLORS.light,
  },
  searchBar: {
    backgroundColor: COLORS.white,
    padding: moderateScale(10),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLight,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.light,
    borderRadius: moderateScale(8),
    paddingHorizontal: moderateScale(12),
    gap: moderateScale(8),
  },
  searchInput: {
    flex: 1,
    height: moderateScale(45),
    fontSize: moderateScale(14),
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
      ios: { shadowOpacity: 0.1, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
      android: { elevation: 2 },
    }),
  },
  productCardDisabled: {
    opacity: 0.6,
    backgroundColor: COLORS.grayLight,
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
  barcodeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: moderateScale(3),
  },
  barcodeText: {
    fontSize: moderateScale(10),
    fontFamily: FONTS.regular,
    color: COLORS.gray,
  },
  productStock: {
    fontSize: moderateScale(12),
    fontFamily: FONTS.regular,
    color: COLORS.gray,
  },
  lowStockText: {
    color: COLORS.warning,
    fontWeight: 'bold',
  },
  outOfStockText: {
    color: COLORS.danger,
    fontWeight: 'bold',
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
    borderRadius: moderateScale(30),
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowOpacity: 0.3, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
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
});
