// src/store/cartStore.ts
import { create } from 'zustand';
import { Product } from '../types';

export interface CartItem {
  product: Product;
  quantity: number;
  totalPrice: number;
  unitPrice: number;
  unitLabel: string;
  unitMultiplier: number;
  priceType: 'RETAIL' | 'WHOLESALE' | 'VIP' | 'PACK';
}

export type CartPriceOption = {
  unitPrice: number;
  unitLabel?: string;
  unitMultiplier?: number;
  priceType?: CartItem['priceType'];
};

interface CartState {
  items: CartItem[];
  total: number;
  itemCount: number;
  addToCart: (product: Product, quantity?: number, option?: CartPriceOption) => boolean;
  removeFromCart: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => boolean;
  clearCart: () => void;
  calculateTotal: () => void;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  total: 0,
  itemCount: 0,

  addToCart: (product: Product, quantity = 1, option?: CartPriceOption) => {
    const { items } = get();
    const unitMultiplier = Math.max(1, option?.unitMultiplier || 1);
    const unitPrice = option?.unitPrice || product.price;
    const unitLabel = option?.unitLabel || product.unitName || 'ခု';
    const priceType = option?.priceType || 'RETAIL';
    const existingIndex = items.findIndex(item => item.product.id === product.id);
    if (
      existingIndex >= 0 &&
      (
        items[existingIndex].unitMultiplier !== unitMultiplier ||
        items[existingIndex].unitPrice !== unitPrice ||
        items[existingIndex].priceType !== priceType
      )
    ) {
      return false;
    }
    const currentBaseQuantity = items
      .filter(item => item.product.id === product.id)
      .reduce((sum, item) => sum + item.quantity * item.unitMultiplier, 0);
    const expired = product.expiryDate
      ? new Date(`${product.expiryDate}T23:59:59`).getTime() < Date.now()
      : false;
    if (expired || quantity <= 0 || currentBaseQuantity + quantity * unitMultiplier > product.stock) {
      return false;
    }
    
    if (existingIndex >= 0) {
      const newItems = [...items];
      const newQuantity = newItems[existingIndex].quantity + quantity;
      newItems[existingIndex].quantity = newQuantity;
      newItems[existingIndex].totalPrice = newQuantity * unitPrice;
      set({ items: newItems });
    } else {
      set({
        items: [...items, {
          product,
          quantity,
          totalPrice: quantity * unitPrice,
          unitPrice,
          unitLabel,
          unitMultiplier,
          priceType,
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
    const otherBaseQuantity = items
      .filter(item => item.product.id === productId && item !== existing)
      .reduce((sum, item) => sum + item.quantity * item.unitMultiplier, 0);
    if (!existing || expired || otherBaseQuantity + quantity * existing.unitMultiplier > existing.product.stock) {
      return false;
    }
    const newItems = items.map(item => {
      if (item.product.id === productId) {
        return {
          ...item,
          quantity,
          totalPrice: quantity * item.unitPrice,
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
