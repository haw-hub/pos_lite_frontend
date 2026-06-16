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
  totalOrders: number;
  itemsSold: number;
  summary: ReportSummary;
}

export const reportsApi = {
  getSummary: async (start: string, end: string): Promise<ReportSummary> =>
    (await apiClient.get('/reports/summary', { params: { start, end } })).data,
  getClosing: async (date: string): Promise<DailyClosing> =>
    (await apiClient.get(`/reports/closings/${date}`)).data,
  closeDay: async (date: string): Promise<DailyClosing> =>
    (await apiClient.post(`/reports/closings/${date}`)).data,
};
