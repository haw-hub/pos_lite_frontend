import apiClient from './client';

export interface PaymentProofInput {
  months: number;
  amount: string;
  paymentMethod: string;
  notes: string;
  screenshot: {
    uri: string;
    name: string;
    type: string;
  };
}

export const subscriptionPaymentsApi = {
  submitProof: async (input: PaymentProofInput) => {
    const formData = new FormData();
    formData.append('months', String(input.months));
    formData.append('amount', input.amount || '0');
    formData.append('paymentMethod', input.paymentMethod);
    formData.append('notes', input.notes);
    formData.append('screenshot', input.screenshot as any);

    const response = await apiClient.post('/subscription/payment-proof', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};

export default subscriptionPaymentsApi;
