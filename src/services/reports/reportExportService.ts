import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as XLSX from 'xlsx';
import { Platform } from 'react-native';
import { ReportSummary } from '../../api/reports';

interface ExportOrder {
  orderNumber: string;
  totalAmount: number;
  totalProfit?: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
}

interface ExportInput {
  shopName: string;
  startDate: string;
  endDate: string;
  summary: ReportSummary;
  orders: ExportOrder[];
  includeProfit: boolean;
}

const safeFileName = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '_');
const amount = (value: number) => Number(value || 0).toLocaleString('en-US');
const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const fileBase = ({ shopName, startDate, endDate }: ExportInput) =>
  `${safeFileName(shopName || 'shop')}_report_${startDate}_${endDate}`;

const saveDownload = async (
  fileName: string,
  mimeType: string,
  base64: string,
): Promise<string> => {
  if (Platform.OS === 'android') {
    const initialUri = FileSystem.StorageAccessFramework.getUriForDirectoryInRoot('Download');
    const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(initialUri);
    if (!permission.granted) throw new Error('Download folder မရွေးထားပါ');
    const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
      permission.directoryUri,
      fileName.replace(/\.[^.]+$/, ''),
      mimeType,
    );
    await FileSystem.StorageAccessFramework.writeAsStringAsync(fileUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return fileName;
  }

  if (!FileSystem.documentDirectory) throw new Error('Documents folder မရရှိပါ');
  const reportDirectory = `${FileSystem.documentDirectory}POS Reports/`;
  await FileSystem.makeDirectoryAsync(reportDirectory, { intermediates: true });
  const fileUri = `${reportDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return `POS Reports/${fileName}`;
};

export const reportExportService = {
  exportPdf: async (input: ExportInput): Promise<string> => {
    const { shopName, startDate, endDate, summary, orders, includeProfit } = input;
    const metric = (label: string, value: string) =>
      `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
    const rows = (values: string[][]) => values.map(row =>
      `<tr>${row.map(value => `<td>${escapeHtml(value)}</td>`).join('')}</tr>`
    ).join('');

    const html = `<!DOCTYPE html>
      <html><head><meta charset="UTF-8"><style>
        body{font-family:Arial,sans-serif;color:#263238;padding:24px;font-size:11px}
        h1{font-size:23px;color:#182A4E;margin:0} h2{font-size:15px;color:#182A4E;margin:24px 0 8px}
        .sub{color:#607D8B;margin-top:4px}.metrics{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}
        .metric{width:29%;border:1px solid #E0E0E0;padding:10px;border-radius:5px}
        .metric span{display:block;color:#78909C;font-size:9px}.metric strong{display:block;margin-top:4px;font-size:14px}
        table{width:100%;border-collapse:collapse}th{background:#182A4E;color:white;text-align:left;padding:7px}
        td{border-bottom:1px solid #E0E0E0;padding:7px}.footer{margin-top:24px;color:#90A4AE;font-size:9px}
      </style></head><body>
      <h1>${escapeHtml(shopName)}</h1><div class="sub">အစီရင်ခံစာ • ${startDate} မှ ${endDate}</div>
      <div class="metrics">
        ${metric('စုစုပေါင်းရောင်းရငွေ', `${amount(summary.totalSales)} ကျပ်`)}
        ${metric('Orders', String(summary.totalOrders))}
        ${metric('Items Sold', String(summary.itemsSold))}
        ${includeProfit ? metric('အရင်းစုစုပေါင်း', `${amount(summary.totalCost)} ကျပ်`) : ''}
        ${includeProfit ? metric('အသားတင်အမြတ်', `${amount(summary.totalProfit)} ကျပ်`) : ''}
        ${includeProfit ? metric('Profit Margin', `${Number(summary.profitMargin || 0).toFixed(1)}%`) : ''}
      </div>
      <h2>Payment Breakdown</h2>
      <table><thead><tr><th>Payment</th><th>Orders</th><th>Amount</th></tr></thead><tbody>
        ${rows(summary.payments.map(item => [item.paymentMethod, String(item.orderCount), amount(item.totalAmount)]))}
      </tbody></table>
      ${includeProfit ? `<h2>ရောင်းရဆုံး Products</h2><table><thead><tr><th>Product</th><th>Qty</th><th>Sales</th><th>Profit</th></tr></thead><tbody>
        ${rows(summary.topProducts.map(item => [item.productName, String(item.quantity), amount(item.sales), amount(item.profit)]))}
      </tbody></table>` : ''}
      ${includeProfit ? `<h2>ဝန်ထမ်း Performance</h2><table><thead><tr><th>ဝန်ထမ်း</th><th>Orders</th><th>Sales</th><th>Profit</th></tr></thead><tbody>
        ${rows(summary.cashiers.map(item => [item.fullName, String(item.orderCount), amount(item.sales), amount(item.profit)]))}
      </tbody></table>` : ''}
      <h2>အရောင်းမှတ်တမ်း</h2><table><thead><tr><th>Order</th><th>Date</th><th>Payment</th><th>Amount</th></tr></thead><tbody>
        ${rows(orders.map(item => [item.orderNumber, new Date(item.createdAt).toLocaleString(), item.paymentMethod, amount(item.totalAmount)]))}
      </tbody></table>
      <div class="footer">Generated ${new Date().toLocaleString()}</div>
      </body></html>`;

    const result = await Print.printToFileAsync({ html });
    const base64 = await FileSystem.readAsStringAsync(result.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return saveDownload(`${fileBase(input)}.pdf`, 'application/pdf', base64);
  },

  exportExcel: async (input: ExportInput): Promise<string> => {
    const { summary, orders, includeProfit } = input;
    const workbook = XLSX.utils.book_new();
    const summaryRows: (string | number)[][] = [
      ['Shop', input.shopName],
      ['Start Date', input.startDate],
      ['End Date', input.endDate],
      ['Total Sales', summary.totalSales],
      ['Total Orders', summary.totalOrders],
      ['Items Sold', summary.itemsSold],
    ];
    if (includeProfit) {
      summaryRows.push(
        ['Total Cost', summary.totalCost],
        ['Total Profit', summary.totalProfit],
        ['Profit Margin %', summary.profitMargin],
      );
    }
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summary.payments), 'Payments');
    if (includeProfit) {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summary.topProducts), 'Products');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summary.cashiers), 'Cashiers');
    }
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(orders.map(order => ({
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      paymentMethod: order.paymentMethod,
      status: order.status,
      totalAmount: order.totalAmount,
      ...(includeProfit ? { totalProfit: order.totalProfit || 0 } : {}),
    }))), 'Orders');

    const base64 = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
    return saveDownload(
      `${fileBase(input)}.xlsx`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      base64,
    );
  },
};
