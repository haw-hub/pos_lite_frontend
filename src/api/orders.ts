// src/api/orderApi.ts
import apiClient from './client';

export interface OrderItemRequest {
  productId: number;
  quantity: number;
  unitPrice?: number;
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
    | 'TRANSFER'
    | 'CREDIT';

  customer?: CustomerRequest;
  customerName?: string;
  customerPhone?: string;
  dueDate?: string;
  creditNote?: string;
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
  product?: {
    id: number;
    name: string;
  };
  quantity: number;
  unitPrice: number;
  unitCost: number;
  totalPrice: number;
  profit: number;
}

export interface RefundRequest {
  orderItemId: number;
  quantity: number;
  reason?: string;
}

export interface RefundResponse {
  id: number;
  quantity: number;
  amount: number;
  profitAdjustment: number;
  reason?: string;
  createdAt: string;
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

  refund: async (orderId: number, request: RefundRequest): Promise<RefundResponse> => {
    const response = await apiClient.post(`/orders/${orderId}/refunds`, request);
    return response.data;
  },

  getRefunds: async (orderId: number): Promise<RefundResponse[]> => {
    const response = await apiClient.get(`/orders/${orderId}/refunds`);
    return response.data;
  },
};

export default orderApi;
