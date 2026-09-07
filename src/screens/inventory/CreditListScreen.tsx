// src/screens/credit/CreditListScreen.tsx

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { debtApi } from '../../api/debts';
import { COLORS, FONTS } from '../../config/theme';
import { formatCurrency } from '../../utils/currency';
import { fontScale } from '../../utils/responsive';

export const CreditListScreen = ({ navigation }: any) => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const data = await debtApi.getSummary();
      setCustomers(Array.isArray(data) ? data : []);
    } catch (loadError: any) {
      setCustomers([]);
      setError(loadError?.response?.data?.message || 'အကြွေးစာရင်းကို မရယူနိုင်သေးပါ။ အင်တာနက်ကိုစစ်ပြီး ပြန်လည်စမ်းပါ။');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

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
      contentContainerStyle={customers.length ? styles.content : styles.emptyContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[COLORS.primary]} />}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Ionicons name={error ? 'cloud-offline-outline' : 'receipt-outline'} size={42} color={COLORS.gray} />
          <Text style={styles.emptyTitle}>{error ? 'စာရင်းကို မရယူနိုင်ပါ' : 'လက်ရှိ အကြွေးစာရင်း မရှိသေးပါ'}</Text>
          <Text style={styles.emptyText}>{error || 'အကြွေးဖြင့် အရောင်းပြုလုပ်ပြီးနောက် ဤနေရာတွင် ပေါ်လာပါမည်။'}</Text>
          {error ? <TouchableOpacity style={styles.retryButton} onPress={load}><Text style={styles.retryText}>ပြန်စမ်းပါ</Text></TouchableOpacity> : null}
        </View>
      }
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
  content: { padding: 15 },
  emptyContent: { flexGrow: 1, padding: 15 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyTitle: { marginTop: 12, fontSize: fontScale(17), fontFamily: FONTS.bold, color: COLORS.dark, textAlign: 'center' },
  emptyText: { marginTop: 8, fontSize: fontScale(14), fontFamily: FONTS.regular, color: COLORS.gray, textAlign: 'center', lineHeight: 22 },
  retryButton: { marginTop: 18, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 8, backgroundColor: COLORS.primary },
  retryText: { color: COLORS.white, fontFamily: FONTS.bold },

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
    fontSize: fontScale(16),
    fontFamily: FONTS.bold,
    color: COLORS.dark,
  },

  amount: {
    fontSize: fontScale(16),
    fontFamily: FONTS.bold,
    color: COLORS.danger,
  },

  sub: {
    marginTop: 5,
    fontSize: fontScale(12),
    color: COLORS.gray,
  },
});
