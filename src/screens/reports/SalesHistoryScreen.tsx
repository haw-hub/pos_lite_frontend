import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { orderApi } from '../../api/orders';
import { DailyClosing, ReportSummary, reportsApi } from '../../api/reports';
import { DatePickerModal } from '../../components/DatePickerModal';
import { COLORS, FONTS } from '../../config/theme';
import { OrderRepository } from '../../database/repositories/orderRepository';
import { useAuthStore } from '../../store/authStore';
import { reportExportService } from '../../services/reports/reportExportService';
import { formatCurrency } from '../../utils/currency';
import { moderateScale } from '../../utils/responsive';

type Period = 'today' | 'week' | 'month' | 'custom';
type IconName = React.ComponentProps<typeof Ionicons>['name'];

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
  payments: [],
  topProducts: [],
  cashiers: [],
};

export const SalesHistoryScreen = () => {
  const user = useAuthStore(state => state.user);
  const role = user?.role;
  const canViewProfit = role === 'ADMIN' || role === 'MANAGER';
  const initialDates = periodDates('today');
  const [period, setPeriod] = useState<Period>('today');
  const [startDate, setStartDate] = useState(initialDates.start);
  const [endDate, setEndDate] = useState(initialDates.end);
  const [picker, setPicker] = useState<'start' | 'end' | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<ReportSummary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [closing, setClosing] = useState<DailyClosing | null>(null);
  const [closingVisible, setClosingVisible] = useState(false);
  const [closingLoading, setClosingLoading] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);

  const selectPeriod = (next: Exclude<Period, 'custom'>) => {
    const dates = periodDates(next);
    setPeriod(next);
    setStartDate(dates.start);
    setEndDate(dates.end);
  };

  const fetchReport = useCallback(async () => {
    try {
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
    if (!canViewProfit) return;
    try {
      setClosing(await reportsApi.getClosing(endDate));
    } catch {
      setClosing(null);
    }
  }, [canViewProfit, endDate]);

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

  const closeSelectedDay = () => {
    Alert.alert(
      'နေ့ပိတ်စာရင်း သိမ်းမည်',
      `${endDate} ရက်၏ လက်ရှိ report ကို အပြီးသတ် snapshot အဖြစ်သိမ်းမည်။ သိမ်းပြီးနောက် ပြန်ပြင်၍မရပါ။`,
      [
        { text: 'မလုပ်တော့ပါ', style: 'cancel' },
        {
          text: 'နေ့ပိတ်မည်',
          onPress: async () => {
            setClosingLoading(true);
            try {
              const result = await reportsApi.closeDay(endDate);
              setClosing(result);
              setClosingVisible(true);
            } catch (error: any) {
              Alert.alert('မအောင်မြင်ပါ', error.response?.data?.message || 'နေ့ပိတ်စာရင်း မသိမ်းနိုင်ပါ');
            } finally {
              setClosingLoading(false);
            }
          },
        },
      ],
    );
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

  const paymentText = (method: string) =>
    ({ CASH: 'ငွေသား', CARD: 'ကတ်', QR: 'QR', TRANSFER: 'ငွေလွှဲ', CREDIT: 'အကြွေး' }[method] || method);

  const renderOrder = ({ item }: { item: Order }) => (
    <View style={styles.orderRow}>
      <View style={styles.orderIcon}><Ionicons name="receipt-outline" size={19} color={COLORS.primary} /></View>
      <View style={styles.orderInfo}>
        <Text style={styles.orderNumber}>{item.orderNumber}</Text>
        <Text style={styles.orderMeta}>
          {new Date(item.createdAt).toLocaleString('my-MM', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          {'  •  '}{paymentText(item.paymentMethod)}
        </Text>
      </View>
      <Text style={styles.orderAmount}>{formatCurrency(item.totalAmount)}</Text>
    </View>
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
        </View>
      ) : (
        <View style={styles.restricted}>
          <Ionicons name="lock-closed-outline" size={18} color={COLORS.gray} />
          <Text style={styles.restrictedText}>အမြတ်နှင့် performance report ကို Admin/Manager သာကြည့်နိုင်သည်</Text>
        </View>
      )}

      {canViewProfit && (
        <TouchableOpacity
          style={[styles.closingAction, closing && styles.closedAction]}
          onPress={() => closing ? setClosingVisible(true) : closeSelectedDay()}
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
    </View>
  );

  if (loading) return <View style={styles.loading}><ActivityIndicator color={COLORS.primary} /><Text style={styles.loadingText}>Report တွက်ချက်နေသည်...</Text></View>;

  return (
    <View style={styles.container}>
      <FlatList
        data={orders}
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
              <>
                <View style={styles.closedByRow}>
                  <Ionicons name="checkmark-circle" size={21} color={COLORS.success} />
                  <Text style={styles.closedByText}>{closing.closedByName} မှ {new Date(closing.closedAt).toLocaleString('my-MM')} တွင်ပိတ်ခဲ့သည်</Text>
                </View>
                <View style={styles.closingTotal}>
                  <Text style={styles.closingTotalLabel}>စုစုပေါင်းရောင်းရငွေ</Text>
                  <Text style={styles.closingTotalValue}>{formatCurrency(closing.totalSales)}</Text>
                </View>
                <View style={styles.closingGrid}>
                  <View style={styles.closingMetric}><Text style={styles.closingMetricLabel}>အရင်း</Text><Text style={styles.closingMetricValue}>{formatCurrency(closing.totalCost)}</Text></View>
                  <View style={styles.closingMetric}><Text style={styles.closingMetricLabel}>အမြတ်</Text><Text style={styles.closingMetricValue}>{formatCurrency(closing.totalProfit)}</Text></View>
                  <View style={styles.closingMetric}><Text style={styles.closingMetricLabel}>Orders</Text><Text style={styles.closingMetricValue}>{closing.totalOrders}</Text></View>
                  <View style={styles.closingMetric}><Text style={styles.closingMetricLabel}>Items</Text><Text style={styles.closingMetricValue}>{closing.itemsSold}</Text></View>
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
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F8' },
  content: { padding: moderateScale(14), paddingBottom: moderateScale(30) },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white },
  loadingText: { marginTop: 10, fontFamily: FONTS.regular, color: COLORS.gray },
  periodBar: { flexDirection: 'row', backgroundColor: COLORS.white, padding: 4, borderRadius: 8, gap: 4 },
  periodButton: { flex: 1, height: 38, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  periodActive: { backgroundColor: COLORS.primary },
  periodText: { fontFamily: FONTS.medium, fontSize: moderateScale(12), color: COLORS.dark },
  periodTextActive: { color: COLORS.white, fontFamily: FONTS.bold },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  dateButton: { flex: 1, backgroundColor: COLORS.white, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: COLORS.grayLight },
  dateLabel: { fontFamily: FONTS.regular, fontSize: moderateScale(10), color: COLORS.gray },
  dateValue: { fontFamily: FONTS.bold, fontSize: moderateScale(12), color: COLORS.dark, marginTop: 2 },
  exportRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  exportButton: { flex: 1, height: 43, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: COLORS.white, borderRadius: 8, borderWidth: 1, borderColor: COLORS.grayLight },
  exportPdfText: { fontFamily: FONTS.bold, color: COLORS.danger, fontSize: moderateScale(12) },
  exportExcelText: { fontFamily: FONTS.bold, color: COLORS.success, fontSize: moderateScale(12) },
  hero: { backgroundColor: COLORS.primary, borderRadius: 8, padding: moderateScale(18), marginTop: 12 },
  heroLabel: { color: COLORS.white + 'B8', fontFamily: FONTS.medium, fontSize: moderateScale(12) },
  heroValue: { color: COLORS.white, fontFamily: FONTS.bold, fontSize: moderateScale(29), marginTop: 5 },
  heroMeta: { flexDirection: 'row', gap: 18, marginTop: 12 },
  heroMetaText: { color: COLORS.white + 'CC', fontFamily: FONTS.medium, fontSize: moderateScale(11) },
  metricsGrid: { flexDirection: 'row', gap: 8, marginTop: 10 },
  metric: { flex: 1, minHeight: 105, backgroundColor: COLORS.white, borderRadius: 8, padding: 10 },
  metricIcon: { width: 34, height: 34, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  metricValue: { fontFamily: FONTS.bold, color: COLORS.dark, fontSize: moderateScale(14), marginTop: 9 },
  metricLabel: { fontFamily: FONTS.regular, color: COLORS.gray, fontSize: moderateScale(10), marginTop: 2 },
  restricted: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.white, padding: 12, borderRadius: 8, marginTop: 10 },
  restrictedText: { flex: 1, fontFamily: FONTS.regular, color: COLORS.gray, fontSize: moderateScale(11) },
  closingAction: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 8, padding: 12, marginTop: 10, borderWidth: 1, borderColor: COLORS.secondary + '55' },
  closedAction: { borderColor: COLORS.success + '55' },
  closingIcon: { width: 42, height: 42, borderRadius: 8, backgroundColor: COLORS.secondary, alignItems: 'center', justifyContent: 'center' },
  closedIcon: { backgroundColor: COLORS.success },
  closingInfo: { flex: 1, marginLeft: 10, marginRight: 6 },
  closingTitle: { fontFamily: FONTS.bold, color: COLORS.dark, fontSize: moderateScale(12) },
  closingDetail: { fontFamily: FONTS.regular, color: COLORS.gray, fontSize: moderateScale(10), marginTop: 2 },
  section: { backgroundColor: COLORS.white, borderRadius: 8, padding: 13, marginTop: 12 },
  sectionTitle: { fontFamily: FONTS.bold, color: COLORS.dark, fontSize: moderateScale(16) },
  breakdownRow: { marginTop: 13 },
  breakdownTop: { flexDirection: 'row', justifyContent: 'space-between' },
  breakdownName: { fontFamily: FONTS.medium, color: COLORS.dark, fontSize: moderateScale(12) },
  breakdownAmount: { fontFamily: FONTS.bold, color: COLORS.primary, fontSize: moderateScale(12) },
  track: { height: 5, backgroundColor: COLORS.grayLight, borderRadius: 3, marginTop: 6, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: COLORS.secondary },
  breakdownCount: { fontFamily: FONTS.regular, color: COLORS.gray, fontSize: moderateScale(10), marginTop: 3 },
  rankRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: COLORS.grayLight },
  rank: { width: 26, fontFamily: FONTS.bold, color: COLORS.secondary, fontSize: moderateScale(15) },
  rankInfo: { flex: 1 },
  rankName: { fontFamily: FONTS.medium, color: COLORS.dark, fontSize: moderateScale(12) },
  rankMeta: { fontFamily: FONTS.regular, color: COLORS.gray, fontSize: moderateScale(10), marginTop: 2 },
  rankAmount: { fontFamily: FONTS.bold, color: COLORS.primary, fontSize: moderateScale(11) },
  cashierRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.grayLight },
  cashierIcon: { width: 34, height: 34, borderRadius: 7, backgroundColor: COLORS.primary + '12', alignItems: 'center', justifyContent: 'center' },
  ordersTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 5 },
  ordersCount: { fontFamily: FONTS.bold, color: COLORS.primary, backgroundColor: COLORS.white, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 6 },
  orderRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 8, padding: 11, marginTop: 7 },
  orderIcon: { width: 36, height: 36, borderRadius: 7, backgroundColor: COLORS.primary + '12', alignItems: 'center', justifyContent: 'center' },
  orderInfo: { flex: 1, marginLeft: 10 },
  orderNumber: { fontFamily: FONTS.bold, color: COLORS.dark, fontSize: moderateScale(12) },
  orderMeta: { fontFamily: FONTS.regular, color: COLORS.gray, fontSize: moderateScale(10), marginTop: 2 },
  orderAmount: { fontFamily: FONTS.bold, color: COLORS.primary, fontSize: moderateScale(13) },
  empty: { alignItems: 'center', paddingVertical: 35 },
  emptyText: { fontFamily: FONTS.regular, color: COLORS.gray, marginTop: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 18 },
  closingModal: { backgroundColor: COLORS.white, borderRadius: 8, padding: 16, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontFamily: FONTS.bold, color: COLORS.dark, fontSize: moderateScale(18) },
  modalDate: { fontFamily: FONTS.medium, color: COLORS.gray, fontSize: moderateScale(11), marginTop: 2 },
  modalClose: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  closedByRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.success + '12', borderRadius: 8, padding: 10, marginTop: 14 },
  closedByText: { flex: 1, fontFamily: FONTS.regular, color: COLORS.dark, fontSize: moderateScale(10) },
  closingTotal: { backgroundColor: COLORS.primary, borderRadius: 8, padding: 15, marginTop: 12 },
  closingTotalLabel: { fontFamily: FONTS.medium, color: COLORS.white + 'B8', fontSize: moderateScale(11) },
  closingTotalValue: { fontFamily: FONTS.bold, color: COLORS.white, fontSize: moderateScale(24), marginTop: 4 },
  closingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  closingMetric: { width: '48%', backgroundColor: '#F4F6F8', borderRadius: 8, padding: 10 },
  closingMetricLabel: { fontFamily: FONTS.regular, color: COLORS.gray, fontSize: moderateScale(10) },
  closingMetricValue: { fontFamily: FONTS.bold, color: COLORS.dark, fontSize: moderateScale(12), marginTop: 3 },
  closingPayments: { marginTop: 14 },
  closingPaymentsTitle: { fontFamily: FONTS.bold, color: COLORS.dark, fontSize: moderateScale(13), marginBottom: 5 },
  closingPaymentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: COLORS.grayLight },
  closingPaymentName: { fontFamily: FONTS.medium, color: COLORS.dark, fontSize: moderateScale(11) },
  closingPaymentAmount: { fontFamily: FONTS.bold, color: COLORS.primary, fontSize: moderateScale(11) },
});

export default SalesHistoryScreen;
