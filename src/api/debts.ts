// src/api/debts.ts ✅ FIXED
import apiClient from './client';

export const debtApi = {
  getAll: async () => {
    const response = await apiClient.get('/debts');
    return response.data;
  },

  getSummary: async () => {
    const response = await apiClient.get('/debts/summary');
    return response.data;
  },

  getByCustomer: async (customerId: number) => {
    const response = await apiClient.get(
      `/debts/customer/${customerId}`
    );

    return response.data;
  },

  markPaid: async (debtId: number) => {
    const response = await apiClient.put(
      `/debts/${debtId}/paid`
    );

    return response.data;
  },

  makePayment: async (
    debtId: number,
    amount: number,
    paymentMethod: string
  ) => {
    const response = await apiClient.post(
      `/debts/${debtId}/payments`,
      {
        amount,
        paymentMethod,
      }
    );

    return response.data;
  },
};