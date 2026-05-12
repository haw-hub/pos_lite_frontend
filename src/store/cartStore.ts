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
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
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
  },

  removeFromCart: (productId: number) => {
    const { items } = get();
    set({ items: items.filter(item => item.product.id !== productId) });
    get().calculateTotal();
  },

  updateQuantity: (productId: number, quantity: number) => {
    if (quantity <= 0) {
      get().removeFromCart(productId);
      return;
    }
    
    const { items } = get();
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