// src/store/productStore.ts
import { create } from 'zustand';
import { ProductRepository } from '../database/repositories/productRepository';
import { SyncQueueRepository } from '../database/repositories/syncQueueRepository';
import apiClient from '../api/client';

// Define Product type if not already in types
export interface Product {
  id: number;
  name: string;
  description?: string;
  price: number;
  stock: number;
  barcode?: string;
  imageUrl?: string;
  syncStatus?: 'synced' | 'pending' | 'failed';
  createdAt?: number;
  updatedAt?: number;
}

interface ProductState {
  products: Product[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchProducts: () => Promise<void>;
  searchProducts: (query: string) => Promise<void>;
  addProduct: (product: Omit<Product, 'id'>) => Promise<void>;
  updateProduct: (id: number, product: Partial<Product>) => Promise<void>;
  deleteProduct: (id: number) => Promise<void>;
  syncProducts: () => Promise<void>;
  getProductById: (id: number) => Product | undefined;
}

export const useProductStore = create<ProductState>((set, get) => ({
  products: [],
  isLoading: false,
  error: null,

  fetchProducts: async () => {
    set({ isLoading: true, error: null });
    try {
      const products = await ProductRepository.getAll();
      set({ products, isLoading: false });
    } catch (error) {
      console.error('Fetch products error:', error);
      set({ error: 'Failed to fetch products', isLoading: false });
    }
  },

  searchProducts: async (query: string) => {
    if (!query.trim()) {
      await get().fetchProducts();
      return;
    }
    
    set({ isLoading: true, error: null });
    try {
      const products = await ProductRepository.search(query);
      set({ products, isLoading: false });
    } catch (error) {
      console.error('Search products error:', error);
      set({ error: 'Failed to search products', isLoading: false });
    }
  },

  addProduct: async (product: Omit<Product, 'id'>) => {
    set({ isLoading: true, error: null });
    try {
      // Save locally first
      const id = await ProductRepository.save(product);
      
      // Add to sync queue for server
      await SyncQueueRepository.add('PRODUCT', { ...product, id });
      
      // Refresh list
      await get().fetchProducts();
    } catch (error) {
      console.error('Add product error:', error);
      set({ error: 'Failed to add product', isLoading: false });
    }
  },

  updateProduct: async (id: number, product: Partial<Product>) => {
    set({ isLoading: true, error: null });
    try {
      await ProductRepository.save({ id, ...product });
      await SyncQueueRepository.add('PRODUCT_UPDATE', { id, ...product });
      await get().fetchProducts();
    } catch (error) {
      console.error('Update product error:', error);
      set({ error: 'Failed to update product', isLoading: false });
    }
  },

  deleteProduct: async (id: number) => {
    set({ isLoading: true, error: null });
    try {
      const db = (await import('../database/sqlite')).getDb();
      await db.runAsync('DELETE FROM products WHERE id = ?', [id]);
      await get().fetchProducts();
    } catch (error) {
      console.error('Delete product error:', error);
      set({ error: 'Failed to delete product', isLoading: false });
    }
  },

  syncProducts: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.get('/products');
      const serverProducts = response.data;
      
      for (const product of serverProducts) {
        await ProductRepository.save({
          id: product.id,
          name: product.name,
          description: product.description,
          price: product.price,
          stock: product.stock,
          barcode: product.barcode,
          syncStatus: 'synced',
        });
      }
      
      await get().fetchProducts();
    } catch (error) {
      console.error('Sync products error:', error);
      set({ error: 'Failed to sync products', isLoading: false });
    }
  },

  getProductById: (id: number) => {
    const { products } = get();
    return products.find(product => product.id === id);
  },
}));