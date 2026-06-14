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
  clientReference?: string;
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

export interface OrderResponse {
  id: number;
  orderNumber: string;
  totalAmount: number;
  totalProfit: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  items?: OrderItemResponse[];
}

export interface OrderItemResponse {
  id: number;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  totalPrice: number;
  profit: number;
}

export const orderApi = {
  // Create new order
  createOrder: async (order: OrderRequest): Promise<OrderResponse> => {
    console.log('📤 Creating order:', order);
    const response = await apiClient.post('/orders', order);
    console.log('✅ Order created:', response.data);
    return response.data;
  },
  
  // Get all orders
  getAll: async (): Promise<OrderResponse[]> => {
    const response = await apiClient.get('/orders');
    return response.data;
  },
  
  // Get today's orders
  getTodayOrders: async (): Promise<OrderResponse[]> => {
    const response = await apiClient.get('/orders/today');
    return response.data;
  },
  
  // Get order by ID
  getById: async (id: number): Promise<OrderResponse> => {
    const response = await apiClient.get(`/orders/${id}`);
    return response.data;
  },
  
  // Get order by number
  getByNumber: async (orderNumber: string): Promise<OrderResponse> => {
    const response = await apiClient.get(`/orders/number/${orderNumber}`);
    return response.data;
  },
};

export default orderApi;
