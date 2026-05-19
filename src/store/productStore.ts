// src/store/productStore.ts
import { create } from 'zustand';
import { ProductRepository } from '../database/repositories/productRepository';
import { SyncQueueRepository } from '../database/repositories/syncQueueRepository';
import apiClient from '../api/client';

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
  isInitialized: boolean;
  
  fetchProducts: () => Promise<void>;
  searchProducts: (query: string) => Promise<void>;
  addProduct: (product: Omit<Product, 'id'>) => Promise<void>;
  updateProduct: (id: number, product: Partial<Product>) => Promise<void>;
  deleteProduct: (id: number) => Promise<void>;
  syncProducts: () => Promise<void>;
  getProductById: (id: number) => Product | undefined;
  loadProductsOnLogin: () => Promise<void>;
}

export const useProductStore = create<ProductState>((set, get) => ({
  products: [],
  isLoading: false,
  error: null,
  isInitialized: false,

  fetchProducts: async () => {

  console.log('🔄 fetchProducts called');

  set({
    isLoading: true,
    error: null,
  });

  try {

    // LOAD FROM SQLITE
    let products = await ProductRepository.getAll();

    console.log(`✅ fetchProducts got ${products.length} products from local DB`);

    // IF SQLITE EMPTY -> SYNC FROM SERVER
    if (products.length === 0) {

      console.log('⚠️ No local products, syncing from server...');

      await get().syncProducts();

      // RELOAD AFTER SYNC
      products = await ProductRepository.getAll();

      console.log(`✅ Reloaded ${products.length} products after sync`);
    }

    set({
      products,
      isLoading: false,
      isInitialized: true,
    });

  } catch (error) {

    console.error('❌ Fetch products error:', error);

    set({
      error: 'Failed to fetch products',
      isLoading: false,
    });
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
      console.log(`✅ searchProducts found ${products.length} products`);
      set({ products, isLoading: false });
    } catch (error) {
      console.error('Search products error:', error);
      set({ error: 'Failed to search products', isLoading: false });
    }
  },

  addProduct: async (product: Omit<Product, 'id'>) => {
    set({ isLoading: true, error: null });
    try {
      console.log('📦 Adding product to backend:', product);
      
      const response = await apiClient.post('/products', {
        name: product.name,
        description: product.description || '',
        price: product.price,
        stock: product.stock,
        barcode: product.barcode || null
      });
      
      const serverProduct = response.data;
      console.log('✅ Product saved to server with ID:', serverProduct.id);
      
      await ProductRepository.save({
        id: serverProduct.id,
        name: serverProduct.name,
        description: serverProduct.description,
        price: serverProduct.price,
        stock: serverProduct.stock,
        barcode: serverProduct.barcode,
        syncStatus: 'synced'
      });
      
      // Refresh the product list
      await get().fetchProducts();
      console.log('✅ Product added and list refreshed');
      
    } catch (error: any) {
      console.error('❌ Add product error:', error.response?.data || error.message);
      set({ error: 'Failed to add product', isLoading: false });
    } finally {
      set({ isLoading: false });
    }
  },

  updateProduct: async (id: number, product: Partial<Product>) => {
    set({ isLoading: true, error: null });
    try {
      console.log('📦 Updating product:', id, product);
      await apiClient.put(`/products/${id}`, product);
      await ProductRepository.save({ id, ...product, syncStatus: 'synced' });
      await get().fetchProducts();
    } catch (error: any) {
      console.error('❌ Update product error:', error.message);
      set({ error: 'Failed to update product', isLoading: false });
    } finally {
      set({ isLoading: false });
    }
  },

  deleteProduct: async (id: number) => {
    set({ isLoading: true, error: null });
    try {
      console.log('📦 Deleting product:', id);
      await apiClient.delete(`/products/${id}`);
      const db = (await import('../database/sqlite')).getDb();
      await db.runAsync('DELETE FROM products WHERE id = ?', [id]);
      await get().fetchProducts();
    } catch (error: any) {
      console.error('❌ Delete product error:', error.message);
      set({ error: 'Failed to delete product', isLoading: false });
    } finally {
      set({ isLoading: false });
    }
  },

  syncProducts: async () => {
    try {
      console.log('🔄 Syncing products from server...');
      const response = await apiClient.get('/products');
      const serverProducts = response.data;
      
      console.log(`📦 Server has ${serverProducts.length} products`);
      
      for (const product of serverProducts) {
        await ProductRepository.save({
          id: product.id,
          name: product.name,
          description: product.description || '',
          price: product.price,
          stock: product.stock,
          barcode: product.barcode || '',
          syncStatus: 'synced',
        });
      }
      
      console.log(`✅ Synced ${serverProducts.length} products to local DB`);
      
      // Refresh the product list after sync
      const updatedProducts = await ProductRepository.getAll();
      console.log(`📊 Local DB now has ${updatedProducts.length} products`);
      set({ products: updatedProducts });
      
    } catch (error: any) {
      console.error('❌ Sync products error:', error.message);
    }
  },

  getProductById: (id: number) => {
    const { products } = get();
    return products.find(product => product.id === id);
  },

  // NEW: Call this after login to ensure products load
  loadProductsOnLogin: async () => {
    console.log('🔄 loadProductsOnLogin called');
    await get().syncProducts();
    await get().fetchProducts();
  },
}));