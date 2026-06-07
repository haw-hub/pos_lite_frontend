// src/screens/credit/CreditListScreen.tsx

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';

import { debtApi } from '../../api/debts';
import { COLORS, FONTS } from '../../config/theme';
import { formatCurrency } from '../../utils/currency';

export const CreditListScreen = ({ navigation }: any) => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const data = await debtApi.getSummary();
      setCustomers(data);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <FlatList
      data={customers}
      keyExtractor={(item) => item.customerId.toString()}
      contentContainerStyle={{ padding: 15 }}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.card}
          onPress={() =>
            navigation.navigate('CustomerDebtDetail', {
              customerId: item.customerId,
              name: item.customerName,
            })
          }
        >
          <View style={styles.row}>
            <Text style={styles.name}>{item.customerName}</Text>
            <Text style={styles.amount}>
              {formatCurrency(item.totalDebt)}
            </Text>
          </View>

          <Text style={styles.sub}>
            Orders: {item.orderCount} • {item.phone}
          </Text>
        </TouchableOpacity>
      )}
    />
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  card: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  name: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: COLORS.dark,
  },

  amount: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: COLORS.danger,
  },

  sub: {
    marginTop: 5,
    fontSize: 12,
    color: COLORS.gray,
  },
});