// src/screens/inventory/InventoryScreen.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useProductStore } from '../../store/productStore';
import { BarcodeScanner } from '../../components/BarcodeScanner';
import { COLORS, FONTS } from '../../config/theme';
import { moderateScale, getButtonHeight } from '../../utils/responsive';
import { formatCurrency } from '../../utils/currency';
import { Product } from '../../types';
import { DEFAULT_ALERT_SETTINGS } from '../../services/alerts/inventoryAlertService';

export const InventoryScreen = ({ navigation, route }: any) => {
  const {
    products,
    deletedProducts,
    fetchProducts,
    fetchDeletedProducts,
    deleteProduct,
    restoreProduct,
    isLoading
  } = useProductStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletedModalVisible, setDeletedModalVisible] = useState(false);
  const [columns] = useState(1);
  const [loadingDeleted, setLoadingDeleted] = useState(false);
  const [restoringProductId, setRestoringProductId] = useState<number | null>(null);
  const [scannerVisible, setScannerVisible] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchDeletedProducts();   
  }, []);

  useFocusEffect(
    useCallback(() => {
      console.log('📱 Inventory screen focused, refreshing products...');
      fetchProducts();
      return () => {};
    }, [fetchProducts])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProducts();
    setRefreshing(false);
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
  };

  // FIXED: Handle barcode scan - returns Promise<Product | null>
  const handleBarcodeScan = async (scannedBarcode: string): Promise<Product | null> => {
    setScannerVisible(false);
    setSearchQuery(scannedBarcode);
    console.log('📷 Scanned barcode for search:', scannedBarcode);
    
    // Find the product with this barcode
    const foundProduct = products.find(p => p.barcode === scannedBarcode);
    
    // Return the product if found (for the scanner's success animation)
    return foundProduct || null;
  };

  const handleDeleteProduct = async () => {
    if (selectedProduct) {
      await deleteProduct(selectedProduct.id);
      setDeleteModalVisible(false);
      setSelectedProduct(null);
      Alert.alert('အောင်မြင်ပါသည်', 'ပစ္စည်းကို ဖျက်ပြီးပါပြီ');
    }
  };

  const handleRestoreProduct = async (id: number) => {
    setDeletedModalVisible(false);
    await restoreProduct(id);
  };

  const activeFilter = route?.params?.filter as 'lowStock' | 'outOfStock' | 'expiry' | undefined;
  const lowStockCount = route?.params?.lowStockCount ?? DEFAULT_ALERT_SETTINGS.lowStockCount;
  const expiryDays = route?.params?.expiryDays ?? DEFAULT_ALERT_SETTINGS.expiryDays;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filteredProducts = products.filter(product => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.barcode?.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (activeFilter === 'lowStock') return product.stock > 0 && product.stock <= lowStockCount;
    if (activeFilter === 'outOfStock') return product.stock <= 0;
    if (activeFilter === 'expiry') {
      if (!product.expiryDate) return false;
      const expiry = new Date(`${product.expiryDate}T00:00:00`);
      const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
      return daysLeft <= expiryDays;
    }
    return true;
  });

  const flatListKey = useMemo(() => {
    return `columns-${columns}-count-${filteredProducts.length}`;
  }, [columns, filteredProducts.length]);

  const getStockStatus = (stock: number) => {
    if (stock <= 0) return { text: 'ကုန်သွားပြီ', color: COLORS.danger, icon: 'close-circle' };
    if (stock < 10) return { text: 'ကျန်နည်းပါသည်', color: COLORS.warning, icon: 'warning' };
    return { text: 'အနေတော်', color: COLORS.success, icon: 'checkmark-circle' };
  };

  const getExpiryStatus = (expiryDate?: string) => {
    if (!expiryDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(`${expiryDate}T00:00:00`);
    const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
    if (daysLeft < 0) return { text: 'သက်တမ်းကုန်ပြီး', color: COLORS.danger };
    if (daysLeft <= 30) return { text: `${daysLeft} ရက်ကျန်`, color: COLORS.warning };
    return { text: expiryDate, color: COLORS.success };
  };

  const renderProductItem = ({ item }: { item: Product }) => {
    const stockStatus = getStockStatus(item.stock);
    const expiryStatus = getExpiryStatus(item.expiryDate);
    
    return (
      <View style={styles.productCard}>
        <View style={styles.productHeader}>
          <View style={styles.productIdentity}>
            <View style={styles.productIcon}>
              <Ionicons name="cube-outline" size={22} color={COLORS.primary} />
            </View>
            <View style={styles.productTitleGroup}>
              <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
              {item.barcode ? (
                <View style={styles.barcodeRow}>
                  <Ionicons name="barcode-outline" size={12} color={COLORS.gray} />
                  <Text style={styles.productBarcode} numberOfLines={1}>{item.barcode}</Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={styles.headerActions}>
            <View style={[styles.stockBadge, { backgroundColor: stockStatus.color + '20' }]}>
              <Ionicons name={stockStatus.icon as any} size={12} color={stockStatus.color} />
              <Text style={[styles.stockText, { color: stockStatus.color }]}>
                {stockStatus.text}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.iconAction}
              onPress={() => navigation.navigate('AddProduct', { product: item })}
            >
              <Ionicons name="create-outline" size={19} color={COLORS.info} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconAction}
              onPress={() => {
                setSelectedProduct(item);
                setDeleteModalVisible(true);
              }}
            >
              <Ionicons name="trash-outline" size={19} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.productInfo}>
          {item.description && (
            <Text style={styles.productDescription} numberOfLines={1}>
              {item.description}
            </Text>
          )}

          <View style={styles.productDetails}>
            <View style={styles.priceBlock}>
              <Text style={styles.detailLabel}>ရောင်းဈေး</Text>
              <Text style={styles.productPrice}>{formatCurrency(item.price)}</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.priceBlock}>
              <Text style={styles.detailLabel}>အရင်းဈေး</Text>
              <Text style={styles.costPrice}>{formatCurrency(item.costPrice || 0)}</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.priceBlock}>
              <Text style={styles.detailLabel}>လက်ကျန်</Text>
              <Text style={[
                styles.productStock,
                item.stock < 10 && { color: COLORS.warning }
              ]}>
                {item.stock} ခု
              </Text>
            </View>
          </View>
          {expiryStatus && (
            <View style={[styles.expiryRow, { backgroundColor: expiryStatus.color + '12' }]}>
              <Ionicons name="calendar-outline" size={14} color={expiryStatus.color} />
              <Text style={[styles.expiryText, { color: expiryStatus.color }]}>
                သက်တမ်း: {expiryStatus.text}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header with Add Button */}
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color={COLORS.gray} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="ရှာဖွေရန် (အမည် သို့မဟုတ် ဘားကုဒ်)..."
            placeholderTextColor={COLORS.gray}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={COLORS.gray} />
            </TouchableOpacity>
          )}
          {/* Barcode Scanner Button */}
          <TouchableOpacity 
            style={styles.scannerButton}
            onPress={() => setScannerVisible(true)}
          >
            <Ionicons name="barcode-outline" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.headerActionButton, styles.addButton]}
            onPress={() => navigation.navigate('AddProduct', { product: null })}
          >
            <Ionicons name="add" size={24} color={COLORS.white} />
            <Text style={styles.addButtonText}>အသစ်ထည့်</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={async () => {
              setDeletedModalVisible(true);
              setLoadingDeleted(true);
              await fetchDeletedProducts();
              setLoadingDeleted(false);
            }}
          >
            <Ionicons name="archive-outline" size={22} color={COLORS.white} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.headerIconButton,
              styles.creditButton,
            ]}
            onPress={() =>
              navigation.navigate('CreditList')
            }
          >
            <Ionicons
              name="wallet-outline"
              size={22}
              color={COLORS.white}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats Summary */}
      {activeFilter && (
        <View style={styles.filterBanner}>
          <View style={styles.filterBannerText}>
            <Ionicons
              name={
                activeFilter === 'lowStock'
                  ? 'warning-outline'
                  : activeFilter === 'outOfStock'
                    ? 'close-circle-outline'
                    : 'calendar-outline'
              }
              size={20}
              color={activeFilter === 'lowStock' ? COLORS.warning : COLORS.danger}
            />
            <Text style={styles.filterTitle}>
              {activeFilter === 'lowStock'
                ? `Stock ${lowStockCount} ခုနှင့်အောက်`
                : activeFilter === 'outOfStock'
                  ? 'ကုန်သွားသောပစ္စည်းများ'
                  : `သက်တမ်းကုန်ပြီးနှင့် ${expiryDays} ရက်အတွင်းကုန်မည့်ပစ္စည်း`}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.clearFilterButton}
            onPress={() => navigation.setParams({
              filter: undefined,
              lowStockCount: undefined,
              expiryDays: undefined,
            })}
          >
            <Ionicons name="close" size={20} color={COLORS.dark} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.statsContainer}>
        <TouchableOpacity
          style={styles.statItem}
          onPress={() => navigation.setParams({ filter: undefined, lowStockCount: undefined, expiryDays: undefined })}
        >
          <Text style={styles.statValue}>{products.length}</Text>
          <Text style={styles.statLabel}>စုစုပေါင်းပစ္စည်း</Text>
        </TouchableOpacity>
        <View style={styles.statDivider} />
        <TouchableOpacity
          style={styles.statItem}
          onPress={() => navigation.setParams({ filter: 'lowStock', lowStockCount: 10 })}
        >
          <Text style={[styles.statValue, { color: COLORS.warning }]}>
            {products.filter(p => p.stock > 0 && p.stock < 10).length}
          </Text>
          <Text style={styles.statLabel}>ကျန်နည်းပစ္စည်း</Text>
        </TouchableOpacity>
        <View style={styles.statDivider} />
        <TouchableOpacity
          style={styles.statItem}
          onPress={() => navigation.setParams({ filter: 'outOfStock' })}
        >
          <Text style={[styles.statValue, { color: COLORS.danger }]}>
            {products.filter(p => p.stock === 0).length}
          </Text>
          <Text style={styles.statLabel}>ကုန်သွားပစ္စည်း</Text>
        </TouchableOpacity>
      </View>

      {/* Product List */}
      <FlatList
        key={flatListKey}
        data={filteredProducts}
        renderItem={renderProductItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        numColumns={columns}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={64} color={COLORS.gray} />
            <Text style={styles.emptyText}>
              {searchQuery ? 'ရှာဖွေမှုနှင့်ကိုက်ညီသော ပစ္စည်းမရှိပါ' : 'ပစ္စည်းများ မရှိသေးပါ'}
            </Text>
            {!searchQuery && (
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => navigation.navigate('AddProduct', { product: null })}
              >
                <Text style={styles.emptyButtonText}>ပစ္စည်းအသစ်ထည့်ရန်</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Deleted Products Modal */}
      <Modal visible={deletedModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.deletedModalContainer}>
            <View style={styles.deletedModalHeader}>
              <Text style={styles.deletedModalTitle}>ဖျက်ပြီးပစ္စည်းပြန်ယူရန်</Text>
              <TouchableOpacity onPress={() => setDeletedModalVisible(false)}>
                <Ionicons name="close" size={28} color={COLORS.dark} />
              </TouchableOpacity>
            </View>

            {loadingDeleted ? (
              <View style={styles.centeredLoading}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Loading deleted products...</Text>
              </View>
            ) : (
              <FlatList
                data={deletedProducts}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <View style={styles.deletedProductCard}>
                    <Text style={styles.deletedProductName}>{item.name}</Text>
                    <Text style={styles.deletedProductPrice}>{formatCurrency(item.price)}</Text>
                    <TouchableOpacity
                      style={styles.restoreButton}
                      onPress={async () => {
                        setRestoringProductId(item.id);
                        await handleRestoreProduct(item.id);
                        setRestoringProductId(null);
                      }}
                      disabled={restoringProductId === item.id}
                    >
                      {restoringProductId === item.id ? (
                        <ActivityIndicator size="small" color={COLORS.white} />
                      ) : (
                        <>
                          <Ionicons name="refresh" size={18} color={COLORS.white} />
                          <Text style={styles.actionButtonText}>ပြန်ယူ</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIcon}>
              <Ionicons name="warning" size={50} color={COLORS.warning} />
            </View>
            <Text style={styles.modalTitle}>ပစ္စည်းဖျက်ရန် သေချာပါသလား?</Text>
            <Text style={styles.modalMessage}>
              {selectedProduct?.name} အား ဖျက်ပါက ပြန်လည်ရယူ၍ မရနိုင်ပါ။
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setDeleteModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>မလုပ်တော့ပါ</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleDeleteProduct}
              >
                <Text style={styles.confirmButtonText}>ဖျက်မည်</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Barcode Scanner Modal */}
      <BarcodeScanner
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScan={handleBarcodeScan}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6F8',
  },
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: moderateScale(15),
    paddingTop: moderateScale(15),
    paddingBottom: moderateScale(15),
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: moderateScale(8),
    paddingHorizontal: moderateScale(12),
    marginBottom: moderateScale(12),
  },
  searchIcon: {
    marginRight: moderateScale(8),
  },
  searchInput: {
    flex: 1,
    height: moderateScale(45),
    fontSize: moderateScale(14),
    fontFamily: FONTS.regular,
    color: COLORS.dark,
  },
  scannerButton: {
    width: moderateScale(38),
    height: moderateScale(38),
    borderRadius: moderateScale(8),
    backgroundColor: COLORS.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: moderateScale(8),
  },
  headerActionButton: {
    height: moderateScale(44),
    borderRadius: moderateScale(8),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: moderateScale(6),
  },
  headerIconButton: {
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(8),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white + '18',
  },
  addButton: {
    flex: 1,
    backgroundColor: COLORS.secondary,
  },
  addButtonText: {
    color: COLORS.white,
    fontSize: moderateScale(14),
    fontFamily: FONTS.bold,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    marginHorizontal: moderateScale(15),
    marginTop: moderateScale(15),
    borderRadius: moderateScale(8),
    paddingVertical: moderateScale(15),
    ...Platform.select({
      ios: { shadowOpacity: 0.05, shadowRadius: 3 },
      android: { elevation: 1 },
    }),
  },
  filterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    marginHorizontal: moderateScale(15),
    marginTop: moderateScale(15),
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(10),
    borderRadius: moderateScale(8),
    borderWidth: 1,
    borderColor: COLORS.grayLight,
  },
  filterBannerText: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(8),
  },
  filterTitle: {
    flex: 1,
    fontSize: moderateScale(12),
    fontFamily: FONTS.medium,
    color: COLORS.dark,
  },
  clearFilterButton: {
    width: moderateScale(32),
    height: moderateScale(32),
    alignItems: 'center',
    justifyContent: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: moderateScale(48),
  },
  statValue: {
    fontSize: moderateScale(20),
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: moderateScale(11),
    fontFamily: FONTS.regular,
    color: COLORS.gray,
    marginTop: moderateScale(4),
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.grayLight,
  },
  listContent: {
    paddingHorizontal: moderateScale(15),
    paddingTop: moderateScale(15),
    paddingBottom: moderateScale(30),
  },
  productCard: {
    backgroundColor: COLORS.white,
    borderRadius: moderateScale(8),
    padding: moderateScale(12),
    marginBottom: moderateScale(12),
    width: '100%',
    borderWidth: 1,
    borderColor: '#E9EDF2',
    ...Platform.select({
      ios: { shadowOpacity: 0.04, shadowRadius: 3 },
      android: { elevation: 1 },
    }),
  },
  productInfo: {
    flex: 1,
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: moderateScale(10),
  },
  productIdentity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: moderateScale(8),
  },
  productIcon: {
    width: moderateScale(42),
    height: moderateScale(42),
    borderRadius: moderateScale(8),
    backgroundColor: COLORS.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: moderateScale(10),
  },
  productTitleGroup: {
    flex: 1,
  },
  productName: {
    fontSize: moderateScale(13),
    fontFamily: FONTS.bold,
    color: COLORS.dark,
  },
  barcodeRow: {
    marginTop: moderateScale(3),
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(4),
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(5),
  },
  iconAction: {
    width: moderateScale(32),
    height: moderateScale(32),
    borderRadius: moderateScale(6),
    backgroundColor: COLORS.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: moderateScale(6),
    paddingVertical: moderateScale(3),
    borderRadius: moderateScale(6),
    gap: moderateScale(3),
    alignSelf: 'flex-start',
  },
  stockText: {
    fontSize: moderateScale(9),
    fontFamily: FONTS.medium,
  },
  productDescription: {
    fontSize: moderateScale(10),
    fontFamily: FONTS.regular,
    color: COLORS.gray,
    marginBottom: moderateScale(9),
  },
  productDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F8FA',
    borderRadius: moderateScale(7),
    paddingVertical: moderateScale(9),
    paddingHorizontal: moderateScale(8),
  },
  priceBlock: {
    flex: 1,
  },
  detailLabel: {
    fontSize: moderateScale(8),
    fontFamily: FONTS.regular,
    color: COLORS.gray,
  },
  productPrice: {
    marginTop: moderateScale(2),
    fontSize: moderateScale(11),
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
  costPrice: {
    marginTop: moderateScale(2),
    fontSize: moderateScale(10),
    fontFamily: FONTS.medium,
    color: COLORS.gray,
  },
  productStock: {
    marginTop: moderateScale(2),
    fontSize: moderateScale(11),
    fontFamily: FONTS.medium,
    color: COLORS.dark,
  },
  productBarcode: {
    fontSize: moderateScale(9),
    fontFamily: FONTS.regular,
    color: COLORS.gray,
    flex: 1,
  },
  detailDivider: {
    width: 1,
    height: moderateScale(28),
    backgroundColor: COLORS.grayLight,
    marginHorizontal: moderateScale(8),
  },
  expiryRow: {
    marginTop: moderateScale(8),
    borderRadius: moderateScale(6),
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(5),
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(5),
  },
  expiryText: {
    fontSize: moderateScale(9),
    fontFamily: FONTS.medium,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(8),
    borderRadius: moderateScale(8),
    gap: moderateScale(6),
  },
  actionButtonText: {
    color: COLORS.white,
    fontSize: moderateScale(11),
    fontFamily: FONTS.medium,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: moderateScale(50),
  },
  emptyText: {
    marginTop: moderateScale(16),
    fontSize: moderateScale(14),
    fontFamily: FONTS.regular,
    color: COLORS.gray,
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: moderateScale(20),
    backgroundColor: COLORS.primary,
    paddingHorizontal: moderateScale(20),
    paddingVertical: moderateScale(10),
    borderRadius: moderateScale(8),
  },
  emptyButtonText: {
    color: COLORS.white,
    fontSize: moderateScale(14),
    fontFamily: FONTS.bold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: moderateScale(16),
    padding: moderateScale(20),
    width: '80%',
    alignItems: 'center',
  },
  modalIcon: {
    marginBottom: moderateScale(16),
  },
  modalTitle: {
    fontSize: moderateScale(18),
    fontFamily: FONTS.bold,
    color: COLORS.dark,
    marginBottom: moderateScale(8),
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: moderateScale(14),
    fontFamily: FONTS.regular,
    color: COLORS.gray,
    textAlign: 'center',
    marginBottom: moderateScale(20),
  },
  modalButtons: {
    flexDirection: 'row',
    gap: moderateScale(12),
  },
  modalButton: {
    flex: 1,
    paddingVertical: moderateScale(10),
    paddingHorizontal: moderateScale(20),
    borderRadius: moderateScale(8),
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: COLORS.grayLight,
  },
  confirmButton: {
    backgroundColor: COLORS.danger,
  },
  cancelButtonText: {
    color: COLORS.dark,
    fontSize: moderateScale(14),
    fontFamily: FONTS.medium,
  },
  confirmButtonText: {
    color: COLORS.white,
    fontSize: moderateScale(14),
    fontFamily: FONTS.bold,
  },
  deletedModalContainer: {
    width: '90%',
    maxHeight: '85%',
    backgroundColor: COLORS.white,
    borderRadius: moderateScale(16),
    padding: moderateScale(16),
  },
  deletedModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: moderateScale(15),
  },
  deletedModalTitle: {
    fontSize: moderateScale(18),
    fontFamily: FONTS.bold,
    color: COLORS.dark,
  },
  deletedProductCard: {
    backgroundColor: COLORS.light,
    borderRadius: moderateScale(10),
    padding: moderateScale(12),
    marginBottom: moderateScale(10),
  },
  deletedProductName: {
    fontSize: moderateScale(15),
    fontFamily: FONTS.bold,
    marginBottom: moderateScale(6),
  },
  deletedProductPrice: {
    fontSize: moderateScale(14),
    fontFamily: FONTS.regular,
    color: COLORS.primary,
    marginBottom: moderateScale(4),
  },
  restoreButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.success,
    marginTop: moderateScale(10),
    borderRadius: moderateScale(8),
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: moderateScale(8),
    gap: moderateScale(5),
  },
  centeredLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: moderateScale(20),
  },
  loadingText: {
    marginTop: moderateScale(12),
    fontSize: moderateScale(14),
    fontFamily: FONTS.regular,
    color: COLORS.gray,
  },
  creditButton: {
    backgroundColor: COLORS.white + '18',
  },
});
