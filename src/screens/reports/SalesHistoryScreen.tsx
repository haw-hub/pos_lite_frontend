// src/screens/reports/SalesHistoryScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { orderApi } from '../../api/orders';
import { COLORS, FONTS } from '../../config/theme';
import { moderateScale } from '../../utils/responsive';
import { formatCurrency, formatNumber } from '../../utils/currency';
import { OrderRepository } from '../../database/repositories/orderRepository';

// Define valid icon names type
type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface Order {
  id: number;
  orderNumber: string;
  totalAmount: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
}

interface SalesStats {
  totalSales: number;
  totalOrders: number;
  averageOrder: number;
}

type FilterType = 'all' | 'today' | 'week' | 'month';

export const SalesHistoryScreen = ({ navigation }: any) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [stats, setStats] = useState<SalesStats>({
    totalSales: 0,
    totalOrders: 0,
    averageOrder: 0,
  });

  // Fetch orders from API
  const fetchOrders = useCallback(async () => {
    try {
      console.log('📊 Fetching orders with filter:', filter);
      
      let ordersData: Order[] = [];
      
      try {
        if (filter === 'today') {
          const response = await orderApi.getTodayOrders();
          ordersData = Array.isArray(response) ? response : [];
        } else {
          const response = await orderApi.getAll();
          ordersData = Array.isArray(response) ? response : [];
        }
        await OrderRepository.cacheServerOrders(ordersData);
      } catch {
        ordersData =
          filter === 'today'
            ? await OrderRepository.getToday()
            : await OrderRepository.getAll();
        console.log(`Using ${ordersData.length} offline orders`);
      }
      
      // Apply client-side filtering for week/month
      let filteredOrders = [...ordersData];
      
      if (filter === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        filteredOrders = ordersData.filter((o: Order) => new Date(o.createdAt) >= weekAgo);
      } else if (filter === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        filteredOrders = ordersData.filter((o: Order) => new Date(o.createdAt) >= monthAgo);
      }
      
      // Sort by date (newest first)
      filteredOrders.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      setOrders(filteredOrders);
      
      // Calculate stats
      const total = filteredOrders.reduce((sum: number, o: Order) => sum + o.totalAmount, 0);
      setStats({
        totalSales: total,
        totalOrders: filteredOrders.length,
        averageOrder: filteredOrders.length > 0 ? total / filteredOrders.length : 0,
      });
      
      console.log(`✅ Loaded ${filteredOrders.length} orders`);
    } catch (error: any) {
      console.error('❌ Fetch orders error:', error.message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  // Refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  };

  // Initial load
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('📱 Sales history focused, refreshing...');
      fetchOrders();
      return () => {};
    }, [fetchOrders])
  );

  // Get payment method icon - FIXED: returns specific IconName type
  const getPaymentIcon = (method: string): IconName => {
    switch (method) {
      case 'CASH': return 'cash-outline';
      case 'CARD': return 'card-outline';
      case 'QR': return 'qr-code-outline';
      case 'TRANSFER': return 'swap-horizontal-outline';
      case 'CREDIT': return 'wallet-outline';
      default: return 'cash-outline';
    }
  };

  // Get payment method text
  const getPaymentText = (method: string): string => {
    switch (method) {
      case 'CASH': return 'ငွေသား';
      case 'CARD': return 'ကဒ်';
      case 'QR': return 'QR Code';
      case 'TRANSFER': return 'ငွေလွှဲ';
      case 'CREDIT': return 'အကြွေး';
      default: return method;
    }
  };

  // Get status color
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'COMPLETED': return COLORS.success;
      case 'PENDING': return COLORS.warning;
      case 'CANCELLED': return COLORS.danger;
      default: return COLORS.gray;
    }
  };

  // Get status text
  const getStatusText = (status: string): string => {
    switch (status) {
      case 'COMPLETED': return 'ပြီးစီး';
      case 'PENDING': return 'ဆိုင်းငံ့';
      case 'CANCELLED': return 'ပယ်ဖျက်';
      default: return status;
    }
  };

  // Render order item
  const renderOrderItem = ({ item }: { item: Order }) => (
    <TouchableOpacity 
      style={styles.orderCard}
      activeOpacity={0.7}
    >
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
            {getStatusText(item.status)}
          </Text>
        </View>
      </View>
      
      <View style={styles.orderFooter}>
        <View style={styles.paymentMethod}>
          <Ionicons name={getPaymentIcon(item.paymentMethod)} size={16} color={COLORS.gray} />
          <Text style={styles.paymentText}>{getPaymentText(item.paymentMethod)}</Text>
        </View>
        <Text style={styles.orderAmount}>{formatCurrency(item.totalAmount)}</Text>
      </View>
    </TouchableOpacity>
  );

  // Stat card component
  const StatCard = ({ title, value, icon }: { title: string; value: string; icon: IconName }) => (
    <View style={styles.statCard}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={24} color={COLORS.primary} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );

  // Loading state
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
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            colors={[COLORS.primary]} 
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color={COLORS.gray} />
            <Text style={styles.emptyText}>အရောင်းအမိန့် မရှိသေးပါ</Text>
            <Text style={styles.emptySubText}>
              POS မှ ပစ္စည်းများ ရောင်းချပြီးပါက အရောင်းမှတ်တမ်းများ ဤနေရာတွင် ပြသမည်ဖြစ်ပါသည်။
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
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
    fontFamily: FONTS.medium,
    color: COLORS.gray,
  },
  
  emptySubText: {
    marginTop: moderateScale(8),
    fontSize: moderateScale(12),
    fontFamily: FONTS.regular,
    color: COLORS.gray,
    textAlign: 'center',
    paddingHorizontal: moderateScale(20),
  },
});

export default SalesHistoryScreen;
