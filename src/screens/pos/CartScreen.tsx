// src/screens/pos/CartScreen.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useCartStore } from '../../store/cartStore';
import { formatCurrency } from '../../utils/currency';
import { COLORS, FONTS } from '../../config/theme';

export const CartScreen = ({ navigation }: any) => {
  const { items, total } = useCartStore();
  
  return (
    <View style={styles.container}>
      <Text>Cart Screen - Total: {formatCurrency(total)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
});