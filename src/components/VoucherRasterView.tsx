import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CartItem } from '../store/cartStore';
import { COLORS, FONTS } from '../config/theme';

export type VoucherRasterData = {
  shopName?: string;
  cashierName?: string;
  orderNumber: string;
  createdAt: number;
  items: CartItem[];
  totalAmount: number;
  paymentMethod: string;
  cashReceived?: number;
  change?: number;
  customerName?: string;
  customerPhone?: string;
};

const amount = (value: number) =>
  `${Math.round(Number(value || 0)).toLocaleString('my-MM')} ကျပ်`;

const paymentLabel = (method: string) => {
  switch (method) {
    case 'CASH':
      return 'ငွေသား';
    case 'TRANSFER':
      return 'Digital Pay';
    case 'CREDIT':
      return 'အကြွေး';
    default:
      return method;
  }
};

export const VoucherRasterView = ({ data }: { data: VoucherRasterData }) => {
  const createdAt = new Date(data.createdAt).toLocaleString('my-MM', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={styles.paper}>
      <Text style={styles.shopName}>{data.shopName || 'POS Myanmar'}</Text>
      <Text style={styles.subtitle}>အရောင်း Voucher</Text>
      <View style={styles.dashedLine} />

      <View style={styles.meta}>
        <Text style={styles.metaText}>Voucher: {data.orderNumber}</Text>
        <Text style={styles.metaText}>နေ့စွဲ: {createdAt}</Text>
        <Text style={styles.metaText}>Cashier: {data.cashierName || '-'}</Text>
        {data.customerName ? <Text style={styles.metaText}>Customer: {data.customerName}</Text> : null}
        {data.customerPhone ? <Text style={styles.metaText}>Phone: {data.customerPhone}</Text> : null}
      </View>

      <View style={styles.dashedLine} />
      <View style={styles.tableHeader}>
        <Text style={[styles.headerText, styles.nameColumn]}>ပစ္စည်း</Text>
        <Text style={[styles.headerText, styles.qtyColumn]}>Qty</Text>
        <Text style={[styles.headerText, styles.amountColumn]}>Amount</Text>
      </View>

      {data.items.map((item, index) => (
        <View key={`${item.product.id}-${index}`} style={styles.itemRow}>
          <View style={styles.nameColumn}>
            <Text style={styles.itemName}>{item.product.name}</Text>
            <Text style={styles.itemSub}>
              {amount(item.unitPrice)} x {item.quantity} {item.unitLabel}
            </Text>
          </View>
          <Text style={[styles.itemText, styles.qtyColumn]}>{item.quantity}</Text>
          <Text style={[styles.itemText, styles.amountColumn]}>{amount(item.totalPrice)}</Text>
        </View>
      ))}

      <View style={styles.dashedLine} />
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>စုစုပေါင်း</Text>
        <Text style={styles.totalValue}>{amount(data.totalAmount)}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Payment</Text>
        <Text style={styles.infoValue}>{paymentLabel(data.paymentMethod)}</Text>
      </View>
      {data.paymentMethod === 'CASH' ? (
        <>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>လက်ခံငွေ</Text>
            <Text style={styles.infoValue}>{amount(data.cashReceived || 0)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>ပြန်အမ်းငွေ</Text>
            <Text style={styles.infoValue}>{amount(data.change || 0)}</Text>
          </View>
        </>
      ) : null}

      <View style={styles.dashedLine} />
      <Text style={styles.footer}>ဝယ်ယူအားပေးမှုအတွက် ကျေးဇူးတင်ပါသည်။</Text>
      <Text style={styles.footerSmall}>Powered by POS Myanmar</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  paper: {
    width: 384,
    backgroundColor: COLORS.white,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 22,
  },
  shopName: {
    fontFamily: FONTS.bold,
    fontSize: 25,
    lineHeight: 41,
    color: '#000',
    textAlign: 'center',
    includeFontPadding: true,
  },
  subtitle: {
    fontFamily: FONTS.medium,
    fontSize: 15,
    lineHeight: 25,
    color: '#111',
    textAlign: 'center',
    includeFontPadding: true,
  },
  dashedLine: {
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#111',
    marginVertical: 10,
  },
  meta: { gap: 3 },
  metaText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    lineHeight: 24,
    color: '#000',
    includeFontPadding: true,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#111',
    paddingBottom: 5,
  },
  headerText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    lineHeight: 22,
    color: '#000',
    includeFontPadding: true,
  },
  itemRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderColor: '#DDD',
  },
  nameColumn: { flex: 1.65 },
  qtyColumn: { width: 42, textAlign: 'center' },
  amountColumn: { flex: 1, textAlign: 'right' },
  itemName: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    lineHeight: 24,
    color: '#000',
    includeFontPadding: true,
  },
  itemSub: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    lineHeight: 19,
    color: '#333',
    includeFontPadding: true,
  },
  itemText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    lineHeight: 22,
    color: '#000',
    includeFontPadding: true,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  totalLabel: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    lineHeight: 29,
    color: '#000',
    includeFontPadding: true,
  },
  totalValue: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    lineHeight: 30,
    color: '#000',
    includeFontPadding: true,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 3,
  },
  infoLabel: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    lineHeight: 23,
    color: '#111',
    includeFontPadding: true,
  },
  infoValue: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    lineHeight: 23,
    color: '#111',
    includeFontPadding: true,
  },
  footer: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    lineHeight: 23,
    textAlign: 'center',
    color: '#000',
    includeFontPadding: true,
  },
  footerSmall: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    lineHeight: 19,
    textAlign: 'center',
    color: '#111',
    includeFontPadding: true,
  },
});

export default VoucherRasterView;
