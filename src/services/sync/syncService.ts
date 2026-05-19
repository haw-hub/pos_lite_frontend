// src/services/sync/syncService.ts
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isDatabaseReady } from '../../database/sqlite';
import { SyncQueueRepository } from '../../database/repositories/syncQueueRepository';
import apiClient from '../../api/client';
import { ProductRepository } from '../../database/repositories/productRepository';


type IntervalId = ReturnType<typeof setInterval>;

export class SyncService {
  private isSyncing = false;
  private syncInterval: IntervalId | null = null;

  async init() {
    console.log('🔄 Initializing Sync Service...');
    
    // Wait for database to be ready
    let retries = 0;
    while (!isDatabaseReady() && retries < 10) {
      console.log('Waiting for database...');
      await new Promise(resolve => setTimeout(resolve, 500));
      retries++;
    }
    
    // Listen for network changes
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && !this.isSyncing) {
        console.log('📡 Network online, attempting sync...');
        this.syncAll();
      }
    });

    // Periodic sync every 5 minutes
    this.syncInterval = setInterval(() => {
      if (!this.isSyncing) {
        this.syncAll();
      }
    }, 5 * 60 * 1000);
    
    console.log('✅ Sync Service initialized');
    return unsubscribe;
  }

  async syncAll() {
    if (this.isSyncing) {
      console.log('⚠️ Sync already in progress...');
      return;
    }

    // Check if database is ready
    if (!isDatabaseReady()) {
      console.log('⏳ Database not ready, skipping sync');
      return;
    }

    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      console.log('📴 No internet connection, skipping sync');
      return;
    }

    // Check if user is authenticated
    const token = await AsyncStorage.getItem('auth_token');
    if (!token) {
      console.log('🔒 No auth token, skipping sync');
      return;
    }

    this.isSyncing = true;
    console.log('🔄 Starting sync process...');
    
    try {
      await this.syncProductsFromServer();
      await this.syncPendingQueues();
      await SyncQueueRepository.cleanup();
      console.log('✅ Sync completed successfully');
    } catch (error) {
      console.error('❌ Sync failed:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  private async syncProductsFromServer() {
    try {
      console.log('📥 Syncing products from server...');
      const response = await apiClient.get('/products');
      const serverProducts = response.data;
      
      if (!Array.isArray(serverProducts)) {
        console.warn('Invalid products response');
        return;
      }
      
      console.log(`📦 Received ${serverProducts.length} products from server`);
      
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
      
      console.log(`✅ Synced ${serverProducts.length} products`);
    } catch (error: any) {
      console.error('⚠️ Product sync error:', error.message);
    }
  }

  private async syncPendingQueues() {
    const pendingItems = await SyncQueueRepository.getPending();
    
    if (pendingItems.length === 0) {
      return;
    }
    
    console.log(`📤 Found ${pendingItems.length} pending items to sync`);
    
    for (const item of pendingItems) {
      try {
        const data = JSON.parse(item.data);
        console.log(`🔄 Syncing ${item.type} item ID: ${item.id}`);
        
        switch (item.type) {
          case 'ORDER':
            await apiClient.post('/orders', data);
            break;
          case 'PRODUCT':
            await apiClient.post('/products', data);
            break;
          case 'PRODUCT_UPDATE':
            await apiClient.put(`/products/${data.id}`, data);
            break;
        }
        
        await SyncQueueRepository.markCompleted(item.id!);
        console.log(`✅ Synced item ${item.id}`);
        
      } catch (error: any) {
        console.error(`❌ Failed to sync item ${item.id}:`, error.message);
        
        if (error.response?.status === 401 || error.response?.status === 403) {
          console.log('🔒 Authentication failed, stopping sync');
          break;
        } else {
          await SyncQueueRepository.markFailed(item.id!);
        }
      }
    }
  }
  
  async forceSync() {
    console.log('💪 Force sync triggered');
    await this.syncAll();
  }
  
  destroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
}

export const syncService = new SyncService();