// src/types/index.ts

// Product type
export interface Product {
  id: number;
  name: string;
  description?: string;
  price: number;
  stock: number;
  barcode?: string;
  deleted?: boolean;
  imageUrl?: string;
  syncStatus?: 'synced' | 'pending' | 'failed';
  createdAt?: number;
  updatedAt?: number;
  
}

// Order types
export interface Order {
  id: number;
  orderNumber: string;
  cashierId?: number;
  subtotal: number;
  tax: number;
  totalAmount: number;
  paymentMethod: 'CASH' | 'CARD' | 'QR' | 'TRANSFER';
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'SYNCED';
  items: OrderItem[];
  createdAt: string;
  updatedAt?: string;
}

export interface OrderItem {
  id: number;
  productId: number;
  product?: Product;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface OrderRequest {
  items: OrderItemRequest[];
  paymentMethod: 'CASH' | 'CARD' | 'QR' | 'TRANSFER';
}

export interface OrderItemRequest {
  productId: number;
  quantity: number;
}

// User types
export interface User {
  id: number;
  username: string;
  fullName: string;
  role: 'ADMIN' | 'CASHIER' | 'MANAGER';
  active: boolean;
  createdAt?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  username: string;
  role: string;
  fullName: string;
}

// Cart types (for frontend use)
export interface CartItem {
  product: Product;
  quantity: number;
  totalPrice: number;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// Sync types
export interface SyncQueueItem {
  id?: number;
  type: 'ORDER' | 'PRODUCT' | 'PRODUCT_UPDATE';
  data: string;
  status: 'pending' | 'completed' | 'failed';
  created_at: number;
  retry_count: number;
}

// Report types
export interface SalesReport {
  date: string;
  orderCount: number;
  totalAmount: number;
  averageAmount: number;
}

export interface DailySales {
  date: string;
  total: number;
  orders: number;
}

// Screen params types for navigation
export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  Dashboard: undefined;
  POS: undefined;
  Cart: undefined;
  Checkout: undefined;
  Inventory: undefined;
  ProductList: undefined;
  AddProduct: undefined;
  SalesHistory: undefined;
  Reports: undefined;
  Settings: undefined;
};