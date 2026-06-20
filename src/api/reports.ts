import apiClient from './client';

export interface PaymentBreakdown {
  paymentMethod: string;
  orderCount: number;
  totalAmount: number;
}

export interface ProductPerformance {
  productId: number;
  productName: string;
  quantity: number;
  sales: number;
  profit: number;
}

export interface CashierPerformance {
  userId: number;
  fullName: string;
  username: string;
  orderCount: number;
  sales: number;
  profit: number;
}

export interface ReportSummary {
  totalSales: number;
  totalCost: number;
  totalProfit: number;
  profitMargin: number;
  totalOrders: number;
  itemsSold: number;
  refundAmount: number;
  refundProfitAdjustment: number;
  purchaseCost: number;
  refundCount: number;
  purchaseCount: number;
  payments: PaymentBreakdown[];
  topProducts: ProductPerformance[];
  cashiers: CashierPerformance[];
}

export interface DailyClosing {
  id: number;
  businessDate: string;
  closedAt: string;
  closedById: number;
  closedByName: string;
  totalSales: number;
  totalCost: number;
  totalProfit: number;
  profitMargin: number;
  cashExpected: number;
  cashInHand: number;
  cashDifference: number;
  digitalPayTotal: number;
  creditTotal: number;
  refundAmount: number;
  totalOrders: number;
  itemsSold: number;
  note?: string;
  summary: ReportSummary;
}

export const reportsApi = {
  getSummary: async (start: string, end: string): Promise<ReportSummary> =>
    (await apiClient.get('/reports/summary', { params: { start, end } })).data,
  getClosing: async (date: string): Promise<DailyClosing | null> => {
    const response = await apiClient.get(`/reports/closings/${date}`);
    return response.status === 204 ? null : response.data;
  },
  closeDay: async (
    date: string,
    input: { cashInHand: number; note?: string }
  ): Promise<DailyClosing> =>
    (await apiClient.post(`/reports/closings/${date}`, input)).data,
  getClosings: async (): Promise<DailyClosing[]> =>
    (await apiClient.get('/reports/closings')).data,
};
