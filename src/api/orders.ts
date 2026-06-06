// src/api/orderApi.ts
import apiClient from './client';

export interface OrderItemRequest {
  productId: number;
  quantity: number;
}

export interface CustomerRequest {
  name: string;
  phone: string;
}

export interface OrderRequest {
  items: OrderItemRequest[];

  paymentMethod:
    | 'CASH'
    | 'CARD'
    | 'QR'
    | 'TRANSFER'
    | 'CREDIT';

  customer?: CustomerRequest;
  customerName?: string;
  customerPhone?: string;
}

export const orderApi = {
  // Create new order
  createOrder: async (order: OrderRequest) => {
    const response = await apiClient.post('/orders', order);
    return response.data;
  },
  
  // Get all orders
  getAll: async () => {
    const response = await apiClient.get('/orders');
    return response.data;
  },
  
  // Get today's orders
  getTodayOrders: async () => {
    const response = await apiClient.get('/orders/today');
    return response.data;
  },
  
  // Get order by ID
  getById: async (id: number) => {
    const response = await apiClient.get(`/orders/${id}`);
    return response.data;
  },
  
  // Get order by number
  getByNumber: async (orderNumber: string) => {
    const response = await apiClient.get(`/orders/number/${orderNumber}`);
    return response.data;
  },
};