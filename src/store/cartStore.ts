// src/store/cartStore.ts
import { create } from 'zustand';
import { Product } from '../types';

export interface CartItem {
  product: Product;
  quantity: number;
  totalPrice: number;
}

interface CartState {
  items: CartItem[];
  total: number;
  itemCount: number;
  addToCart: (product: Product, quantity?: number) => boolean;
  removeFromCart: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => boolean;
  clearCart: () => void;
  calculateTotal: () => void;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  total: 0,
  itemCount: 0,

  addToCart: (product: Product, quantity = 1) => {
    const { items } = get();
    const existingIndex = items.findIndex(item => item.product.id === product.id);
    const currentQuantity = existingIndex >= 0 ? items[existingIndex].quantity : 0;
    const expired = product.expiryDate
      ? new Date(`${product.expiryDate}T23:59:59`).getTime() < Date.now()
      : false;
    if (expired || quantity <= 0 || currentQuantity + quantity > product.stock) {
      return false;
    }
    
    if (existingIndex >= 0) {
      const newItems = [...items];
      const newQuantity = newItems[existingIndex].quantity + quantity;
      newItems[existingIndex].quantity = newQuantity;
      newItems[existingIndex].totalPrice = newQuantity * product.price;
      set({ items: newItems });
    } else {
      set({
        items: [...items, {
          product,
          quantity,
          totalPrice: quantity * product.price
        }]
      });
    }
    
    get().calculateTotal();
    return true;
  },

  removeFromCart: (productId: number) => {
    const { items } = get();
    set({ items: items.filter(item => item.product.id !== productId) });
    get().calculateTotal();
  },

  updateQuantity: (productId: number, quantity: number) => {
    if (quantity <= 0) {
      get().removeFromCart(productId);
      return true;
    }
    
    const { items } = get();
    const existing = items.find(item => item.product.id === productId);
    const expired = existing?.product.expiryDate
      ? new Date(`${existing.product.expiryDate}T23:59:59`).getTime() < Date.now()
      : false;
    if (!existing || expired || quantity > existing.product.stock) {
      return false;
    }
    const newItems = items.map(item => {
      if (item.product.id === productId) {
        return {
          ...item,
          quantity,
          totalPrice: quantity * item.product.price,
        };
      }
      return item;
    });
    
    set({ items: newItems });
    get().calculateTotal();
    return true;
  },

  clearCart: () => {
    set({ items: [], total: 0, itemCount: 0 });
  },

  calculateTotal: () => {
    const { items } = get();
    const total = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    set({ total, itemCount });
  },
}));
