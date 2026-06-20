// src/components/BarcodeScanner.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Vibration,
  Animated,
  Dimensions,
  Platform,
  ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../config/theme';
import { moderateScale, fontScale } from '../utils/responsive';
import { formatCurrency } from '../utils/currency';
import { Product } from '../types';
import { CartItem } from '../store/cartStore';

const { width: screenWidth } = Dimensions.get('window');

interface BarcodeScannerProps {
  visible: boolean;
  onClose: () => void;
  onScan: (barcode: string) => Promise<Product | null>;
  onGoToCart?: () => void;  // Changed: Go to Cart Screen instead of Checkout
  cartItems?: CartItem[];
  cartTotal?: number;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  visible,
  onClose,
  onScan,
  onGoToCart,
  cartItems = [],
  cartTotal = 0,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [torchOn, setTorchOn] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastScannedProduct, setLastScannedProduct] = useState<Product | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanUnlockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processingRef = useRef(false);
  const lastScanRef = useRef<{ value: string; at: number } | null>(null);
  const [showCartPreview, setShowCartPreview] = useState(true);

  useEffect(() => {
    if (visible) {
      setScanning(true);
      setShowSuccess(false);
      setLastScannedProduct(null);
      setIsProcessing(false);
      processingRef.current = false;
      lastScanRef.current = null;
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (scanUnlockTimeoutRef.current) {
        clearTimeout(scanUnlockTimeoutRef.current);
        scanUnlockTimeoutRef.current = null;
      }
    }
  }, [visible]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (scanUnlockTimeoutRef.current) {
        clearTimeout(scanUnlockTimeoutRef.current);
      }
    };
  }, []);

  const showSuccessMessage = (product: Product) => {
    setLastScannedProduct(product);
    setShowSuccess(true);
    
    fadeAnim.setValue(0);
    slideAnim.setValue(-100);
    
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowSuccess(false);
        setLastScannedProduct(null);
      });
      timeoutRef.current = null;
    }, 2000);
  };

  useEffect(() => {
    if (visible && !permission?.granted) {
      requestPermission();
    }
  }, [visible]);

  const handleBarcodeScanned = async (data: any) => {
    const scannedValue = String(data.data ?? '');
    const now = Date.now();
    const lastScan = lastScanRef.current;
    if (
      !scanning ||
      processingRef.current ||
      !scannedValue ||
      (lastScan?.value === scannedValue && now - lastScan.at < 1500)
    ) {
      return;
    }

    processingRef.current = true;
    lastScanRef.current = { value: scannedValue, at: now };
    console.log('📷 Scanned barcode:', scannedValue);
    
    setIsProcessing(true);
    setScanning(false);
    
    Vibration.vibrate(50);
    
    try {
      const product = await onScan(scannedValue);
      
      if (product) {
        showSuccessMessage(product);
      }
    } catch (error) {
      console.error('Scan processing error:', error);
      Vibration.vibrate(200);
    } finally {
      if (scanUnlockTimeoutRef.current) {
        clearTimeout(scanUnlockTimeoutRef.current);
      }
      scanUnlockTimeoutRef.current = setTimeout(() => {
        processingRef.current = false;
        setScanning(true);
        setIsProcessing(false);
        scanUnlockTimeoutRef.current = null;
      }, 1200);
    }
  };

  const handleGoToCart = () => {
    onClose();
    if (onGoToCart) {
      onGoToCart();
    }
  };

  const toggleTorch = () => {
    setTorchOn(!torchOn);
  };

  const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  if (!permission) {
    return (
      <Modal visible={visible} transparent animationType="slide">
        <View style={styles.container}>
          <View style={styles.content}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.message}>ကင်မရာ ခွင့်ပြုချက် တောင်းဆိုနေပါသည်...</Text>
          </View>
        </View>
      </Modal>
    );
  }

  if (!permission.granted) {
    return (
      <Modal visible={visible} transparent animationType="slide">
        <View style={styles.container}>
          <View style={styles.content}>
            <Ionicons name="camera-outline" size={64} color={COLORS.danger} />
            <Text style={styles.message}>ကင်မရာ ခွင့်ပြုချက် လိုအပ်ပါသည်</Text>
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={requestPermission}
            >
              <Text style={styles.permissionButtonText}>ခွင့်ပြုမည်</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.permissionButton, { backgroundColor: COLORS.gray, marginTop: 10 }]}
              onPress={onClose}
            >
              <Text style={styles.permissionButtonText}>ပိတ်မည်</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <CameraView
          style={styles.camera}
          facing="back"
          onBarcodeScanned={scanning && !isProcessing ? handleBarcodeScanned : undefined}
          barcodeScannerSettings={{
            barcodeTypes: [
              'codabar',
              'code39',
              'code93',
              'code128',
              'ean8',
              'ean13',
              'itf14',
              'upc_a',
              'upc_e',
              'qr',
              'pdf417',
              'aztec',
              'datamatrix',
            ],
          }}
          enableTorch={torchOn}
        >
          <View style={styles.overlay}>
            <View style={styles.topOverlay} />
            <View style={styles.middleContainer}>
              <View style={styles.leftOverlay} />
              <View style={styles.scannerFrame}>
                <View style={styles.cornerTL} />
                <View style={styles.cornerTR} />
                <View style={styles.cornerBL} />
                <View style={styles.cornerBR} />
                <View style={styles.scannerLine} />
              </View>
              <View style={styles.rightOverlay} />
            </View>
            <View style={styles.bottomOverlay}>
              <Text style={styles.scanText}>
                ဘားကုဒ်ကို မျဉ်းအတွင်းထည့်ပါ
              </Text>
              <Text style={styles.scanSubText}>
                ဆက်လက် Scan လုပ်ရန် စက်ကို ဆက်ထားပါ
              </Text>
            </View>
          </View>

          {showCartPreview && cartItems.length > 0 && (
            <View style={styles.cartPreview}>
              <View style={styles.cartPreviewHeader}>
                <View style={styles.cartPreviewTitleContainer}>
                  <Ionicons name="cart-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.cartPreviewTitle}>ဈေးခြင်းထဲမှာ</Text>
                  <View style={styles.cartPreviewBadge}>
                    <Text style={styles.cartPreviewBadgeText}>{cartItemCount}</Text>
                  </View>
                </View>
                <TouchableOpacity 
                  onPress={() => setShowCartPreview(!showCartPreview)}
                  style={styles.cartPreviewToggle}
                >
                  <Ionicons name="chevron-up" size={18} color={COLORS.gray} />
                </TouchableOpacity>
              </View>
              <ScrollView 
                style={styles.cartPreviewList}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={true}
              >
                {cartItems.slice(0, 5).map((item, index) => (
                  <View key={index} style={styles.cartPreviewItem}>
                    <View style={styles.cartPreviewItemInfo}>
                      <Text style={styles.cartPreviewItemName} numberOfLines={1}>
                        {item.product.name}
                      </Text>
                      <Text style={styles.cartPreviewItemPrice}>
                        {formatCurrency(item.unitPrice)} x {item.quantity} {item.unitLabel}
                      </Text>
                    </View>
                    <Text style={styles.cartPreviewItemTotal}>
                      {formatCurrency(item.totalPrice)}
                    </Text>
                  </View>
                ))}
                {cartItems.length > 5 && (
                  <Text style={styles.cartPreviewMore}>
                    နောက်ထပ် {cartItems.length - 5} မျိုး...
                  </Text>
                )}
              </ScrollView>
              <View style={styles.cartPreviewFooter}>
                <Text style={styles.cartPreviewTotalLabel}>စုစုပေါင်း</Text>
                <Text style={styles.cartPreviewTotalAmount}>
                  {formatCurrency(cartTotal)}
                </Text>
              </View>
            </View>
          )}

          {(!showCartPreview || cartItems.length === 0) && cartItems.length > 0 && (
            <TouchableOpacity 
              style={styles.cartCollapsedButton}
              onPress={() => setShowCartPreview(true)}
            >
              <Ionicons name="cart-outline" size={22} color={COLORS.white} />
              <Text style={styles.cartCollapsedText}>
                ဈေးခြင်း ({cartItemCount}) - {formatCurrency(cartTotal)}
              </Text>
              <Ionicons name="chevron-down" size={18} color={COLORS.white} />
            </TouchableOpacity>
          )}

          <View style={styles.controls}>
            <TouchableOpacity style={styles.controlButton} onPress={onClose}>
              <Ionicons name="close" size={28} color={COLORS.white} />
              <Text style={styles.controlText}>ပိတ်မည်</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.controlButton} onPress={toggleTorch}>
              <Ionicons
                name={torchOn ? 'flash' : 'flash-off'}
                size={28}
                color={COLORS.white}
              />
              <Text style={styles.controlText}>မီး</Text>
            </TouchableOpacity>

            {cartItems.length > 0 && (
              <TouchableOpacity 
                style={[styles.controlButton, styles.cartButton]}
                onPress={handleGoToCart}
              >
                <Ionicons name="cart-outline" size={28} color={COLORS.white} />
                <Text style={styles.controlText}>ဈေးခြင်း</Text>
              </TouchableOpacity>
            )}
          </View>
        </CameraView>

        {/* Success Toast - NO dimming overlay */}
        {showSuccess && lastScannedProduct && (
          <Animated.View 
            style={[
              styles.successToast, 
              { 
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <View style={styles.successToastContent}>
              <View style={styles.successIconContainer}>
                <Ionicons name="checkmark-circle" size={24} color={COLORS.white} />
              </View>
              <View style={styles.successToastTextContainer}>
                <Text style={styles.successToastTitle}>✅ ထည့်ပြီးပါပြီ</Text>
                <Text style={styles.successToastProduct} numberOfLines={1}>
                  {lastScannedProduct.name}
                </Text>
                <Text style={styles.successToastPrice}>
                  {formatCurrency(lastScannedProduct.price)}
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* REMOVED: Processing Overlay - NO MORE DIMMING */}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.black,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: 20,
  },
  message: {
    marginTop: 20,
    fontSize: fontScale(16),
    fontFamily: FONTS.regular,
    color: COLORS.dark,
    textAlign: 'center',
  },
  permissionButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: moderateScale(30),
    paddingVertical: moderateScale(12),
    borderRadius: moderateScale(8),
    marginTop: moderateScale(20),
  },
  permissionButtonText: {
    color: COLORS.white,
    fontSize: fontScale(16),
    fontFamily: FONTS.bold,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  topOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  middleContainer: {
    flexDirection: 'row',
    height: moderateScale(220),
  },
  leftOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scannerFrame: {
    width: moderateScale(250),
    height: moderateScale(220),
    position: 'relative',
  },
  rightOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  bottomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanText: {
    color: COLORS.white,
    fontSize: fontScale(14),
    fontFamily: FONTS.medium,
    marginTop: moderateScale(15),
  },
  scanSubText: {
    color: COLORS.white + 'CC',
    fontSize: fontScale(11),
    fontFamily: FONTS.regular,
    marginTop: moderateScale(3),
  },
  cornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: moderateScale(35),
    height: moderateScale(35),
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: COLORS.primary,
  },
  cornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: moderateScale(35),
    height: moderateScale(35),
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: COLORS.primary,
  },
  cornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: moderateScale(35),
    height: moderateScale(35),
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: COLORS.primary,
  },
  cornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: moderateScale(35),
    height: moderateScale(35),
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: COLORS.primary,
  },
  scannerLine: {
    position: 'absolute',
    top: moderateScale(110),
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  controls: {
    position: 'absolute',
    bottom: moderateScale(20),
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: moderateScale(20),
  },
  controlButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(8),
    borderRadius: moderateScale(30),
  },
  controlText: {
    color: COLORS.white,
    fontSize: fontScale(10),
    fontFamily: FONTS.regular,
    marginTop: moderateScale(3),
  },
  cartButton: {
    backgroundColor: COLORS.primary,
  },
  cartPreview: {
    position: 'absolute',
    top: moderateScale(50),
    right: moderateScale(12),
    width: screenWidth * 0.45,
    backgroundColor: COLORS.white,
    borderRadius: moderateScale(12),
    overflow: 'hidden',
    ...(Platform.OS === 'ios' ? {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    } : {
      elevation: 8,
    }),
  },
  cartPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(10),
    backgroundColor: COLORS.primary + '10',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLight,
  },
  cartPreviewTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(6),
  },
  cartPreviewTitle: {
    fontSize: fontScale(12),
    fontFamily: FONTS.bold,
    color: COLORS.dark,
  },
  cartPreviewBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: moderateScale(10),
    paddingHorizontal: moderateScale(6),
    paddingVertical: moderateScale(2),
  },
  cartPreviewBadgeText: {
    color: COLORS.white,
    fontSize: fontScale(10),
    fontFamily: FONTS.bold,
  },
  cartPreviewToggle: {
    padding: moderateScale(4),
  },
  cartPreviewList: {
    maxHeight: moderateScale(200),
  },
  cartPreviewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(8),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLight,
  },
  cartPreviewItemInfo: {
    flex: 1,
    marginRight: moderateScale(8),
  },
  cartPreviewItemName: {
    fontSize: fontScale(12),
    fontFamily: FONTS.medium,
    color: COLORS.dark,
  },
  cartPreviewItemPrice: {
    fontSize: fontScale(10),
    fontFamily: FONTS.regular,
    color: COLORS.gray,
    marginTop: moderateScale(2),
  },
  cartPreviewItemTotal: {
    fontSize: fontScale(12),
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
  cartPreviewMore: {
    fontSize: fontScale(10),
    fontFamily: FONTS.regular,
    color: COLORS.gray,
    textAlign: 'center',
    paddingVertical: moderateScale(8),
  },
  cartPreviewFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(10),
    backgroundColor: COLORS.primary + '10',
    borderTopWidth: 1,
    borderTopColor: COLORS.grayLight,
  },
  cartPreviewTotalLabel: {
    fontSize: fontScale(12),
    fontFamily: FONTS.medium,
    color: COLORS.dark,
  },
  cartPreviewTotalAmount: {
    fontSize: fontScale(14),
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
  cartCollapsedButton: {
    position: 'absolute',
    top: moderateScale(50),
    right: moderateScale(12),
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(8),
    borderRadius: moderateScale(30),
    gap: moderateScale(6),
    ...(Platform.OS === 'ios' ? {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
    } : {
      elevation: 5,
    }),
  },
  cartCollapsedText: {
    color: COLORS.white,
    fontSize: fontScale(12),
    fontFamily: FONTS.bold,
  },
  successToast: {
    position: 'absolute',
    bottom: moderateScale(100),
    left: moderateScale(16),
    right: moderateScale(16),
    backgroundColor: COLORS.white,
    borderRadius: moderateScale(12),
    overflow: 'hidden',
    ...(Platform.OS === 'ios' ? {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    } : {
      elevation: 10,
    }),
  },
  successToastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: moderateScale(12),
  },
  successIconContainer: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    backgroundColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: moderateScale(12),
  },
  successToastTextContainer: {
    flex: 1,
  },
  successToastTitle: {
    fontSize: fontScale(12),
    fontFamily: FONTS.medium,
    color: COLORS.success,
    marginBottom: moderateScale(2),
  },
  successToastProduct: {
    fontSize: fontScale(14),
    fontFamily: FONTS.bold,
    color: COLORS.dark,
    marginBottom: moderateScale(2),
  },
  successToastPrice: {
    fontSize: fontScale(12),
    fontFamily: FONTS.regular,
    color: COLORS.gray,
  },
});

export default BarcodeScanner;
