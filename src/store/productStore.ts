// src/store/productStore.ts
import { create } from 'zustand';
import { ProductRepository } from '../database/repositories/productRepository';
import { SyncQueueRepository } from '../database/repositories/syncQueueRepository';
import apiClient from '../api/client';
import { syncService } from '../services/sync/syncService';
import { inventoryAlertService } from '../services/alerts/inventoryAlertService';

export interface Product {
  id: number;
  name: string;
  description?: string;
  price: number;
  costPrice: number;
  stock: number;
  barcode?: string;
  deleted?: boolean;
  imageUrl?: string;
  syncStatus?: 'synced' | 'pending' | 'failed';
  createdAt?: number;
  updatedAt?: number;
  expiryDate?: string;
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
  deletedProducts: Product[];

  fetchDeletedProducts: () => Promise<void>;

  restoreProduct: (id: number) => Promise<void>;
}

export const useProductStore = create<ProductState>((set, get) => ({
  products: [],
  deletedProducts: [],
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

fetchDeletedProducts: async () => {
  try {

    // Get deleted products from backend
    const response =
      await apiClient.get('/products/deleted');

    const serverDeletedProducts =
      response.data;

    // Save/update in SQLite
    for (const product of serverDeletedProducts) {
      await ProductRepository.save({
        id: product.id,
        name: product.name,
        description: product.description || '',
        price: product.price,
        costPrice: product.costPrice || 0,
        stock: product.stock,
        barcode: product.barcode || '',
        expiryDate: product.expiryDate || undefined,
        deleted: true,
        syncStatus: 'synced',
      });
    }

    const deletedProducts =
      await ProductRepository.getDeletedProducts();

    set({ deletedProducts });

  } catch (error) {

    console.error(
      '❌ Fetch deleted products error:',
      error
    );
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
      const localId = -Date.now();
      const clientReference = `product-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
      const request = {
        name: product.name,
        description: product.description || '',
        price: product.price,
        costPrice: product.costPrice || 0,
        stock: product.stock,
        barcode: product.barcode || null,
        expiryDate: product.expiryDate || undefined,
        clientReference,
      };
      await ProductRepository.save({
        id: localId,
        ...request,
        barcode: request.barcode || '',
        syncStatus: 'pending',
        clientReference,
      });
      await SyncQueueRepository.add('PRODUCT', { localId, request });
      await get().fetchProducts();
      inventoryAlertService.checkAndNotify().catch(() => undefined);
      syncService.forceSync().catch(() => undefined);
      
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
      const existing = await ProductRepository.getById(id);
      if (!existing) throw new Error('Product not found');
      const updated = {
        ...existing,
        ...product,
        id,
        clientReference:
          existing.clientReference ??
          `product-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
        syncStatus: 'pending' as const,
      };
      await ProductRepository.save(updated);
      const request = {
        name: updated.name,
        description: updated.description || '',
        price: updated.price,
        costPrice: updated.costPrice,
        stock: updated.stock,
        barcode: updated.barcode || null,
        expiryDate: updated.expiryDate || null,
        clientReference: updated.clientReference,
      };
      await SyncQueueRepository.add('PRODUCT_UPDATE', { id, request });
      await get().fetchProducts();
      inventoryAlertService.checkAndNotify().catch(() => undefined);
      syncService.forceSync().catch(() => undefined);
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
      await ProductRepository.softDelete(id);
      await SyncQueueRepository.add('PRODUCT_DELETE', { id });
      await get().fetchProducts();
      set({ deletedProducts: await ProductRepository.getDeletedProducts() });
      syncService.forceSync().catch(() => undefined);

    } catch (error: any) {
      console.error('❌ Delete product error:', error.message);

      set({
        error: 'Failed to delete product',
        isLoading: false,
      });
    } finally {
      set({ isLoading: false });
    }
  },
  restoreProduct: async (id: number) => {
    set({ isLoading: true, error: null });
    try {
      await ProductRepository.restoreProduct(id);
      await SyncQueueRepository.add('PRODUCT_RESTORE', { id });
      syncService.forceSync().catch(() => undefined);
      await get().fetchProducts();
      set({ deletedProducts: await ProductRepository.getDeletedProducts() });
    } catch (error: any) {
      console.error('❌ Restore product error:', error);
      set({ error: 'Failed to restore product', isLoading: false });
      // On error, refresh to correct state
      await get().fetchProducts();
      await get().fetchDeletedProducts();
    }
  },

 syncProducts: async () => {
  try {
    console.log('🔄 Syncing products from server...');

    // ACTIVE PRODUCTS
    const response = await apiClient.get('/products');
    const serverProducts = response.data;

    console.log(
      `📦 Server has ${serverProducts.length} active products`
    );

    for (const product of serverProducts) {
      await ProductRepository.save({
        id: product.id,
        name: product.name,
        description: product.description || '',
        price: product.price,
        costPrice: product.costPrice || 0,
        stock: product.stock,
        barcode: product.barcode || '',
        expiryDate: product.expiryDate || undefined,
        deleted: false,
        syncStatus: 'synced',
      });
    }

    // DELETED PRODUCTS
    const deletedResponse =
      await apiClient.get('/products/deleted');

    const deletedProducts =
      deletedResponse.data;

    console.log(
      `🗑️ Server has ${deletedProducts.length} deleted products`
    );

    for (const product of deletedProducts) {
      await ProductRepository.save({
        id: product.id,
        name: product.name,
        description: product.description || '',
        price: product.price,
        costPrice: product.costPrice || 0,
        stock: product.stock,
        barcode: product.barcode || '',
        expiryDate: product.expiryDate || undefined,
        deleted: true,
        syncStatus: 'synced',
      });
    }

    console.log(
      `✅ Synced ${
        serverProducts.length +
        deletedProducts.length
      } products to local DB`
    );

    // Refresh active products
    const updatedProducts =
      await ProductRepository.getAll();

    // Refresh deleted products
    const updatedDeletedProducts =
      await ProductRepository.getDeletedProducts();

    console.log(
      `📊 Local DB now has ${updatedProducts.length} active products`
    );

    console.log(
      `📊 Local DB now has ${updatedDeletedProducts.length} deleted products`
    );

    set({
      products: updatedProducts,
      deletedProducts: updatedDeletedProducts,
    });

  } catch (error: any) {
    console.error(
      '❌ Sync products error:',
      error.response?.data || error.message
    );
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
