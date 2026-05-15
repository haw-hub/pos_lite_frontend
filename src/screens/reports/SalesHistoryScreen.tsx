// src/screens/reports/SalesHistoryScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../../config/theme';
import { moderateScale } from '../../utils/responsive';
import { formatCurrency, formatNumber } from '../../utils/currency';
import apiClient from '../../api/client';

interface Order {
  id: number;
  orderNumber: string;
  totalAmount: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
}

export const SalesHistoryScreen = ({ navigation }: any) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [stats, setStats] = useState({
    totalSales: 0,
    totalOrders: 0,
    averageOrder: 0,
  });

  const fetchOrders = async () => {
    try {
      let endpoint = '/orders';
      if (filter === 'today') {
        endpoint = '/orders/today';
      }
      
      const response = await apiClient.get(endpoint);
      let ordersData = response.data;
      
      // Apply client-side filtering for week/month
      if (filter === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        ordersData = ordersData.filter((o: Order) => new Date(o.createdAt) >= weekAgo);
      } else if (filter === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        ordersData = ordersData.filter((o: Order) => new Date(o.createdAt) >= monthAgo);
      }
      
      setOrders(ordersData);
      
      // Calculate stats
      const total = ordersData.reduce((sum: number, o: Order) => sum + o.totalAmount, 0);
      setStats({
        totalSales: total,
        totalOrders: ordersData.length,
        averageOrder: ordersData.length > 0 ? total / ordersData.length : 0,
      });
    } catch (error) {
      console.error('Fetch orders error:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchOrders();
  }, [filter]);

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case 'CASH': return 'cash-outline';
      case 'CARD': return 'card-outline';
      case 'QR': return 'qr-code-outline';
      default: return 'swap-horizontal-outline';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return COLORS.success;
      case 'PENDING': return COLORS.warning;
      case 'CANCELLED': return COLORS.danger;
      default: return COLORS.gray;
    }
  };

  const renderOrderItem = ({ item }: { item: Order }) => (
    <TouchableOpacity style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View>
          <Text style={styles.orderNumber}>{item.orderNumber}</Text>
          <Text style={styles.orderDate}>
            {new Date(item.createdAt).toLocaleDateString('my-MM', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status === 'COMPLETED' ? 'ပြီးစီး' : item.status === 'PENDING' ? 'ဆိုင်းငံ့' : 'ပယ်ဖျက်'}
          </Text>
        </View>
      </View>
      
      <View style={styles.orderFooter}>
        <View style={styles.paymentMethod}>
          <Ionicons name={getPaymentIcon(item.paymentMethod)} size={16} color={COLORS.gray} />
          <Text style={styles.paymentText}>
            {item.paymentMethod === 'CASH' ? 'ငွေသား' : 
             item.paymentMethod === 'CARD' ? 'ကဒ်' :
             item.paymentMethod === 'QR' ? 'QR Code' : 'ငွေလွှဲ'}
          </Text>
        </View>
        <Text style={styles.orderAmount}>
          {formatCurrency(item.totalAmount)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const StatCard = ({ title, value, icon }: { title: string; value: string; icon: string }) => (
    <View style={styles.statCard}>
      <View style={styles.statIcon}>
        <Ionicons name={icon as any} size={24} color={COLORS.primary} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>ဒေတာများ ယူနေပါသည်...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Stats Summary */}
      <View style={styles.statsContainer}>
        <StatCard 
          title="စုစုပေါင်းရောင်းရငွေ" 
          value={formatCurrency(stats.totalSales)} 
          icon="trending-up"
        />
        <StatCard 
          title="အရောင်းအမိန့်" 
          value={formatNumber(stats.totalOrders)} 
          icon="receipt"
        />
        <StatCard 
          title="ပျမ်းမျှဈေး" 
          value={formatCurrency(stats.averageOrder)} 
          icon="calculator"
        />
      </View>

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            အားလုံး
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'today' && styles.filterButtonActive]}
          onPress={() => setFilter('today')}
        >
          <Text style={[styles.filterText, filter === 'today' && styles.filterTextActive]}>
            ယနေ့
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'week' && styles.filterButtonActive]}
          onPress={() => setFilter('week')}
        >
          <Text style={[styles.filterText, filter === 'week' && styles.filterTextActive]}>
            ယခင်ရက် ၇
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'month' && styles.filterButtonActive]}
          onPress={() => setFilter('month')}
        >
          <Text style={[styles.filterText, filter === 'month' && styles.filterTextActive]}>
            ယခင်လ
          </Text>
        </TouchableOpacity>
      </View>

      {/* Orders List */}
      <FlatList
        data={orders}
        renderItem={renderOrderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color={COLORS.gray} />
            <Text style={styles.emptyText}>အရောင်းအမိန့် မရှိသေးပါ</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  loadingText: {
    marginTop: moderateScale(10),
    fontFamily: FONTS.regular,
    color: COLORS.gray,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    paddingHorizontal: moderateScale(15),
    paddingVertical: moderateScale(15),
    marginTop: moderateScale(10),
    marginHorizontal: moderateScale(15),
    borderRadius: moderateScale(12),
    ...Platform.select({
      ios: { shadowOpacity: 0.1, shadowRadius: 3 },
      android: { elevation: 2 },
    }),
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statIcon: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    backgroundColor: COLORS.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: moderateScale(8),
  },
  statValue: {
    fontSize: moderateScale(16),
    fontFamily: FONTS.bold,
    color: COLORS.dark,
    marginBottom: moderateScale(4),
  },
  statTitle: {
    fontSize: moderateScale(11),
    fontFamily: FONTS.regular,
    color: COLORS.gray,
    textAlign: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    marginTop: moderateScale(10),
    marginHorizontal: moderateScale(15),
    padding: moderateScale(5),
    borderRadius: moderateScale(10),
  },
  filterButton: {
    flex: 1,
    paddingVertical: moderateScale(8),
    alignItems: 'center',
    borderRadius: moderateScale(8),
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
  },
  filterText: {
    fontSize: moderateScale(14),
    fontFamily: FONTS.medium,
    color: COLORS.gray,
  },
  filterTextActive: {
    color: COLORS.white,
  },
  listContent: {
    paddingHorizontal: moderateScale(15),
    paddingBottom: moderateScale(20),
  },
  orderCard: {
    backgroundColor: COLORS.white,
    borderRadius: moderateScale(12),
    padding: moderateScale(15),
    marginTop: moderateScale(10),
    ...Platform.select({
      ios: { shadowOpacity: 0.05, shadowRadius: 2 },
      android: { elevation: 1 },
    }),
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: moderateScale(12),
  },
  orderNumber: {
    fontSize: moderateScale(14),
    fontFamily: FONTS.bold,
    color: COLORS.dark,
  },
  orderDate: {
    fontSize: moderateScale(11),
    fontFamily: FONTS.regular,
    color: COLORS.gray,
    marginTop: moderateScale(4),
  },
  statusBadge: {
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(4),
    borderRadius: moderateScale(12),
  },
  statusText: {
    fontSize: moderateScale(11),
    fontFamily: FONTS.medium,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.grayLight,
    paddingTop: moderateScale(12),
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(6),
  },
  paymentText: {
    fontSize: moderateScale(12),
    fontFamily: FONTS.regular,
    color: COLORS.gray,
  },
  orderAmount: {
    fontSize: moderateScale(16),
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: moderateScale(50),
  },
  emptyText: {
    marginTop: moderateScale(16),
    fontSize: moderateScale(16),
    fontFamily: FONTS.regular,
    color: COLORS.gray,
  },
});