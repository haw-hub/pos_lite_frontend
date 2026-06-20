import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { orderApi } from '../../api/orders';
import { DailyClosing, ReportSummary, reportsApi } from '../../api/reports';
import { DatePickerModal } from '../../components/DatePickerModal';
import { COLORS, FONTS } from '../../config/theme';
import { OrderRepository } from '../../database/repositories/orderRepository';
import { SyncQueueRepository } from '../../database/repositories/syncQueueRepository';
import { useAuthStore } from '../../store/authStore';
import { reportExportService } from '../../services/reports/reportExportService';
import { formatCurrency } from '../../utils/currency';
import { moderateScale } from '../../utils/responsive';
import { SHOP_FEATURES, useFeature } from '../../hooks/useFeature';

type Period = 'today' | 'week' | 'month' | 'custom';
type IconName = React.ComponentProps<typeof Ionicons>['name'];

const screenWidth = Dimensions.get('window').width;
const androidFontBoost = Platform.OS === 'android' ? 1.12 : 1;
const rf = (size: number) => Math.round(moderateScale(size) * androidFontBoost);
const reportPadding = Platform.OS === 'android' ? moderateScale(12) : moderateScale(14);
const metricGap = moderateScale(8);
const metricWidth = Math.floor((screenWidth - reportPadding * 2 - metricGap * 2) / 3);
const ORDERS_PER_PAGE = 10;

interface Order {
  id: number;
  orderNumber: string;
  totalAmount: number;
  totalProfit?: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
}

const dateValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const periodDates = (period: Exclude<Period, 'custom'>) => {
  const end = new Date();
  const start = new Date();
  if (period === 'week') start.setDate(start.getDate() - 6);
  if (period === 'month') start.setDate(1);
  return { start: dateValue(start), end: dateValue(end) };
};

const emptySummary: ReportSummary = {
  totalSales: 0,
  totalCost: 0,
  totalProfit: 0,
  profitMargin: 0,
  totalOrders: 0,
  itemsSold: 0,
  refundAmount: 0,
  refundProfitAdjustment: 0,
  purchaseCost: 0,
  refundCount: 0,
  purchaseCount: 0,
  payments: [],
  topProducts: [],
  cashiers: [],
};

export const SalesHistoryScreen = () => {
  const user = useAuthStore(state => state.user);
  const role = user?.role;
  const canViewProfit = role === 'ADMIN' || role === 'MANAGER';
  const canRefund = role === 'ADMIN' || role === 'MANAGER';
  const canUseDailyClosing = useFeature(SHOP_FEATURES.DAILY_CLOSING);
  const canUseStockIn = useFeature(SHOP_FEATURES.STOCK_IN);
  const initialDates = periodDates('today');
  const [period, setPeriod] = useState<Period>('today');
  const [startDate, setStartDate] = useState(initialDates.start);
  const [endDate, setEndDate] = useState(initialDates.end);
  const [picker, setPicker] = useState<'start' | 'end' | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderPage, setOrderPage] = useState(1);
  const [summary, setSummary] = useState<ReportSummary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [closing, setClosing] = useState<DailyClosing | null>(null);
  const [closingVisible, setClosingVisible] = useState(false);
  const [closingFormVisible, setClosingFormVisible] = useState(false);
  const [closingLoading, setClosingLoading] = useState(false);
  const [closingHistory, setClosingHistory] = useState<DailyClosing[]>([]);
  const [cashInHand, setCashInHand] = useState('');
  const [closingNote, setClosingNote] = useState('');
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [orderDetailLoading, setOrderDetailLoading] = useState(false);
  const [refundItem, setRefundItem] = useState<any | null>(null);
  const [refundQty, setRefundQty] = useState('1');
  const [refundReason, setRefundReason] = useState('');
  const [refunding, setRefunding] = useState(false);

  const selectPeriod = (next: Exclude<Period, 'custom'>) => {
    const dates = periodDates(next);
    setPeriod(next);
    setStartDate(dates.start);
    setEndDate(dates.end);
    setOrderPage(1);
  };

  const fetchReport = useCallback(async () => {
    try {
      const pendingSync = await SyncQueueRepository.getPending().catch(() => []);
      setPendingSyncCount(pendingSync.length);
      const response = await orderApi.getAll();
      const serverOrders = Array.isArray(response) ? response : [];
      await OrderRepository.cacheServerOrders(serverOrders);
      const filtered = serverOrders
        .filter(order => {
          const created = String(order.createdAt).slice(0, 10);
          return created >= startDate && created <= endDate;
        })
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      setOrders(filtered);

      if (canViewProfit) {
        setSummary(await reportsApi.getSummary(startDate, endDate));
      } else {
        setSummary({
          ...emptySummary,
          totalSales: filtered.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0),
          totalOrders: filtered.length,
        });
      }
    } catch {
      const pendingSync = await SyncQueueRepository.getPending().catch(() => []);
      setPendingSyncCount(pendingSync.length);
      const localOrders = await OrderRepository.getAll();
      const filtered = localOrders.filter(order => {
        const created = order.createdAt.slice(0, 10);
        return created >= startDate && created <= endDate;
      });
      setOrders(filtered);
      setSummary({
        ...emptySummary,
        totalSales: filtered.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0),
        totalProfit: canViewProfit
          ? filtered.reduce((sum, item) => sum + Number(item.totalProfit || 0), 0)
          : 0,
        totalOrders: filtered.length,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [startDate, endDate, canViewProfit]);

  const fetchClosing = useCallback(async () => {
    if (!canViewProfit || !canUseDailyClosing) {
      setClosing(null);
      setClosingHistory([]);
      return;
    }
    try {
      setClosing(await reportsApi.getClosing(endDate));
      setClosingHistory(await reportsApi.getClosings());
    } catch {
      setClosing(null);
    }
  }, [canViewProfit, canUseDailyClosing, endDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  useFocusEffect(useCallback(() => {
    fetchReport();
    fetchClosing();
    return () => undefined;
  }, [fetchReport, fetchClosing]));

  useEffect(() => {
    fetchClosing();
  }, [fetchClosing]);

  useEffect(() => {
    setOrderPage(1);
  }, [startDate, endDate]);

  const openClosingForm = () => {
    setCashInHand(String(cashExpected));
    setClosingNote('');
    setClosingFormVisible(true);
  };

  const submitClosing = async (countedCash: number) => {
    setClosingLoading(true);
    try {
      const result = await reportsApi.closeDay(endDate, {
        cashInHand: countedCash,
        note: closingNote.trim() || undefined,
      });
      setClosing(result);
      setClosingHistory(current => [result, ...current.filter(item => item.id !== result.id)]);
      setClosingFormVisible(false);
      setClosingVisible(true);
    } catch (error: any) {
      Alert.alert('မအောင်မြင်ပါ', error.response?.data?.message || 'နေ့ပိတ်စာရင်း မသိမ်းနိုင်ပါ');
    } finally {
      setClosingLoading(false);
    }
  };

  const confirmClosing = async () => {
    const countedCash = Number(cashInHand || 0);
    if (!Number.isFinite(countedCash) || countedCash < 0) {
      Alert.alert('သတိပေးချက်', 'လက်ထဲရှိငွေသားကိုမှန်ကန်စွာထည့်ပါ');
      return;
    }
    if (pendingSyncCount > 0) {
      Alert.alert(
        'Offline data မတင်ရသေးပါ',
        `${pendingSyncCount} ခု sync မပြီးသေးပါ။ အင်တာနက်ပြန်ရပြီး sync ပြီးမှနေ့ပိတ်တာပိုမှန်ပါမယ်။ ဆက်လုပ်မလား`,
        [
          { text: 'မလုပ်တော့ပါ', style: 'cancel' },
          { text: 'ဆက်လုပ်မည်', onPress: () => submitClosing(countedCash) },
        ],
      );
      return;
    }
    await submitClosing(countedCash);
  };

  const exportReport = async (type: 'pdf' | 'excel') => {
    setExporting(type);
    try {
      const input = {
        shopName: user?.shopName || 'POS Myanmar',
        startDate,
        endDate,
        summary,
        orders,
        includeProfit: canViewProfit,
        closing: canUseDailyClosing ? closing : null,
      };
      const fileName = type === 'pdf'
        ? await reportExportService.exportPdf(input)
        : await reportExportService.exportExcel(input);
      Alert.alert('Download ပြီးပါပြီ', `${fileName} ကိုသိမ်းပြီးပါပြီ`);
    } catch (error: any) {
      Alert.alert('Export မအောင်မြင်ပါ', error.message || 'Report file မထုတ်နိုင်ပါ');
    } finally {
      setExporting(null);
    }
  };

  const paymentTotal = useMemo(
    () => Math.max(summary.totalSales, ...summary.payments.map(item => item.totalAmount), 1),
    [summary]
  );
  const paymentAmount = (method: string) =>
    summary.payments.find(item => item.paymentMethod === method)?.totalAmount || 0;
  const cashExpected = paymentAmount('CASH');
  const digitalPayTotal = paymentAmount('TRANSFER');
  const creditTotal = paymentAmount('CREDIT');
  const cashDifference = Number(cashInHand || 0) - cashExpected;

  const paymentText = (method: string) =>
    ({ CASH: 'ငွေသား', CARD: 'ကတ်', QR: 'QR', TRANSFER: 'Digital Pay', CREDIT: 'အကြွေး' }[method] || method);

  const openOrderDetail = async (order: Order) => {
    if (!canRefund) return;
    setOrderDetailLoading(true);
    try {
      setSelectedOrder(await orderApi.getById(order.id));
    } catch (error: any) {
      Alert.alert('မအောင်မြင်ပါ', error.response?.data?.message || 'Order detail မဖတ်နိုင်ပါ');
    } finally {
      setOrderDetailLoading(false);
    }
  };

  const closeRefundModal = () => {
    setRefundItem(null);
    setRefundQty('1');
    setRefundReason('');
  };

  const submitRefund = async () => {
    if (!selectedOrder || !refundItem) return;
    const quantity = Number(refundQty);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      Alert.alert('Quantity မှားနေသည်', 'ပြန်အမ်းမည့် အရေအတွက်ကို မှန်ကန်စွာ ထည့်ပါ');
      return;
    }
    setRefunding(true);
    try {
      await orderApi.refund(selectedOrder.id, {
        orderItemId: refundItem.id,
        quantity,
        reason: refundReason.trim() || undefined,
      });
      Alert.alert('ပြန်အမ်းပြီးပါပြီ', 'Stock ပြန်တိုးပြီး report တွင် refund amount ခွဲပြပါမည်');
      closeRefundModal();
      setSelectedOrder(null);
      await fetchReport();
    } catch (error: any) {
      Alert.alert('Refund မအောင်မြင်ပါ', error.response?.data?.message || 'Internet နှင့် server ကို စစ်ပြီး ထပ်လုပ်ပါ');
    } finally {
      setRefunding(false);
    }
  };

  const itemProductName = (item: any) =>
    item.productName || item.product?.name || `Product #${item.productId || item.product?.id || '-'}`;

  const totalOrderPages = Math.max(1, Math.ceil(orders.length / ORDERS_PER_PAGE));
  const safeOrderPage = Math.min(orderPage, totalOrderPages);
  const pagedOrders = orders.slice((safeOrderPage - 1) * ORDERS_PER_PAGE, safeOrderPage * ORDERS_PER_PAGE);
  const orderStart = orders.length === 0 ? 0 : (safeOrderPage - 1) * ORDERS_PER_PAGE + 1;
  const orderEnd = Math.min(safeOrderPage * ORDERS_PER_PAGE, orders.length);

  const renderOrder = ({ item }: { item: Order }) => (
    <TouchableOpacity style={styles.orderRow} onPress={() => openOrderDetail(item)} disabled={!canRefund}>
      <View style={styles.orderIcon}><Ionicons name="receipt-outline" size={19} color={COLORS.primary} /></View>
      <View style={styles.orderInfo}>
        <Text style={styles.orderNumber}>{item.orderNumber}</Text>
        <Text style={styles.orderMeta}>
          {new Date(item.createdAt).toLocaleString('my-MM', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          {'  •  '}{paymentText(item.paymentMethod)}
        </Text>
      </View>
      <Text style={styles.orderAmount}>{formatCurrency(item.totalAmount)}</Text>
      {canRefund ? <Ionicons name="chevron-forward" size={18} color={COLORS.gray} /> : null}
    </TouchableOpacity>
  );

  const Metric = ({ label, value, icon, color = COLORS.primary }: { label: string; value: string; icon: IconName; color?: string }) => (
    <View style={styles.metric}>
      <View style={[styles.metricIcon, { backgroundColor: color + '14' }]}><Ionicons name={icon} size={19} color={color} /></View>
      <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );

  const header = (
    <View>
      <View style={styles.periodBar}>
        {([
          ['today', 'ယနေ့'],
          ['week', '၇ ရက်'],
          ['month', 'ယခုလ'],
        ] as const).map(([value, label]) => (
          <TouchableOpacity key={value} style={[styles.periodButton, period === value && styles.periodActive]} onPress={() => selectPeriod(value)}>
            <Text style={[styles.periodText, period === value && styles.periodTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[styles.periodButton, period === 'custom' && styles.periodActive]} onPress={() => { setPeriod('custom'); setPicker('start'); }}>
          <Ionicons name="calendar-outline" size={17} color={period === 'custom' ? COLORS.white : COLORS.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.rangeRow}>
        <TouchableOpacity style={styles.dateButton} onPress={() => { setPeriod('custom'); setPicker('start'); }}>
          <Text style={styles.dateLabel}>စတင်</Text><Text style={styles.dateValue}>{startDate}</Text>
        </TouchableOpacity>
        <Ionicons name="arrow-forward" size={17} color={COLORS.gray} />
        <TouchableOpacity style={styles.dateButton} onPress={() => { setPeriod('custom'); setPicker('end'); }}>
          <Text style={styles.dateLabel}>ဆုံး</Text><Text style={styles.dateValue}>{endDate}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.exportRow}>
        <TouchableOpacity style={styles.exportButton} onPress={() => exportReport('pdf')} disabled={exporting !== null}>
          {exporting === 'pdf' ? <ActivityIndicator color={COLORS.danger} /> : <Ionicons name="document-text-outline" size={20} color={COLORS.danger} />}
          <Text style={styles.exportPdfText}>PDF Download</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.exportButton} onPress={() => exportReport('excel')} disabled={exporting !== null}>
          {exporting === 'excel' ? <ActivityIndicator color={COLORS.success} /> : <Ionicons name="grid-outline" size={20} color={COLORS.success} />}
          <Text style={styles.exportExcelText}>Excel Download</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroLabel}>စုစုပေါင်းရောင်းရငွေ</Text>
        <Text style={styles.heroValue}>{formatCurrency(summary.totalSales)}</Text>
        <View style={styles.heroMeta}>
          <Text style={styles.heroMetaText}>{summary.totalOrders} orders</Text>
          <Text style={styles.heroMetaText}>{summary.itemsSold} items sold</Text>
        </View>
      </View>

      {canViewProfit ? (
        <View style={styles.metricsGrid}>
          <Metric label="အရင်းစုစုပေါင်း" value={formatCurrency(summary.totalCost)} icon="cube-outline" color={COLORS.info} />
          <Metric label="အသားတင်အမြတ်" value={formatCurrency(summary.totalProfit)} icon="trending-up-outline" color={COLORS.success} />
          <Metric label="အမြတ်ရာခိုင်နှုန်း" value={`${Number(summary.profitMargin || 0).toFixed(1)}%`} icon="pie-chart-outline" color={COLORS.secondary} />
          <Metric label="Refund" value={formatCurrency(summary.refundAmount || 0)} icon="return-up-back-outline" color={COLORS.danger} />
          {canUseStockIn ? <Metric label="Stock In" value={formatCurrency(summary.purchaseCost || 0)} icon="download-outline" color={COLORS.warning} /> : null}
        </View>
      ) : (
        <View style={styles.restricted}>
          <Ionicons name="lock-closed-outline" size={18} color={COLORS.gray} />
          <Text style={styles.restrictedText}>အမြတ်နှင့် performance report ကို Admin/Manager သာကြည့်နိုင်သည်</Text>
        </View>
      )}

      {canViewProfit && canUseDailyClosing && (
        <TouchableOpacity
          style={[styles.closingAction, closing && styles.closedAction]}
          onPress={() => closing ? setClosingVisible(true) : openClosingForm()}
          disabled={closingLoading}
        >
          <View style={[styles.closingIcon, closing && styles.closedIcon]}>
            {closingLoading
              ? <ActivityIndicator color={COLORS.white} />
              : <Ionicons name={closing ? 'checkmark-done-outline' : 'lock-closed-outline'} size={22} color={COLORS.white} />}
          </View>
          <View style={styles.closingInfo}>
            <Text style={styles.closingTitle}>{closing ? 'နေ့ပိတ်စာရင်း သိမ်းပြီး' : 'ဆိုင်ပိတ်ချိန် Daily Closing'}</Text>
            <Text style={styles.closingDetail}>
              {closing ? `${closing.closedByName} • ${new Date(closing.closedAt).toLocaleString('my-MM')}` : `${endDate} ရက်၏ report ကို အပြီးသတ်သိမ်းမည်`}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.gray} />
        </TouchableOpacity>
      )}

      {summary.payments.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Breakdown</Text>
          {summary.payments.map(item => (
            <View key={item.paymentMethod} style={styles.breakdownRow}>
              <View style={styles.breakdownTop}>
                <Text style={styles.breakdownName}>{paymentText(item.paymentMethod)}</Text>
                <Text style={styles.breakdownAmount}>{formatCurrency(item.totalAmount)}</Text>
              </View>
              <View style={styles.track}><View style={[styles.fill, { width: `${(item.totalAmount / paymentTotal) * 100}%` }]} /></View>
              <Text style={styles.breakdownCount}>{item.orderCount} orders</Text>
            </View>
          ))}
        </View>
      )}

      {canViewProfit && summary.topProducts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ရောင်းရဆုံး Products</Text>
          {summary.topProducts.map((item, index) => (
            <View key={item.productId} style={styles.rankRow}>
              <Text style={styles.rank}>{index + 1}</Text>
              <View style={styles.rankInfo}><Text style={styles.rankName}>{item.productName}</Text><Text style={styles.rankMeta}>{item.quantity} ခု • အမြတ် {formatCurrency(item.profit)}</Text></View>
              <Text style={styles.rankAmount}>{formatCurrency(item.sales)}</Text>
            </View>
          ))}
        </View>
      )}

      {canViewProfit && summary.cashiers.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ဝန်ထမ်း Performance</Text>
          {summary.cashiers.map(item => (
            <View key={item.userId} style={styles.cashierRow}>
              <View style={styles.cashierIcon}><Ionicons name="person-outline" size={18} color={COLORS.primary} /></View>
              <View style={styles.rankInfo}><Text style={styles.rankName}>{item.fullName}</Text><Text style={styles.rankMeta}>{item.orderCount} orders • အမြတ် {formatCurrency(item.profit)}</Text></View>
              <Text style={styles.rankAmount}>{formatCurrency(item.sales)}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.ordersTitleRow}>
        <Text style={styles.sectionTitle}>အရောင်းမှတ်တမ်း</Text>
        <Text style={styles.ordersCount}>{orders.length}</Text>
      </View>
      {orders.length > ORDERS_PER_PAGE ? (
        <View style={styles.paginationInfoRow}>
          <Text style={styles.paginationInfo}>{orderStart}-{orderEnd} / {orders.length}</Text>
          <View style={styles.paginationButtons}>
            <TouchableOpacity
              style={[styles.pageButton, safeOrderPage <= 1 && styles.pageButtonDisabled]}
              onPress={() => setOrderPage(page => Math.max(1, page - 1))}
              disabled={safeOrderPage <= 1}
            >
              <Ionicons name="chevron-back" size={18} color={safeOrderPage <= 1 ? COLORS.gray : COLORS.primary} />
            </TouchableOpacity>
            <Text style={styles.pageText}>{safeOrderPage}/{totalOrderPages}</Text>
            <TouchableOpacity
              style={[styles.pageButton, safeOrderPage >= totalOrderPages && styles.pageButtonDisabled]}
              onPress={() => setOrderPage(page => Math.min(totalOrderPages, page + 1))}
              disabled={safeOrderPage >= totalOrderPages}
            >
              <Ionicons name="chevron-forward" size={18} color={safeOrderPage >= totalOrderPages ? COLORS.gray : COLORS.primary} />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );

  if (loading) return <View style={styles.loading}><ActivityIndicator color={COLORS.primary} /><Text style={styles.loadingText}>Report တွက်ချက်နေသည်...</Text></View>;

  return (
    <View style={styles.container}>
      <FlatList
        data={pagedOrders}
        renderItem={renderOrder}
        keyExtractor={(item, index) => String(item.id || index)}
        ListHeaderComponent={header}
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="receipt-outline" size={40} color={COLORS.gray} /><Text style={styles.emptyText}>ဤကာလအတွင်း အရောင်းမရှိပါ</Text></View>}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchReport(); }} colors={[COLORS.primary]} />}
      />
      <DatePickerModal
        visible={picker !== null}
        value={picker === 'start' ? startDate : endDate}
        onSelect={value => {
          if (picker === 'start') {
            setStartDate(value);
            if (value > endDate) setEndDate(value);
          } else {
            setEndDate(value);
            if (value < startDate) setStartDate(value);
          }
        }}
        onClear={() => undefined}
        onClose={() => setPicker(null)}
      />
      {orderDetailLoading ? (
        <View style={styles.detailLoading}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : null}
      <Modal visible={selectedOrder !== null} transparent animationType="fade" onRequestClose={() => setSelectedOrder(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedOrder(null)}>
          <Pressable style={styles.orderModal}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Refund</Text>
                <Text style={styles.modalDate}>{selectedOrder?.orderNumber}</Text>
              </View>
              <TouchableOpacity style={styles.modalClose} onPress={() => setSelectedOrder(null)}>
                <Ionicons name="close" size={22} color={COLORS.dark} />
              </TouchableOpacity>
            </View>
            <Text style={styles.refundHint}>Admin/Manager approval ဖြင့်သာ item ပြန်အမ်းနိုင်ပါသည်။ Refund လုပ်ပြီးပါက stock ပြန်တိုးပါမည်။</Text>
            {(selectedOrder?.items || []).map((item: any) => (
              <View key={item.id} style={styles.refundItemRow}>
                <View style={styles.rankInfo}>
                  <Text style={styles.rankName}>{itemProductName(item)}</Text>
                  <Text style={styles.rankMeta}>{item.quantity} items • {formatCurrency(Number(item.totalPrice || 0))}</Text>
                </View>
                <TouchableOpacity
                  style={styles.refundButton}
                  onPress={() => {
                    setRefundItem(item);
                    setRefundQty('1');
                    setRefundReason('');
                  }}
                >
                  <Ionicons name="return-up-back-outline" size={16} color={COLORS.white} />
                  <Text style={styles.refundButtonText}>Refund</Text>
                </TouchableOpacity>
              </View>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
      <Modal visible={refundItem !== null} transparent animationType="fade" onRequestClose={closeRefundModal}>
        <Pressable style={styles.modalOverlay} onPress={closeRefundModal}>
          <Pressable style={styles.refundModal}>
            <Text style={styles.modalTitle}>ပြန်အမ်းရန်</Text>
            <Text style={styles.modalDate}>{refundItem ? itemProductName(refundItem) : ''}</Text>
            <Text style={styles.inputLabel}>Quantity</Text>
            <TextInput
              style={styles.refundInput}
              value={refundQty}
              onChangeText={setRefundQty}
              keyboardType="number-pad"
            />
            <Text style={styles.inputLabel}>Reason</Text>
            <TextInput
              style={[styles.refundInput, styles.refundReasonInput]}
              value={refundReason}
              onChangeText={setRefundReason}
              placeholder="ဥပမာ - customer return"
              placeholderTextColor={COLORS.gray}
              multiline
            />
            <View style={styles.refundActions}>
              <TouchableOpacity style={[styles.refundActionButton, styles.cancelRefund]} onPress={closeRefundModal}>
                <Text style={styles.cancelRefundText}>မလုပ်တော့ပါ</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.refundActionButton, styles.confirmRefund]} onPress={submitRefund} disabled={refunding}>
                {refunding ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.confirmRefundText}>Refund လုပ်မည်</Text>}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal visible={closingFormVisible} transparent animationType="fade" onRequestClose={() => setClosingFormVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setClosingFormVisible(false)}>
          <Pressable style={styles.closingModal}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>ဆိုင်ပိတ်ချိန် စာရင်းစစ်</Text>
                <Text style={styles.modalDate}>{endDate}</Text>
              </View>
              <TouchableOpacity style={styles.modalClose} onPress={() => setClosingFormVisible(false)}>
                <Ionicons name="close" size={22} color={COLORS.dark} />
              </TouchableOpacity>
            </View>

            {pendingSyncCount > 0 ? (
              <View style={styles.warningBox}>
                <Ionicons name="warning-outline" size={19} color={COLORS.warning} />
                <Text style={styles.warningText}>{pendingSyncCount} ခု sync မပြီးသေးပါ။ Sync ပြီးမှနေ့ပိတ်တာပိုမှန်ပါမယ်။</Text>
              </View>
            ) : null}
            <ScrollView style={styles.closingScroll} contentContainerStyle={styles.closingScrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.closingGrid}>
                <View style={styles.closingMetric}><Text style={styles.closingMetricLabel}>App ထဲ Cash</Text><Text style={styles.closingMetricValue}>{formatCurrency(cashExpected)}</Text></View>
                <View style={styles.closingMetric}><Text style={styles.closingMetricLabel}>Digital Pay</Text><Text style={styles.closingMetricValue}>{formatCurrency(digitalPayTotal)}</Text></View>
                <View style={styles.closingMetric}><Text style={styles.closingMetricLabel}>အကြွေး</Text><Text style={styles.closingMetricValue}>{formatCurrency(creditTotal)}</Text></View>
                <View style={styles.closingMetric}><Text style={styles.closingMetricLabel}>Refund</Text><Text style={styles.closingMetricValue}>{formatCurrency(summary.refundAmount || 0)}</Text></View>
              </View>

              <Text style={styles.inputLabel}>လက်ထဲရှိငွေသား</Text>
              <TextInput
                style={styles.refundInput}
                value={cashInHand}
                onChangeText={setCashInHand}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={COLORS.gray}
              />
              <View style={[styles.diffBox, cashDifference < 0 ? styles.diffNegative : cashDifference > 0 ? styles.diffPositive : styles.diffEven]}>
                <Text style={styles.diffLabel}>Cash Difference</Text>
                <Text style={styles.diffValue}>{formatCurrency(cashDifference)}</Text>
              </View>

              <Text style={styles.inputLabel}>မှတ်ချက်</Text>
              <TextInput
                style={[styles.refundInput, styles.refundReasonInput]}
                value={closingNote}
                onChangeText={setClosingNote}
                placeholder="ဥပမာ - cash ပို/လိုရင်း၊ KPay စစ်ပြီး"
                placeholderTextColor={COLORS.gray}
                multiline
              />

              <View style={styles.refundActions}>
                <TouchableOpacity style={[styles.refundActionButton, styles.cancelRefund]} onPress={() => setClosingFormVisible(false)}>
                  <Text style={styles.cancelRefundText}>မလုပ်တော့ပါ</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.refundActionButton, styles.confirmRefund]} onPress={confirmClosing} disabled={closingLoading}>
                  {closingLoading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.confirmRefundText}>နေ့ပိတ်မည်</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal visible={closingVisible} transparent animationType="fade" onRequestClose={() => setClosingVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setClosingVisible(false)}>
          <Pressable style={styles.closingModal}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>နေ့ပိတ်စာရင်း</Text>
                <Text style={styles.modalDate}>{closing?.businessDate}</Text>
              </View>
              <TouchableOpacity style={styles.modalClose} onPress={() => setClosingVisible(false)}>
                <Ionicons name="close" size={22} color={COLORS.dark} />
              </TouchableOpacity>
            </View>
            {closing && (
              <ScrollView style={styles.closingScroll} contentContainerStyle={styles.closingScrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.closedByRow}>
                  <Ionicons name="checkmark-circle" size={21} color={COLORS.success} />
                  <Text style={styles.closedByText}>{closing.closedByName} မှ {new Date(closing.closedAt).toLocaleString('my-MM')} တွင်ပိတ်ခဲ့သည်</Text>
                </View>
                <View style={styles.closingTotal}>
                  <Text style={styles.closingTotalLabel}>စုစုပေါင်းရောင်းရငွေ</Text>
                  <Text style={styles.closingTotalValue}>{formatCurrency(closing.totalSales)}</Text>
                </View>
                <View style={styles.closingGrid}>
                  <View style={styles.closingMetric}><Text style={styles.closingMetricLabel}>App Cash</Text><Text style={styles.closingMetricValue}>{formatCurrency(closing.cashExpected || 0)}</Text></View>
                  <View style={styles.closingMetric}><Text style={styles.closingMetricLabel}>လက်ထဲ Cash</Text><Text style={styles.closingMetricValue}>{formatCurrency(closing.cashInHand || 0)}</Text></View>
                  <View style={styles.closingMetric}><Text style={styles.closingMetricLabel}>ကွာခြားချက်</Text><Text style={styles.closingMetricValue}>{formatCurrency(closing.cashDifference || 0)}</Text></View>
                  <View style={styles.closingMetric}><Text style={styles.closingMetricLabel}>Digital Pay</Text><Text style={styles.closingMetricValue}>{formatCurrency(closing.digitalPayTotal || 0)}</Text></View>
                  <View style={styles.closingMetric}><Text style={styles.closingMetricLabel}>အကြွေး</Text><Text style={styles.closingMetricValue}>{formatCurrency(closing.creditTotal || 0)}</Text></View>
                  <View style={styles.closingMetric}><Text style={styles.closingMetricLabel}>Refund</Text><Text style={styles.closingMetricValue}>{formatCurrency(closing.refundAmount || 0)}</Text></View>
                  <View style={styles.closingMetric}><Text style={styles.closingMetricLabel}>အရင်း</Text><Text style={styles.closingMetricValue}>{formatCurrency(closing.totalCost)}</Text></View>
                  <View style={styles.closingMetric}><Text style={styles.closingMetricLabel}>အမြတ်</Text><Text style={styles.closingMetricValue}>{formatCurrency(closing.totalProfit)}</Text></View>
                  <View style={styles.closingMetric}><Text style={styles.closingMetricLabel}>Orders</Text><Text style={styles.closingMetricValue}>{closing.totalOrders}</Text></View>
                  <View style={styles.closingMetric}><Text style={styles.closingMetricLabel}>Items</Text><Text style={styles.closingMetricValue}>{closing.itemsSold}</Text></View>
                </View>
                {closing.note ? <Text style={styles.closingNote}>မှတ်ချက်: {closing.note}</Text> : null}
                <View style={styles.exportRow}>
                  <TouchableOpacity style={styles.exportButton} onPress={() => exportReport('pdf')} disabled={exporting !== null}>
                    <Ionicons name="document-text-outline" size={19} color={COLORS.danger} />
                    <Text style={styles.exportPdfText}>PDF</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.exportButton} onPress={() => exportReport('excel')} disabled={exporting !== null}>
                    <Ionicons name="grid-outline" size={19} color={COLORS.success} />
                    <Text style={styles.exportExcelText}>Excel</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.closingPayments}>
                  <Text style={styles.closingPaymentsTitle}>Payment Summary</Text>
                  {closing.summary.payments.map(item => (
                    <View key={item.paymentMethod} style={styles.closingPaymentRow}>
                      <Text style={styles.closingPaymentName}>{paymentText(item.paymentMethod)}</Text>
                      <Text style={styles.closingPaymentAmount}>{formatCurrency(item.totalAmount)}</Text>
                    </View>
                  ))}
                </View>
                {closingHistory.length > 0 ? (
                  <View style={styles.closingPayments}>
                    <Text style={styles.closingPaymentsTitle}>Closing History</Text>
                    {closingHistory.slice(0, 7).map(item => (
                      <TouchableOpacity key={item.id} style={styles.closingPaymentRow} onPress={() => {
                        setClosing(item);
                        setClosingVisible(true);
                      }}>
                        <Text style={styles.closingPaymentName}>{item.businessDate}</Text>
                        <Text style={styles.closingPaymentAmount}>{formatCurrency(item.totalSales)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F8' },
  content: { padding: reportPadding, paddingBottom: moderateScale(30) },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white },
  loadingText: { marginTop: 10, fontFamily: FONTS.regular, color: COLORS.gray },
  periodBar: { flexDirection: 'row', backgroundColor: COLORS.white, padding: 4, borderRadius: 8, gap: 4 },
  periodButton: { flex: 1, height: 38, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  periodActive: { backgroundColor: COLORS.primary },
  periodText: { fontFamily: FONTS.medium, fontSize: rf(13), color: COLORS.dark },
  periodTextActive: { color: COLORS.white, fontFamily: FONTS.bold },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  dateButton: { flex: 1, backgroundColor: COLORS.white, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: COLORS.grayLight },
  dateLabel: { fontFamily: FONTS.regular, fontSize: rf(11), color: COLORS.gray },
  dateValue: { fontFamily: FONTS.bold, fontSize: rf(13), color: COLORS.dark, marginTop: 2 },
  exportRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  exportButton: { flex: 1, height: 43, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: COLORS.white, borderRadius: 8, borderWidth: 1, borderColor: COLORS.grayLight },
  exportPdfText: { fontFamily: FONTS.bold, color: COLORS.danger, fontSize: rf(13) },
  exportExcelText: { fontFamily: FONTS.bold, color: COLORS.success, fontSize: rf(13) },
  hero: { backgroundColor: COLORS.primary, borderRadius: 8, padding: moderateScale(18), marginTop: 12 },
  heroLabel: { color: COLORS.white + 'B8', fontFamily: FONTS.medium, fontSize: rf(13) },
  heroValue: { color: COLORS.white, fontFamily: FONTS.bold, fontSize: rf(32), marginTop: 5 },
  heroMeta: { flexDirection: 'row', gap: 18, marginTop: 12 },
  heroMetaText: { color: COLORS.white + 'CC', fontFamily: FONTS.medium, fontSize: rf(12) },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: metricGap, marginTop: 10 },
  metric: { width: metricWidth, minHeight: Platform.OS === 'android' ? 118 : 112, backgroundColor: COLORS.white, borderRadius: 8, padding: 10 },
  metricIcon: { width: 34, height: 34, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  metricValue: { fontFamily: FONTS.bold, color: COLORS.dark, fontSize: rf(15), marginTop: 9 },
  metricLabel: { fontFamily: FONTS.regular, color: COLORS.gray, fontSize: rf(11), marginTop: 2, lineHeight: rf(18) },
  restricted: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.white, padding: 12, borderRadius: 8, marginTop: 10 },
  restrictedText: { flex: 1, fontFamily: FONTS.regular, color: COLORS.gray, fontSize: rf(12) },
  closingAction: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 8, padding: 12, marginTop: 10, borderWidth: 1, borderColor: COLORS.secondary + '55' },
  closedAction: { borderColor: COLORS.success + '55' },
  closingIcon: { width: 42, height: 42, borderRadius: 8, backgroundColor: COLORS.secondary, alignItems: 'center', justifyContent: 'center' },
  closedIcon: { backgroundColor: COLORS.success },
  closingInfo: { flex: 1, marginLeft: 10, marginRight: 6 },
  closingTitle: { fontFamily: FONTS.bold, color: COLORS.dark, fontSize: rf(13) },
  closingDetail: { fontFamily: FONTS.regular, color: COLORS.gray, fontSize: rf(11), marginTop: 2 },
  section: { backgroundColor: COLORS.white, borderRadius: 8, padding: 13, marginTop: 12 },
  sectionTitle: { fontFamily: FONTS.bold, color: COLORS.dark, fontSize: rf(18) },
  breakdownRow: { marginTop: 13 },
  breakdownTop: { flexDirection: 'row', justifyContent: 'space-between' },
  breakdownName: { fontFamily: FONTS.medium, color: COLORS.dark, fontSize: rf(13) },
  breakdownAmount: { fontFamily: FONTS.bold, color: COLORS.primary, fontSize: rf(13) },
  track: { height: 5, backgroundColor: COLORS.grayLight, borderRadius: 3, marginTop: 6, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: COLORS.secondary },
  breakdownCount: { fontFamily: FONTS.regular, color: COLORS.gray, fontSize: rf(11), marginTop: 3 },
  rankRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: COLORS.grayLight },
  rank: { width: 28, fontFamily: FONTS.bold, color: COLORS.secondary, fontSize: rf(17) },
  rankInfo: { flex: 1 },
  rankName: { fontFamily: FONTS.medium, color: COLORS.dark, fontSize: rf(13) },
  rankMeta: { fontFamily: FONTS.regular, color: COLORS.gray, fontSize: rf(11), marginTop: 2, lineHeight: rf(18) },
  rankAmount: { fontFamily: FONTS.bold, color: COLORS.primary, fontSize: rf(13) },
  cashierRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.grayLight },
  cashierIcon: { width: 34, height: 34, borderRadius: 7, backgroundColor: COLORS.primary + '12', alignItems: 'center', justifyContent: 'center' },
  ordersTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 5 },
  ordersCount: { fontFamily: FONTS.bold, color: COLORS.primary, backgroundColor: COLORS.white, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, fontSize: rf(13) },
  paginationInfoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  paginationInfo: { fontFamily: FONTS.medium, color: COLORS.gray, fontSize: rf(12) },
  paginationButtons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pageButton: { width: 34, height: 34, borderRadius: 8, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.grayLight },
  pageButtonDisabled: { opacity: 0.45 },
  pageText: { minWidth: 42, textAlign: 'center', fontFamily: FONTS.bold, color: COLORS.dark, fontSize: rf(12) },
  orderRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 8, padding: Platform.OS === 'android' ? 14 : 12, marginTop: 9 },
  orderIcon: { width: 40, height: 40, borderRadius: 7, backgroundColor: COLORS.primary + '12', alignItems: 'center', justifyContent: 'center' },
  orderInfo: { flex: 1, marginLeft: 10 },
  orderNumber: { fontFamily: FONTS.bold, color: COLORS.dark, fontSize: rf(13) },
  orderMeta: { fontFamily: FONTS.regular, color: COLORS.gray, fontSize: rf(11), marginTop: 2, lineHeight: rf(18) },
  orderAmount: { fontFamily: FONTS.bold, color: COLORS.primary, fontSize: rf(15) },
  detailLoading: { position: 'absolute', top: 18, right: 18, backgroundColor: COLORS.white, borderRadius: 8, padding: 10 },
  empty: { alignItems: 'center', paddingVertical: 35 },
  emptyText: { fontFamily: FONTS.regular, color: COLORS.gray, marginTop: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 18 },
  closingModal: { backgroundColor: COLORS.white, borderRadius: 8, padding: 16, maxHeight: '86%', overflow: 'hidden' },
  closingScroll: { marginTop: 8 },
  closingScrollContent: { paddingBottom: 8 },
  orderModal: { backgroundColor: COLORS.white, borderRadius: 8, padding: 16, maxHeight: '85%' },
  refundModal: { backgroundColor: COLORS.white, borderRadius: 8, padding: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontFamily: FONTS.bold, color: COLORS.dark, fontSize: rf(18) },
  modalDate: { fontFamily: FONTS.medium, color: COLORS.gray, fontSize: rf(11), marginTop: 2 },
  modalClose: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  closedByRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.success + '12', borderRadius: 8, padding: 10, marginTop: 14 },
  closedByText: { flex: 1, fontFamily: FONTS.regular, color: COLORS.dark, fontSize: rf(11) },
  warningBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.warning + '12', borderRadius: 8, padding: 10, marginTop: 12 },
  warningText: { flex: 1, fontFamily: FONTS.medium, color: COLORS.dark, fontSize: rf(11), lineHeight: rf(18) },
  closingTotal: { backgroundColor: COLORS.primary, borderRadius: 8, padding: 15, marginTop: 12 },
  closingTotalLabel: { fontFamily: FONTS.medium, color: COLORS.white + 'B8', fontSize: rf(12) },
  closingTotalValue: { fontFamily: FONTS.bold, color: COLORS.white, fontSize: rf(25), marginTop: 4 },
  closingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  closingMetric: { width: '48%', minHeight: 76, backgroundColor: '#F4F6F8', borderRadius: 8, padding: 10, justifyContent: 'space-between' },
  closingMetricLabel: { fontFamily: FONTS.regular, color: COLORS.gray, fontSize: rf(11) },
  closingMetricValue: { fontFamily: FONTS.bold, color: COLORS.dark, fontSize: rf(13), marginTop: 3 },
  closingPayments: { marginTop: 14 },
  closingPaymentsTitle: { fontFamily: FONTS.bold, color: COLORS.dark, fontSize: rf(14), marginBottom: 5 },
  closingPaymentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: COLORS.grayLight },
  closingPaymentName: { fontFamily: FONTS.medium, color: COLORS.dark, fontSize: rf(12) },
  closingPaymentAmount: { fontFamily: FONTS.bold, color: COLORS.primary, fontSize: rf(12) },
  diffBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 8, padding: 11, marginTop: 8 },
  diffEven: { backgroundColor: COLORS.success + '10' },
  diffPositive: { backgroundColor: COLORS.info + '12' },
  diffNegative: { backgroundColor: COLORS.danger + '10' },
  diffLabel: { fontFamily: FONTS.medium, color: COLORS.gray, fontSize: rf(12) },
  diffValue: { fontFamily: FONTS.bold, color: COLORS.dark, fontSize: rf(14) },
  closingNote: { fontFamily: FONTS.regular, color: COLORS.gray, fontSize: rf(12), lineHeight: rf(19), marginTop: 10 },
  refundHint: { fontFamily: FONTS.regular, color: COLORS.gray, fontSize: rf(12), lineHeight: rf(20), marginTop: 10 },
  refundItemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.grayLight },
  refundButton: { minHeight: 36, paddingHorizontal: 11, borderRadius: 8, backgroundColor: COLORS.danger, flexDirection: 'row', alignItems: 'center', gap: 5 },
  refundButtonText: { fontFamily: FONTS.bold, color: COLORS.white, fontSize: rf(12) },
  inputLabel: { fontFamily: FONTS.medium, color: COLORS.dark, fontSize: rf(13), marginTop: 14 },
  refundInput: { minHeight: 44, borderWidth: 1, borderColor: COLORS.grayLight, borderRadius: 8, paddingHorizontal: 12, marginTop: 6, fontFamily: FONTS.regular, color: COLORS.dark },
  refundReasonInput: { minHeight: 78, textAlignVertical: 'top', paddingTop: 10 },
  refundActions: { flexDirection: 'row', gap: 9, marginTop: 16 },
  refundActionButton: { flex: 1, minHeight: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cancelRefund: { backgroundColor: COLORS.grayLight },
  confirmRefund: { backgroundColor: COLORS.danger },
  cancelRefundText: { fontFamily: FONTS.bold, color: COLORS.dark, fontSize: rf(13) },
  confirmRefundText: { fontFamily: FONTS.bold, color: COLORS.white, fontSize: rf(13) },
});

export default SalesHistoryScreen;
