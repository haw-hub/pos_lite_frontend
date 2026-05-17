// src/services/sync/syncService.ts
import NetInfo from '@react-native-community/netinfo';
import { getDb } from '../../database/sqlite';
import { SyncQueueRepository } from '../../database/repositories/syncQueueRepository';
import { ProductRepository } from '../../database/repositories/productRepository';
import apiClient from '../../api/client';

export class SyncService {
  private isSyncing = false;

  async init() {
    // Listen for network changes
    NetInfo.addEventListener((state: { isConnected: any; }) => {
      if (state.isConnected && !this.isSyncing) {
        this.syncAll();
      }
    });

    // Periodic sync every 5 minutes
    setInterval(() => {
      this.syncAll();
    }, 5 * 60 * 1000);
  }

  async syncAll() {
    if (this.isSyncing) {
      return;
    }

    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      console.log('No internet connection, skipping sync');
      return;
    }

    this.isSyncing = true;
    
    try {
      await this.syncProductsFromServer();
      await this.syncPendingQueues();
      await SyncQueueRepository.cleanup();
      
      console.log('Sync completed successfully');
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  private async syncProductsFromServer() {
    try {
      console.log('Syncing products from server...');
      const response = await apiClient.get('/products');
      const serverProducts = response.data;
      
      const db = getDb();
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
      
      console.log(`Synced ${serverProducts.length} products`);
    } catch (error) {
      console.error('Product sync error:', error);
    }
  }

  private async syncPendingQueues() {
    const pendingItems = await SyncQueueRepository.getPending();
    
    for (const item of pendingItems) {
      try {
        const data = JSON.parse(item.data);
        
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
        console.log(`Synced item ${item.id} of type ${item.type}`);
      } catch (error) {
        console.error(`Failed to sync item ${item.id}:`, error);
        await SyncQueueRepository.markFailed(item.id!);
      }
    }
  }
}

export const syncService = new SyncService();