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
import { OrderRepository } from '../../database/repositories/orderRepository';
import {
  DEFAULT_ALERT_SETTINGS,
  InventoryAlertSettings,
  inventoryAlertService,
} from '../../services/alerts/inventoryAlertService';

interface DashboardStats {
  todaySales: number;
  todayOrders: number;
  totalProducts: number;
  lowStockCount: number;
  expiryAlertCount: number;
  todayProfit: number;
}

interface RecentOrder {
  id: number;
  orderNumber: string;
  totalAmount: number;
  paymentMethod: string;
  createdAt: string;
}

const latestOrdersFirst = <T extends { createdAt: string }>(orders: T[]): T[] =>
  [...orders].sort((a, b) => {
    const timeDifference = Date.parse(b.createdAt) - Date.parse(a.createdAt);
    return Number.isNaN(timeDifference) ? 0 : timeDifference;
  });

export const DashboardScreen = ({ navigation }: any) => {
  const { user } = useAuthStore();
  const { products, fetchProducts } = useProductStore();

  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0,
    todayOrders: 0,
    totalProducts: 0,
    lowStockCount: 0,
    expiryAlertCount: 0,
    todayProfit: 0,
  });
  const [alertSettings, setAlertSettings] = useState<InventoryAlertSettings>(DEFAULT_ALERT_SETTINGS);

  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isMounted = useRef(true);
  const hasLoaded = useRef(false);

  // =========================
  // FETCH DASHBOARD DATA
  // =========================
  const fetchDashboardData = useCallback(async () => {
    if (!isMounted.current) return;
    
    try {
      if (!hasLoaded.current) setLoading(true);
      console.log('📊 Loading dashboard data...');

      // =========================
      // FETCH PRODUCTS
      // =========================
      await fetchProducts();
      const currentProducts = useProductStore.getState().products;
      console.log('✅ Products loaded:', currentProducts.length);

      let orders: any[];
      try {
        const ordersResponse = await orderApi.getTodayOrders();
        orders = Array.isArray(ordersResponse) ? ordersResponse : [];
        await OrderRepository.cacheServerOrders(orders);
      } catch {
        orders = await OrderRepository.getToday();
        console.log('Using offline dashboard orders:', orders.length);
      }
      orders = latestOrdersFirst(orders);
      console.log('✅ Orders loaded:', orders.length);

      // =========================
      // CALCULATIONS
      // =========================
      const totalSales = orders.reduce(
        (sum: number, order: any) => sum + Number(order.totalAmount || 0),
        0
      );

      const todayProfit = orders.reduce(
        (sum: number, order: any) => sum + Number(order.totalProfit || 0),
        0
      );

      const currentAlertSettings = await inventoryAlertService.getSettings();
      setAlertSettings(currentAlertSettings);
      const lowStockCount = currentProducts.filter(
        (product: any) => product.stock <= currentAlertSettings.lowStockCount
      ).length;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expiryAlertCount = currentProducts.filter((product: any) => {
        if (!product.expiryDate) return false;
        const expiry = new Date(`${product.expiryDate}T00:00:00`);
        const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
        return daysLeft <= currentAlertSettings.expiryDays;
      }).length;

      // =========================
      // UPDATE STATE
      // =========================
      if (isMounted.current) {
        setStats({
          todaySales: totalSales,
          todayOrders: orders.length,
          totalProducts: currentProducts.length,
          lowStockCount,
          expiryAlertCount,
          todayProfit,
        });
        setRecentOrders(orders.slice(0, 5));
      }

      console.log('✅ Dashboard data loaded successfully');
    } catch (error: any) {
      console.error('❌ Dashboard data error:', error.message);
      if (isMounted.current) {
        const currentProducts = useProductStore.getState().products;
        const offlineOrders = await OrderRepository.getToday();
        const totalSales = offlineOrders.reduce(
          (sum, order) => sum + Number(order.totalAmount || 0),
          0
        );
        // Fallback values
        setStats({
          todaySales: totalSales,
          todayOrders: offlineOrders.length,
          totalProducts: currentProducts.length,
          lowStockCount: currentProducts.filter(
            (p: any) => p.stock <= alertSettings.lowStockCount
          ).length,
          expiryAlertCount: currentProducts.filter((p: any) => {
            if (!p.expiryDate) return false;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const expiry = new Date(`${p.expiryDate}T00:00:00`);
            return Math.ceil((expiry.getTime() - today.getTime()) / 86400000) <= alertSettings.expiryDays;
          }).length,
          todayProfit: offlineOrders.reduce(
            (sum, order) => sum + Number(order.totalProfit || 0),
            0
          ),
        });
        setRecentOrders(latestOrdersFirst(offlineOrders).slice(0, 5));
      }
    } finally {
      if (isMounted.current) {
        hasLoaded.current = true;
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

  const AlertRow = ({ title, detail, value, icon, color, onPress }: any) => (
    <TouchableOpacity style={styles.alertRow} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.alertIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <View style={styles.alertInfo}>
        <Text style={styles.alertTitle}>{title}</Text>
        <Text style={styles.alertDetail}>{detail}</Text>
      </View>
      <View style={[styles.alertCount, { backgroundColor: color }]}>
        <Text style={styles.alertCountText}>{value}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
    </TouchableOpacity>
  );

  const QuickAction = ({ title, icon, color, onPress }: any) => (
    <TouchableOpacity style={styles.actionButton} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.actionIcon, { backgroundColor: color + '16' }]}>
        <Ionicons name={icon} size={25} color={color} />
      </View>
      <Text style={styles.actionText}>{title}</Text>
    </TouchableOpacity>
  );

  // =========================
  // MAIN UI
  // =========================
  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
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
        <View style={styles.headerTop}>
          <View style={styles.headerGreeting}>
            <Text style={styles.welcomeText}>မင်္ဂလာပါ!</Text>
            <Text style={styles.userName} numberOfLines={1}>{user?.fullName || 'ဧည့်သည်'}</Text>
          </View>
          <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
            <Ionicons name="refresh-outline" size={22} color={COLORS.white} />
          </TouchableOpacity>
        </View>
        <View style={styles.dateRow}>
          <Ionicons name="calendar-clear-outline" size={15} color={COLORS.white + 'CC'} />
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

      <TouchableOpacity
        style={styles.salesSummary}
        onPress={() => navigation.navigate('Sales')}
        activeOpacity={0.8}
      >
        <View style={styles.salesSummaryTop}>
          <View>
            <Text style={styles.salesLabel}>ယနေ့ရောင်းရငွေ</Text>
            <Text style={styles.salesValue}>{formatCurrency(stats.todaySales)}</Text>
          </View>
          <View style={styles.salesIcon}>
            <Ionicons name="wallet-outline" size={26} color={COLORS.secondary} />
          </View>
        </View>
        <View style={styles.summaryMetrics}>
          <View style={styles.summaryMetric}>
            <Text style={styles.metricValue}>{stats.todayOrders}</Text>
            <Text style={styles.metricLabel}>ယနေ့အရောင်း</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.summaryMetric}>
            <Text style={styles.metricValue}>{formatCurrency(stats.todayProfit)}</Text>
            <Text style={styles.metricLabel}>ယနေ့အမြတ်</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.gray} />
        </View>
      </TouchableOpacity>

      <View style={styles.contentSection}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>ဂရုပြုရန်</Text>
            <Text style={styles.sectionSubtitle}>ပစ္စည်းစာရင်းကို စစ်ဆေးပါ</Text>
          </View>
          <View style={styles.productTotal}>
            <Text style={styles.productTotalValue}>{stats.totalProducts}</Text>
            <Text style={styles.productTotalLabel}>ပစ္စည်း</Text>
          </View>
        </View>
        <View style={styles.alertList}>
          <AlertRow
            title="Stock ကျန်နည်း"
            detail={`${alertSettings.lowStockCount} ခုနှင့်အောက် ကျန်ရှိသောပစ္စည်း`}
            value={stats.lowStockCount}
            icon="warning-outline"
            color={stats.lowStockCount > 0 ? COLORS.warning : COLORS.gray}
            onPress={() => navigation.navigate('Inventory', {
              filter: 'lowStock',
              lowStockCount: alertSettings.lowStockCount,
            })}
          />
          <AlertRow
            title="သက်တမ်းသတိပေး"
            detail={`ကုန်ပြီးနှင့် ${alertSettings.expiryDays} ရက်အတွင်းကုန်မည့်ပစ္စည်း`}
            value={stats.expiryAlertCount}
            icon="calendar-outline"
            color={stats.expiryAlertCount > 0 ? COLORS.danger : COLORS.gray}
            onPress={() => navigation.navigate('Inventory', {
              filter: 'expiry',
              expiryDays: alertSettings.expiryDays,
            })}
          />
        </View>
      </View>

      {/* QUICK ACTIONS */}
      <View style={styles.contentSection}>
        <Text style={styles.sectionTitle}>အမြန်လုပ်ဆောင်ရန်</Text>
        <View style={styles.actionButtons}>
          <QuickAction title="ရောင်းရန်" icon="cart-outline" color={COLORS.primary}
            onPress={() => navigation.navigate('POS')} />
          <QuickAction title="ပစ္စည်းစာရင်း" icon="cube-outline" color={COLORS.success}
            onPress={() => navigation.navigate('Inventory')} />
          <QuickAction title="အရောင်းမှတ်တမ်း" icon="stats-chart-outline" color={COLORS.info}
            onPress={() => navigation.navigate('Sales')} />
        </View>
      </View>

      {/* RECENT ORDERS */}
      <View style={[styles.contentSection, styles.lastSection]}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>လတ်တလောအရောင်း</Text>
            <Text style={styles.sectionSubtitle}>ယနေ့နောက်ဆုံး အရောင်းများ</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Sales')}>
            <Text style={styles.viewAllText}>အားလုံးကြည့်ရန်</Text>
          </TouchableOpacity>
        </View>
        {recentOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={38} color={COLORS.gray} />
            <Text style={styles.emptyText}>ယနေ့အတွက် အရောင်းမရှိသေးပါ</Text>
          </View>
        ) : (
          recentOrders.map((order, index) => (
            <TouchableOpacity
              key={order.id || index}
              style={[styles.orderItem, index === recentOrders.length - 1 && styles.lastOrderItem]}
              onPress={() => navigation.navigate('Sales')}
            >
              <View style={styles.orderIcon}>
                <Ionicons name="receipt-outline" size={19} color={COLORS.primary} />
              </View>
              <View style={styles.orderInfo}>
                <Text style={styles.orderNumber}>{order.orderNumber}</Text>
                <Text style={styles.orderTime}>
                  {new Date(order.createdAt).toLocaleTimeString('my-MM', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
              <Text style={styles.orderAmount}>{formatCurrency(order.totalAmount)}</Text>
            </TouchableOpacity>
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
    paddingHorizontal: moderateScale(18),
    paddingTop: moderateScale(18),
    paddingBottom: moderateScale(24),
  },

  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  headerGreeting: {
    flex: 1,
    marginRight: moderateScale(12),
  },

  welcomeText: {
    fontSize: moderateScale(12),
    fontFamily: FONTS.regular,
    color: COLORS.white + 'B8',
  },

  userName: {
    fontSize: moderateScale(21),
    fontFamily: FONTS.bold,
    color: COLORS.white,
    marginTop: moderateScale(2),
  },

  refreshButton: {
    width: moderateScale(42),
    height: moderateScale(42),
    borderRadius: moderateScale(8),
    backgroundColor: COLORS.white + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },

  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(6),
    marginTop: moderateScale(12),
  },

  dateText: {
    fontSize: moderateScale(11),
    fontFamily: FONTS.regular,
    color: COLORS.white + 'CC',
  },

  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: moderateScale(10),
    marginTop: moderateScale(-18),
  },

  statCard: {
    flex: 1,
    minHeight: moderateScale(116),
    backgroundColor: COLORS.white,
    borderRadius: moderateScale(12),
    padding: moderateScale(14),
    marginHorizontal: moderateScale(5),
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.black,
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
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: moderateScale(10),
  },

  statInfo: {
    flex: 1,
  },

  statValue: {
    fontSize: moderateScale(17),
    fontFamily: FONTS.bold,
    color: COLORS.dark,
  },

  statTitle: {
    marginTop: moderateScale(4),
    fontSize: moderateScale(10),
    lineHeight: moderateScale(15),
    fontFamily: FONTS.regular,
    color: COLORS.gray,
  },

  smallStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: moderateScale(11),
    marginTop: moderateScale(14),
    gap: moderateScale(8),
  },

  statCardSmall: {
    width: '48%',
    minHeight: moderateScale(112),
    backgroundColor: COLORS.white,
    borderRadius: moderateScale(10),
    alignItems: 'center',
    justifyContent: 'center',
    padding: moderateScale(10),
  },

  statIconSmall: {
    width: moderateScale(42),
    height: moderateScale(42),
    borderRadius: moderateScale(21),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: moderateScale(6),
  },

  statValueSmall: {
    fontSize: moderateScale(15),
    fontFamily: FONTS.bold,
    color: COLORS.dark,
  },

  statTitleSmall: {
    marginTop: moderateScale(3),
    fontSize: moderateScale(9),
    lineHeight: moderateScale(13),
    fontFamily: FONTS.regular,
    color: COLORS.gray,
    textAlign: 'center',
  },

  salesSummary: {
    backgroundColor: COLORS.white,
    marginHorizontal: moderateScale(14),
    marginTop: moderateScale(-12),
    borderRadius: moderateScale(8),
    padding: moderateScale(16),
    ...Platform.select({
      ios: {
        shadowColor: COLORS.black,
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
      },
      android: { elevation: 3 },
    }),
  },

  salesSummaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  salesLabel: {
    fontSize: moderateScale(12),
    fontFamily: FONTS.medium,
    color: COLORS.gray,
  },

  salesValue: {
    marginTop: moderateScale(4),
    fontSize: moderateScale(24),
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },

  salesIcon: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: moderateScale(8),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.secondary + '16',
  },

  summaryMetrics: {
    marginTop: moderateScale(16),
    paddingTop: moderateScale(14),
    borderTopWidth: 1,
    borderTopColor: COLORS.grayLight,
    flexDirection: 'row',
    alignItems: 'center',
  },

  summaryMetric: {
    flex: 1,
  },

  metricDivider: {
    width: 1,
    height: moderateScale(32),
    backgroundColor: COLORS.grayLight,
    marginHorizontal: moderateScale(14),
  },

  metricValue: {
    fontSize: moderateScale(15),
    fontFamily: FONTS.bold,
    color: COLORS.dark,
  },

  metricLabel: {
    marginTop: moderateScale(2),
    fontSize: moderateScale(10),
    fontFamily: FONTS.regular,
    color: COLORS.gray,
  },

  contentSection: {
    marginTop: moderateScale(20),
    paddingHorizontal: moderateScale(14),
  },

  section: {
    backgroundColor: COLORS.white,
    marginHorizontal: moderateScale(14),
    marginTop: moderateScale(16),
    padding: moderateScale(15),
    borderRadius: moderateScale(12),
    ...Platform.select({
      ios: {
        shadowColor: COLORS.black,
        shadowOpacity: 0.05,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 1 },
    }),
  },

  lastSection: {
    paddingBottom: moderateScale(30),
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: moderateScale(11),
  },

  sectionTitle: {
    fontSize: moderateScale(16),
    fontFamily: FONTS.bold,
    color: COLORS.dark,
  },

  sectionSubtitle: {
    marginTop: moderateScale(2),
    fontSize: moderateScale(10),
    fontFamily: FONTS.regular,
    color: COLORS.gray,
  },

  productTotal: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: moderateScale(4),
  },

  productTotalValue: {
    fontSize: moderateScale(18),
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },

  productTotalLabel: {
    fontSize: moderateScale(10),
    fontFamily: FONTS.regular,
    color: COLORS.gray,
  },

  alertList: {
    backgroundColor: COLORS.white,
    borderRadius: moderateScale(8),
    overflow: 'hidden',
  },

  alertRow: {
    minHeight: moderateScale(72),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(10),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLight,
  },

  alertIcon: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(8),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: moderateScale(10),
  },

  alertInfo: {
    flex: 1,
    marginRight: moderateScale(8),
  },

  alertTitle: {
    fontSize: moderateScale(13),
    fontFamily: FONTS.bold,
    color: COLORS.dark,
  },

  alertDetail: {
    marginTop: moderateScale(2),
    fontSize: moderateScale(9),
    lineHeight: moderateScale(14),
    fontFamily: FONTS.regular,
    color: COLORS.gray,
  },

  alertCount: {
    minWidth: moderateScale(28),
    height: moderateScale(28),
    paddingHorizontal: moderateScale(6),
    borderRadius: moderateScale(8),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: moderateScale(5),
  },

  alertCountText: {
    fontSize: moderateScale(12),
    fontFamily: FONTS.bold,
    color: COLORS.white,
  },

  actionButtons: {
    flexDirection: 'row',
    gap: moderateScale(8),
    marginTop: moderateScale(11),
  },

  actionButton: {
    flex: 1,
    minHeight: moderateScale(88),
    backgroundColor: COLORS.white,
    borderRadius: moderateScale(8),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: moderateScale(5),
    paddingVertical: moderateScale(10),
  },

  actionIcon: {
    width: moderateScale(42),
    height: moderateScale(42),
    borderRadius: moderateScale(8),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: moderateScale(7),
  },

  actionText: {
    fontSize: moderateScale(10),
    fontFamily: FONTS.medium,
    color: COLORS.dark,
    textAlign: 'center',
  },

  viewAllText: {
    fontSize: moderateScale(10),
    fontFamily: FONTS.medium,
    color: COLORS.info,
  },

  orderItem: {
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(11),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLight,
  },

  lastOrderItem: {
    borderBottomWidth: 0,
  },

  orderIcon: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: moderateScale(8),
    backgroundColor: COLORS.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: moderateScale(10),
  },

  orderInfo: {
    flex: 1,
  },

  orderNumber: {
    fontSize: moderateScale(12),
    fontFamily: FONTS.medium,
    color: COLORS.dark,
  },

  orderTime: {
    fontSize: moderateScale(9),
    fontFamily: FONTS.regular,
    color: COLORS.gray,
    marginTop: moderateScale(2),
  },

  orderAmount: {
    fontSize: moderateScale(13),
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },

  emptyState: {
    backgroundColor: COLORS.white,
    alignItems: 'center',
    paddingVertical: moderateScale(28),
    borderRadius: moderateScale(8),
  },

  emptyText: {
    marginTop: moderateScale(10),
    fontFamily: FONTS.regular,
    color: COLORS.gray,
    fontSize: moderateScale(11),
  },
});
