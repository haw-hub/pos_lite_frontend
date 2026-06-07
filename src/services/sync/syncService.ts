// src/services/sync/syncService.ts
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isDatabaseReady, getDb } from '../../database/sqlite';
import { SyncQueueRepository } from '../../database/repositories/syncQueueRepository';
import apiClient from '../../api/client';
import { ProductRepository } from '../../database/repositories/productRepository';

type IntervalId = ReturnType<typeof setInterval>;

export class SyncService {
  private isSyncing = false;
  private syncInterval: IntervalId | null = null;

  async init() {
    console.log('🔄 Initializing Sync Service...');
    
    let retries = 0;
    while (!isDatabaseReady() && retries < 10) {
      console.log('⏳ Waiting for database...');
      await new Promise(resolve => setTimeout(resolve, 500));
      retries++;
    }
    
    const unsubscribe = NetInfo.addEventListener((state) => {
      console.log(`📡 Network status changed - isConnected: ${state.isConnected}`);
      if (state.isConnected && !this.isSyncing) {
        console.log('📡 Network online, attempting sync...');
        this.syncAll();
      }
    });

    this.syncInterval = setInterval(() => {
      console.log('⏰ Periodic sync triggered');
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

    if (!isDatabaseReady()) {
      console.log('⏳ Database not ready, skipping sync');
      return;
    }

    const netInfo = await NetInfo.fetch();
    console.log(`📡 Network check - isConnected: ${netInfo.isConnected}, type: ${netInfo.type}`);
    
    if (!netInfo.isConnected) {
      console.log('📴 No internet connection, skipping sync');
      return;
    }

    const token = await AsyncStorage.getItem('auth_token');
    console.log(`🔐 Auth token present: ${!!token}`);
    
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
      console.log('📥 ========== STARTING PRODUCT SYNC ==========');
      
      // Get local products BEFORE sync
      const localProductsBefore = await ProductRepository.getAll();
      console.log(`📊 BEFORE SYNC: ${localProductsBefore.length} products in local DB`);
      if (localProductsBefore.length > 0) {
        console.log(`📊 Sample local products (first 3):`);
        localProductsBefore.slice(0, 3).forEach(p => {
          console.log(`   - ID:${p.id}, Name:${p.name}, Price:${p.price}, Stock:${p.stock}, Deleted:${p.deleted}`);
        });
      }
      
      // Fetch from server
      console.log('🌐 Fetching active products from server...');
      const response = await apiClient.get('/products');
      const serverProducts = response.data;
      
      console.log('🌐 Fetching deleted products from server...');
      const deletedResponse = await apiClient.get('/products/deleted');
      const deletedProducts = deletedResponse.data;
      
      console.log(`📦 Server has: ${serverProducts?.length || 0} active products, ${deletedProducts?.length || 0} deleted products`);
      
      if (!Array.isArray(serverProducts)) {
        console.warn('⚠️ Invalid products response from server');
        return;
      }
      
      // Create a map of all server products (active + deleted)
      const allServerProducts = [...serverProducts, ...deletedProducts];
      console.log(`📦 Total server products: ${allServerProducts.length}`);
      
      let updatedCount = 0;
      let insertedCount = 0;
      let unchangedCount = 0;
      
      for (const serverProduct of allServerProducts) {
        // Check if product exists in local DB
        const existingLocal = await ProductRepository.getById(serverProduct.id);
        
        if (existingLocal) {
          // Check if update is needed
          const needsUpdate = 
            existingLocal.name !== (serverProduct.name || '') ||
            existingLocal.price !== serverProduct.price ||
            existingLocal.stock !== serverProduct.stock ||
            existingLocal.barcode !== (serverProduct.barcode || '') ||
            existingLocal.description !== (serverProduct.description || '') ||
            (existingLocal.deleted ? 1 : 0) !== (serverProduct.deleted ? 1 : 0);
          
          if (needsUpdate) {
            console.log(`🔄 UPDATING product ID ${serverProduct.id}:`);
            console.log(`   Old: Name="${existingLocal.name}", Price=${existingLocal.price}, Stock=${existingLocal.stock}, Deleted=${existingLocal.deleted}`);
            console.log(`   New: Name="${serverProduct.name}", Price=${serverProduct.price}, Stock=${serverProduct.stock}, Deleted=${serverProduct.deleted}`);
            
            await ProductRepository.save({
              id: serverProduct.id,
              name: serverProduct.name,
              description: serverProduct.description || '',
              price: serverProduct.price,
              stock: serverProduct.stock,
              barcode: serverProduct.barcode || '',
              deleted: serverProduct.deleted || false,
              syncStatus: 'synced',
            });
            updatedCount++;
          } else {
            // Still update sync_status to ensure it's synced
            if (existingLocal.syncStatus !== 'synced') {
              await ProductRepository.save({
                id: serverProduct.id,
                name: serverProduct.name,
                description: serverProduct.description || '',
                price: serverProduct.price,
                stock: serverProduct.stock,
                barcode: serverProduct.barcode || '',
                deleted: serverProduct.deleted || false,
                syncStatus: 'synced',
              });
              console.log(`✅ SYNC STATUS UPDATED for product ID ${serverProduct.id}`);
            } else {
              console.log(`⏭️ Product ID ${serverProduct.id} already up to date`);
            }
            unchangedCount++;
          }
        } else {
          // New product - insert
          console.log(`➕ INSERTING new product ID ${serverProduct.id}: "${serverProduct.name}"`);
          await ProductRepository.save({
            id: serverProduct.id,
            name: serverProduct.name,
            description: serverProduct.description || '',
            price: serverProduct.price,
            stock: serverProduct.stock,
            barcode: serverProduct.barcode || '',
            deleted: serverProduct.deleted || false,
            syncStatus: 'synced',
          });
          insertedCount++;
        }
      }
      
      // Get local products AFTER sync
      const localProductsAfter = await ProductRepository.getAll();
      console.log(`📊 AFTER SYNC: ${localProductsAfter.length} products in local DB`);
      
      // Verify critical products
      console.log('\n🔍 VERIFICATION: Checking critical products:');
      for (const serverProduct of allServerProducts.slice(0, 5)) {
        const localCheck = await ProductRepository.getById(serverProduct.id);
        if (localCheck) {
          console.log(`   ✅ ID ${serverProduct.id}: Local="${localCheck.name}" | Server="${serverProduct.name}" - MATCH`);
        } else {
          console.log(`   ❌ ID ${serverProduct.id}: NOT FOUND in local DB!`);
        }
      }
      
      console.log(`\n📊 SYNC SUMMARY: ${insertedCount} inserted, ${updatedCount} updated, ${unchangedCount} unchanged`);
      console.log('📥 ========== PRODUCT SYNC COMPLETE ==========\n');
      
    } catch (error: any) {
      console.error('⚠️ Product sync error:', error.message);
      if (error.response) {
        console.error('   Response status:', error.response.status);
        console.error('   Response data:', error.response.data);
      }
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