import * as Print from 'expo-print';
import { CartItem } from '../../store/cartStore';
import { bluetoothPrinterService } from './bluetoothPrinterService';

export type VoucherPrintInput = {
  shopName?: string;
  shopLogoUrl?: string;
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

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const amount = (value: number) =>
  `${Math.round(Number(value || 0)).toLocaleString('my-MM')} ကျပ်`;

const paymentLabel = (method: string) => {
  switch (method) {
    case 'CASH':
      return 'ငွေသား';
    case 'CARD':
      return 'ကတ်';
    case 'QR':
      return 'QR';
    case 'TRANSFER':
      return 'Digital Pay';
    case 'CREDIT':
      return 'အကြွေး';
    default:
      return method;
  }
};

const buildVoucherHtml = (input: VoucherPrintInput) => {
  const rows = input.items.map((item) => {
    const name = escapeHtml(item.product.name);
    return `
      <tr>
        <td class="name">${name}<span>${amount(item.unitPrice)} x ${item.quantity} ${escapeHtml(item.unitLabel)}</span></td>
        <td class="qty">${item.quantity}</td>
        <td class="price">${amount(item.totalPrice)}</td>
      </tr>
    `;
  }).join('');

  const createdAt = new Date(input.createdAt).toLocaleString('my-MM', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          @page { margin: 0; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            background: #fff;
            color: #111;
            font-family: "Noto Sans Myanmar", "Myanmar Text", sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .voucher {
            width: 72mm;
            padding: 10px 9px 14px;
            background: #fff;
          }
          .shop {
            text-align: center;
            font-size: 20px;
            font-weight: 800;
            line-height: 1.45;
          }
          .shop-logo {
            display: block;
            width: 44px;
            height: 44px;
            object-fit: cover;
            border-radius: 8px;
            margin: 0 auto 5px;
          }
          .subtitle {
            margin-top: 3px;
            text-align: center;
            font-size: 11px;
            color: #444;
          }
          .line {
            border-top: 1px dashed #222;
            margin: 9px 0;
          }
          .meta {
            display: grid;
            gap: 3px;
            font-size: 11px;
            line-height: 1.5;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
          }
          th {
            padding: 4px 0 5px;
            border-bottom: 1px solid #222;
            font-size: 10px;
            text-align: left;
          }
          td {
            padding: 6px 0;
            border-bottom: 1px dotted #bbb;
            vertical-align: top;
          }
          .name {
            width: 55%;
            line-height: 1.45;
            word-break: break-word;
          }
          .name span {
            display: block;
            margin-top: 2px;
            color: #555;
            font-size: 10px;
          }
          .qty {
            width: 13%;
            text-align: center;
          }
          .price {
            width: 32%;
            text-align: right;
            white-space: nowrap;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            margin-top: 5px;
            font-size: 12px;
          }
          .grand {
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid #222;
            font-size: 16px;
            font-weight: 800;
          }
          .footer {
            margin-top: 12px;
            text-align: center;
            font-size: 11px;
            line-height: 1.7;
          }
        </style>
      </head>
      <body>
        <main class="voucher">
          ${input.shopLogoUrl ? `<img class="shop-logo" src="${escapeHtml(input.shopLogoUrl)}" />` : ''}
          <section class="shop">${escapeHtml(input.shopName || 'POS Myanmar')}</section>
          <section class="subtitle">အရောင်း Voucher</section>
          <div class="line"></div>
          <section class="meta">
            <div>Voucher: ${escapeHtml(input.orderNumber)}</div>
            <div>နေ့စွဲ: ${escapeHtml(createdAt)}</div>
            <div>Cashier: ${escapeHtml(input.cashierName || '-')}</div>
            ${input.customerName ? `<div>Customer: ${escapeHtml(input.customerName)} ${input.customerPhone ? `(${escapeHtml(input.customerPhone)})` : ''}</div>` : ''}
          </section>
          <div class="line"></div>
          <table>
            <thead>
              <tr><th>ပစ္စည်း</th><th class="qty">Qty</th><th class="price">Amount</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <section>
            <div class="total-row grand"><span>စုစုပေါင်း</span><span>${amount(input.totalAmount)}</span></div>
            <div class="total-row"><span>Payment</span><span>${escapeHtml(paymentLabel(input.paymentMethod))}</span></div>
            ${input.paymentMethod === 'CASH' ? `<div class="total-row"><span>လက်ခံငွေ</span><span>${amount(input.cashReceived || 0)}</span></div>` : ''}
            ${input.paymentMethod === 'CASH' ? `<div class="total-row"><span>ပြန်အမ်းငွေ</span><span>${amount(input.change || 0)}</span></div>` : ''}
          </section>
          <div class="line"></div>
          <section class="footer">
            ဝယ်ယူအားပေးမှုအတွက် ကျေးဇူးတင်ပါသည်။<br />
            Powered by POS Myanmar
          </section>
        </main>
      </body>
    </html>
  `;
};

export const voucherPrintService = {
  print: async (input: VoucherPrintInput) => {
    const savedPrinter = await bluetoothPrinterService.getSavedPrinter();
    if (savedPrinter && bluetoothPrinterService.isNativeAvailable()) {
      await bluetoothPrinterService.printVoucher(input);
      return;
    }

    await Print.printAsync({
      html: buildVoucherHtml(input),
    });
  },

  printImage: async (input: VoucherPrintInput, pngBase64: string) => {
    const savedPrinter = await bluetoothPrinterService.getSavedPrinter();
    if (savedPrinter && bluetoothPrinterService.isNativeAvailable()) {
      await bluetoothPrinterService.printVoucherImageBase64(pngBase64);
      return;
    }

    await Print.printAsync({
      html: buildVoucherHtml(input),
    });
  },
};
