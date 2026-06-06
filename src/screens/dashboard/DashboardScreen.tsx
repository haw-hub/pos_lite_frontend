// src/screens/dashboard/DashboardScreen.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useAuthStore } from '../../store/authStore';
import { useProductStore } from '../../store/productStore';
import { orderApi } from '../../api/orders';
import { COLORS, FONTS } from '../../config/theme';
import { moderateScale } from '../../utils/responsive';
import { formatCurrency } from '../../utils/currency';

interface DashboardStats {
  todaySales: number;
  todayOrders: number;
  totalProducts: number;
  lowStockCount: number;
  averageOrderValue: number;
}

interface RecentOrder {
  id: number;
  orderNumber: string;
  totalAmount: number;
  paymentMethod: string;
  createdAt: string;
}

export const DashboardScreen = ({ navigation }: any) => {
  const { user } = useAuthStore();
  const { products, fetchProducts } = useProductStore();

  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0,
    todayOrders: 0,
    totalProducts: 0,
    lowStockCount: 0,
    averageOrderValue: 0,
  });

  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isMounted = useRef(true);

  // =========================
  // FETCH DASHBOARD DATA
  // =========================
  const fetchDashboardData = useCallback(async () => {
    if (!isMounted.current) return;
    
    try {
      setLoading(true);
      console.log('📊 Loading dashboard data...');

      // =========================
      // FETCH TODAY ORDERS
      // =========================
      const ordersResponse = await orderApi.getTodayOrders();
      const orders = Array.isArray(ordersResponse) ? ordersResponse : [];
      console.log('✅ Orders loaded:', orders.length);

      // =========================
      // FETCH PRODUCTS
      // =========================
      await fetchProducts();
      console.log('✅ Products loaded:', products.length);

      // =========================
      // CALCULATIONS
      // =========================
      const totalSales = orders.reduce(
        (sum: number, order: any) => sum + Number(order.totalAmount || 0),
        0
      );

      const averageOrderValue = orders.length > 0 ? totalSales / orders.length : 0;

      const lowStockCount = products.filter(
        (product: any) => product.stock > 0 && product.stock < 10
      ).length;

      // =========================
      // UPDATE STATE
      // =========================
      if (isMounted.current) {
        setStats({
          todaySales: totalSales,
          todayOrders: orders.length,
          totalProducts: products.length,
          lowStockCount,
          averageOrderValue,
        });
        setRecentOrders(orders.slice(0, 5));
      }

      console.log('✅ Dashboard data loaded successfully');
    } catch (error: any) {
      console.error('❌ Dashboard data error:', error.message);
      if (isMounted.current) {
        // Fallback values
        setStats({
          todaySales: 0,
          todayOrders: 0,
          totalProducts: products.length || 0,
          lowStockCount: products?.filter((p: any) => p.stock > 0 && p.stock < 10).length || 0,
          averageOrderValue: 0,
        });
        setRecentOrders([]);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
      console.log('✅ Dashboard loading finished');
    }
  }, [products, fetchProducts]);

  // =========================
  // INITIAL LOAD
  // =========================
  useEffect(() => {
    fetchDashboardData();
    
    return () => {
      isMounted.current = false;
    };
  }, []);

  // =========================
  // REFRESH ON FOCUS - FIXED: removed dependency to prevent infinite loop
  // =========================
  useFocusEffect(
    useCallback(() => {
      console.log('📱 Dashboard focused, refreshing data...');
      fetchDashboardData();
      return () => {};
    }, []) // Empty dependency array - only runs on focus, not on fetchDashboardData changes
  );

  // =========================
  // REFRESH
  // =========================
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
  };

  // =========================
  // LOADING SCREEN
  // =========================
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>အချက်အလက်များ ယူနေပါသည်...</Text>
      </View>
    );
  }

  // =========================
  // STAT CARD
  // =========================
  const StatCard = ({ title, value, icon, color, onPress }: any) => (
    <TouchableOpacity style={styles.statCard} onPress={onPress}>
      <View style={[styles.statIcon, { backgroundColor: color }]}>
        <Ionicons name={icon} size={28} color={COLORS.white} />
      </View>
      <View style={styles.statInfo}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
    </TouchableOpacity>
  );

  // =========================
  // SMALL CARD
  // =========================
  const StatCardSmall = ({ title, value, icon, color }: any) => (
    <View style={styles.statCardSmall}>
      <View style={[styles.statIconSmall, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <View style={styles.statInfoSmall}>
        <Text style={styles.statValueSmall}>{value}</Text>
        <Text style={styles.statTitleSmall}>{title}</Text>
      </View>
    </View>
  );

  // =========================
  // MAIN UI
  // =========================
  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[COLORS.primary]}
        />
      }
    >
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>မင်္ဂလာပါ!</Text>
          <Text style={styles.userName}>{user?.fullName || 'ဧည့်သည်'}</Text>
        </View>
        <View style={styles.dateBox}>
          <Text style={styles.dateText}>
            {new Date().toLocaleDateString('my-MM', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
        </View>
      </View>

      {/* MAIN STATS */}
      <View style={styles.statsGrid}>
        <StatCard
          title="ယနေ့ရောင်းရငွေ"
          value={formatCurrency(stats.todaySales)}
          icon="cash-outline"
          color={COLORS.success}
          onPress={() => navigation.navigate('Sales')}
        />
        <StatCard
          title="ယနေ့အရောင်း"
          value={stats.todayOrders.toString()}
          icon="receipt-outline"
          color={COLORS.primary}
          onPress={() => navigation.navigate('Sales')}
        />
      </View>

      {/* SMALL STATS */}
      <View style={styles.smallStatsRow}>
        <StatCardSmall
          title="စုစုပေါင်းပစ္စည်း"
          value={stats.totalProducts}
          icon="cube-outline"
          color={COLORS.info}
        />
        <StatCardSmall
          title="ပစ္စည်းကျန်နည်း"
          value={stats.lowStockCount}
          icon="warning-outline"
          color={stats.lowStockCount > 0 ? COLORS.warning : COLORS.gray}
        />
        <StatCardSmall
          title="ပျမ်းမျှဈေး"
          value={formatCurrency(stats.averageOrderValue)}
          icon="trending-up-outline"
          color={COLORS.secondary}
        />
      </View>

      {/* QUICK ACTIONS */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>အမြန်လုပ်ဆောင်ချက်များ</Text>
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('POS')}
          >
            <View
              style={[
                styles.actionIcon,
                { backgroundColor: COLORS.primary + '20' },
              ]}
            >
              <Ionicons name="cart-outline" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.actionText}>ရောင်းရန်</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Inventory')}
          >
            <View
              style={[
                styles.actionIcon,
                { backgroundColor: COLORS.success + '20' },
              ]}
            >
              <Ionicons name="cube-outline" size={32} color={COLORS.success} />
            </View>
            <Text style={styles.actionText}>ပစ္စည်းစီမံရန်</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Sales')}
          >
            <View
              style={[
                styles.actionIcon,
                { backgroundColor: COLORS.info + '20' },
              ]}
            >
              <Ionicons name="stats-chart-outline" size={32} color={COLORS.info} />
            </View>
            <Text style={styles.actionText}>အစီရင်ခံစာ</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* RECENT ORDERS */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>လတ်တလော အရောင်းအမိန့်များ</Text>
        {recentOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="document-text-outline"
              size={48}
              color={COLORS.gray}
            />
            <Text style={styles.emptyText}>
              ယနေ့အတွက် အရောင်းအမိန့် မရှိသေးပါ
            </Text>
          </View>
        ) : (
          recentOrders.map((order, index) => (
            <View key={index} style={styles.orderItem}>
              <View>
                <Text style={styles.orderNumber}>{order.orderNumber}</Text>
                <Text style={styles.orderTime}>
                  {new Date(order.createdAt).toLocaleTimeString('my-MM')}
                </Text>
              </View>
              <Text style={styles.orderAmount}>
                {formatCurrency(order.totalAmount)}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
};

// =========================
// STYLES
// =========================
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

  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: moderateScale(20),
    paddingTop: moderateScale(20),
    paddingBottom: moderateScale(30),
    borderBottomLeftRadius: moderateScale(20),
    borderBottomRightRadius: moderateScale(20),
  },

  welcomeText: {
    fontSize: moderateScale(14),
    fontFamily: FONTS.regular,
    color: COLORS.white + 'CC',
  },

  userName: {
    fontSize: moderateScale(24),
    fontFamily: FONTS.bold,
    color: COLORS.white,
    marginTop: moderateScale(4),
  },

  dateBox: {
    marginTop: moderateScale(12),
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(6),
    backgroundColor: COLORS.white + '20',
    borderRadius: moderateScale(8),
    alignSelf: 'flex-start',
  },

  dateText: {
    fontSize: moderateScale(12),
    fontFamily: FONTS.regular,
    color: COLORS.white,
  },

  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: moderateScale(15),
    marginTop: moderateScale(-20),
  },

  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: moderateScale(12),
    padding: moderateScale(15),
    marginHorizontal: moderateScale(5),
    flexDirection: 'row',
    alignItems: 'center',

    ...Platform.select({
      ios: {
        shadowOpacity: 0.1,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 3 },
    }),
  },

  statIcon: {
    width: moderateScale(50),
    height: moderateScale(50),
    borderRadius: moderateScale(25),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: moderateScale(12),
  },

  statInfo: {
    flex: 1,
  },

  statValue: {
    fontSize: moderateScale(18),
    fontFamily: FONTS.bold,
    color: COLORS.dark,
  },

  statTitle: {
    fontSize: moderateScale(11),
    fontFamily: FONTS.regular,
    color: COLORS.gray,
    marginTop: moderateScale(4),
  },

  smallStatsRow: {
    flexDirection: 'row',
    paddingHorizontal: moderateScale(15),
    marginTop: moderateScale(15),
  },

  statCardSmall: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: moderateScale(10),
    padding: moderateScale(10),
    marginHorizontal: moderateScale(4),
    flexDirection: 'row',
    alignItems: 'center',
  },

  statIconSmall: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: moderateScale(10),
  },

  statInfoSmall: {
    flex: 1,
  },

  statValueSmall: {
    fontSize: moderateScale(16),
    fontFamily: FONTS.bold,
    color: COLORS.dark,
  },

  statTitleSmall: {
    fontSize: moderateScale(10),
    fontFamily: FONTS.regular,
    color: COLORS.gray,
  },

  section: {
    backgroundColor: COLORS.white,
    marginHorizontal: moderateScale(15),
    marginTop: moderateScale(15),
    padding: moderateScale(15),
    borderRadius: moderateScale(12),
  },

  sectionTitle: {
    fontSize: moderateScale(16),
    fontFamily: FONTS.bold,
    marginBottom: moderateScale(15),
    color: COLORS.dark,
  },

  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },

  actionButton: {
    alignItems: 'center',
  },

  actionIcon: {
    width: moderateScale(60),
    height: moderateScale(60),
    borderRadius: moderateScale(30),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: moderateScale(8),
  },

  actionText: {
    fontSize: moderateScale(12),
    fontFamily: FONTS.medium,
    color: COLORS.dark,
  },

  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: moderateScale(12),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLight,
  },

  orderNumber: {
    fontSize: moderateScale(14),
    fontFamily: FONTS.medium,
    color: COLORS.dark,
  },

  orderTime: {
    fontSize: moderateScale(11),
    fontFamily: FONTS.regular,
    color: COLORS.gray,
    marginTop: moderateScale(2),
  },

  orderAmount: {
    fontSize: moderateScale(16),
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: moderateScale(20),
  },

  emptyText: {
    marginTop: moderateScale(10),
    fontFamily: FONTS.regular,
    color: COLORS.gray,
  },
});