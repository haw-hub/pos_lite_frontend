// src/screens/inventory/ProductListScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useProductStore } from '../../store/productStore';
import { COLORS, FONTS } from '../../config/theme';
import { moderateScale, fontScale } from '../../utils/responsive';
import { formatCurrency } from '../../utils/currency';

export const ProductListScreen = ({ navigation }: any) => {
  const { products, fetchProducts } = useProductStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('အားလုံး');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProducts();
    setRefreshing(false);
  };

  const categoryFor = (product: any) => product.category?.trim() || 'အခြား';
  const categories = ['အားလုံး', ...Array.from(new Set(products.map(categoryFor))).sort((a, b) => a.localeCompare(b, 'my'))];
  const filteredProducts = products.filter(product => {
    const matchesCategory = selectedCategory === 'အားလုံး' || categoryFor(product) === selectedCategory;
    const query = searchQuery.toLowerCase();
    const matchesSearch = product.name.toLowerCase().includes(query) || String(product.barcode || '').includes(query);
    return matchesCategory && matchesSearch;
  });

  const renderProductItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.productItem}
      onPress={() => navigation.navigate('AddProduct', { product: item })}
    >
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{item.name}</Text>
        <Text style={styles.productPrice}>{formatCurrency(item.price)}</Text>
      </View>
      <View style={styles.productStock}>
        <Text style={[styles.stockText, item.stock < 10 && { color: COLORS.warning }]}>
          ကျန်: {item.stock}
        </Text>
        <Ionicons name="chevron-forward" size={20} color={COLORS.gray} />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={20} color={COLORS.gray} />
        <TextInput
          style={styles.searchInput}
          placeholder="ရှာဖွေရန်..."
          placeholderTextColor={COLORS.gray}
          value={searchQuery}
          multiline={false}
          numberOfLines={1}
          scrollEnabled={false}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.categoryBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
          {categories.map(category => (
            <TouchableOpacity
              key={category}
              style={[styles.categoryChip, selectedCategory === category && styles.categoryChipActive]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text style={[styles.categoryChipText, selectedCategory === category && styles.categoryChipTextActive]}>
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filteredProducts}
        renderItem={renderProductItem}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={40} color={COLORS.gray} />
            <Text style={styles.emptyText}>ဤအမျိုးအစားတွင် ပစ္စည်းမတွေ့ပါ</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.light,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    margin: moderateScale(15),
    paddingHorizontal: moderateScale(15),
    borderRadius: moderateScale(10),
    borderWidth: 1,
    borderColor: COLORS.grayLight,
  },
  searchInput: {
    flex: 1,
    height: moderateScale(45),
    marginLeft: moderateScale(10),
    fontSize: fontScale(14),
    lineHeight: fontScale(24),
    fontFamily: FONTS.regular,
    paddingVertical: 0,
    includeFontPadding: true,
    textAlignVertical: 'center',
    color: COLORS.dark,
  },
  categoryBar: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLight,
  },
  categoryList: {
    paddingHorizontal: moderateScale(15),
    paddingVertical: moderateScale(10),
    gap: moderateScale(8),
  },
  categoryChip: {
    minHeight: moderateScale(36),
    paddingHorizontal: moderateScale(13),
    borderRadius: moderateScale(18),
    justifyContent: 'center',
    backgroundColor: COLORS.light,
    borderWidth: 1,
    borderColor: COLORS.grayLight,
  },
  categoryChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryChipText: {
    fontSize: fontScale(12),
    fontFamily: FONTS.medium,
    color: COLORS.dark,
  },
  categoryChipTextActive: { color: COLORS.white },
  list: {
    paddingHorizontal: moderateScale(15),
  },
  productItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: moderateScale(15),
    borderRadius: moderateScale(10),
    marginBottom: moderateScale(10),
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: fontScale(16),
    fontFamily: FONTS.bold,
    color: COLORS.dark,
  },
  productPrice: {
    fontSize: fontScale(14),
    fontFamily: FONTS.medium,
    color: COLORS.primary,
    marginTop: moderateScale(4),
  },
  productStock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(8),
  },
  stockText: {
    fontSize: fontScale(14),
    fontFamily: FONTS.regular,
    color: COLORS.gray,
  },
  emptyState: { alignItems: 'center', paddingTop: moderateScale(64), gap: moderateScale(10) },
  emptyText: { color: COLORS.gray, fontFamily: FONTS.regular, fontSize: fontScale(14) },
});
