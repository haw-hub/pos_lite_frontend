// src/services/sync/syncService.ts
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isDatabaseReady, getDb } from '../../database/sqlite';
import { SyncQueueRepository } from '../../database/repositories/syncQueueRepository';
import apiClient from '../../api/client';
import { ProductRepository } from '../../database/repositories/productRepository';
import { OrderRepository } from '../../database/repositories/orderRepository';
import { inventoryAlertService } from '../alerts/inventoryAlertService';

type IntervalId = ReturnType<typeof setInterval>;

export class SyncService {
  private isSyncing = false;
  private syncInterval: IntervalId | null = null;
  private unsubscribeNetwork: (() => void) | null = null;

  async init() {
    console.log('🔄 Initializing Sync Service...');
    this.destroy();
    
    let retries = 0;
    while (!isDatabaseReady() && retries < 10) {
      console.log('⏳ Waiting for database...');
      await new Promise(resolve => setTimeout(resolve, 500));
      retries++;
    }
    
    this.unsubscribeNetwork = NetInfo.addEventListener((state) => {
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
    return this.unsubscribeNetwork;
  }

  async syncAll() {
    if (this.isSyncing) {
      console.log('⚠️ Sync already in progress...');
      return;
    }

    this.isSyncing = true;
    try {
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

      console.log('🔄 Starting sync process...');
      await this.recoverPendingWrites();
      await this.syncPendingQueues();
      await this.syncProductsFromServer();
      await inventoryAlertService.checkAndNotify();
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
          if (existingLocal.syncStatus === 'pending') {
            console.log(`Skipping pending local product ID ${serverProduct.id}`);
            unchangedCount++;
            continue;
          }
          // Check if update is needed
          const needsUpdate = 
            existingLocal.name !== (serverProduct.name || '') ||
             existingLocal.price !== serverProduct.price ||
             existingLocal.costPrice !== (serverProduct.costPrice || 0) ||
            existingLocal.stock !== serverProduct.stock ||
            existingLocal.barcode !== (serverProduct.barcode || '') ||
            existingLocal.description !== (serverProduct.description || '') ||
            existingLocal.expiryDate !== (serverProduct.expiryDate || undefined) ||
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
              costPrice: serverProduct.costPrice || 0,
              stock: serverProduct.stock,
              barcode: serverProduct.barcode || '',
              expiryDate: serverProduct.expiryDate || undefined,
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
                costPrice: serverProduct.costPrice || 0,
                stock: serverProduct.stock,
                barcode: serverProduct.barcode || '',
                expiryDate: serverProduct.expiryDate || undefined,
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
            costPrice: serverProduct.costPrice || 0,
            stock: serverProduct.stock,
            barcode: serverProduct.barcode || '',
            expiryDate: serverProduct.expiryDate || undefined,
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
          case 'ORDER': {
            const source = data.request ?? data;
            if (!Array.isArray(source.items) || source.items.length === 0) {
              throw new Error('Order queue item has no items');
            }
            const response = await this.syncOrder(source, item.id!);
            if (typeof data.localOrderId === 'number') {
              await OrderRepository.markSynced(
                data.localOrderId,
                response.data.id,
                response.data.orderNumber
              );
            }
            break;
          }
          case 'PRODUCT': {
            const request = this.productRequest(data.request ?? data);
            const response = await apiClient.post('/products', request);
            if (typeof data.localId === 'number') {
              await ProductRepository.replaceLocalProduct(data.localId, response.data);
            }
            break;
          }
          case 'PRODUCT_UPDATE': {
            const serverId = await this.resolveProductId(data.id);
            const request = this.productRequest(data.request ?? data);
            try {
              await apiClient.put(`/products/${serverId}`, request);
              await ProductRepository.markSynced(serverId);
            } catch (error: any) {
              const isMissingProduct =
                error.response?.status === 404 ||
                (error.response?.status === 400 &&
                  String(error.response?.data?.message).includes('Product not found'));
              if (!isMissingProduct) throw error;
              const response = await apiClient.post('/products', request);
              await ProductRepository.replaceLocalProduct(data.id, response.data);
            }
            break;
          }
          case 'PRODUCT_DELETE': {
            const serverId = await this.resolveProductId(data.id);
            await apiClient.delete(`/products/${serverId}`);
            await ProductRepository.markSynced(serverId);
            break;
          }
          case 'PRODUCT_RESTORE': {
            const serverId = await this.resolveProductId(data.id);
            await apiClient.put(`/products/${serverId}/restore`);
            await ProductRepository.markSynced(serverId);
            break;
          }
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

  private async resolveProductId(localOrServerId: number): Promise<number> {
    const db = getDb();
    const mapping = await db.getFirstAsync<{ server_id: number }>(
      `SELECT server_id FROM sync_mappings
       WHERE entity_type = 'PRODUCT' AND local_id = ?`,
      [localOrServerId]
    );
    if (mapping) return mapping.server_id;
    if (localOrServerId >= 0) return localOrServerId;
    if (!mapping) {
      throw new Error(`Product ${localOrServerId} has not synced yet`);
    }
    return localOrServerId;
  }

  private productRequest(source: any) {
    return {
      name: source.name,
      description: source.description || '',
      price: Number(source.price || 0),
      costPrice: Number(source.costPrice ?? source.cost_price ?? 0),
      stock: Number(source.stock || 0),
      barcode: source.barcode || null,
      expiryDate: source.expiryDate ?? source.expiry_date ?? null,
      clientReference: source.clientReference ?? source.client_reference ?? null,
    };
  }

  private async syncOrder(source: any, queueId: number): Promise<any> {
    const makeRequest = async () => ({
      ...source,
      clientReference: source.clientReference ?? `legacy-order-queue-${queueId}`,
      customerName: source.customerName ?? source.customer?.name,
      customerPhone: source.customerPhone ?? source.customer?.phone,
      items: await Promise.all(
        source.items.map(async (orderItem: any) => ({
          ...orderItem,
          productId: await this.resolveProductId(orderItem.productId),
        }))
      ),
    });

    for (let attempt = 0; attempt <= source.items.length; attempt++) {
      const request = await makeRequest();
      try {
        return await apiClient.post('/orders', request);
      } catch (error: any) {
        const message = String(error.response?.data?.message ?? '');
        const match = message.match(/Product not found:\s*(-?\d+)/i);
        if (error.response?.status !== 400 || !match) throw error;
        await this.createMissingProduct(Number(match[1]));
      }
    }
    throw new Error('Unable to sync order products');
  }

  private async createMissingProduct(localProductId: number): Promise<void> {
    const db = getDb();
    const product = await ProductRepository.getById(localProductId);
    if (!product) {
      throw new Error(`Local product ${localProductId} is missing`);
    }

    const pendingQuantity = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(oi.quantity), 0) AS total
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE oi.product_id = ? AND o.sync_status = 'pending'`,
      [localProductId]
    );
    const clientReference =
      product.clientReference ?? `recovered-product-${localProductId}`;
    const response = await apiClient.post('/products', {
      name: product.name,
      description: product.description || '',
      price: product.price,
      costPrice: product.costPrice || 0,
      stock: product.stock + (pendingQuantity?.total || 0),
      barcode: product.barcode || null,
      expiryDate: product.expiryDate || null,
      clientReference,
    });
    await ProductRepository.replaceLocalProduct(localProductId, response.data);
    console.log(`Recovered missing product ${localProductId} as server product ${response.data.id}`);
  }

  private async recoverPendingWrites(): Promise<void> {
    const db = getDb();
    const queued = await SyncQueueRepository.getAllPending();
    const queuedProductIds = new Set<number>();
    const queuedOrderIds = new Set<number>();

    for (const item of queued) {
      try {
        const data = JSON.parse(item.data);
        if (typeof data.localOrderId === 'number') queuedOrderIds.add(data.localOrderId);
        if (typeof data.localId === 'number') queuedProductIds.add(data.localId);
        if (typeof data.id === 'number') queuedProductIds.add(data.id);
      } catch {
        // Invalid queue rows will be handled by the normal retry path.
      }
    }

    const pendingProducts = await db.getAllAsync<any>(
      `SELECT * FROM products WHERE sync_status = 'pending'`
    );
    for (const product of pendingProducts) {
      if (queuedProductIds.has(product.id)) continue;
      const clientReference =
        product.client_reference ??
        `product-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
      await db.runAsync(
        'UPDATE products SET client_reference = ? WHERE id = ?',
        [clientReference, product.id]
      );
      const request = {
        name: product.name,
        description: product.description || '',
         price: product.price,
         costPrice: product.cost_price || 0,
        stock: product.stock,
        barcode: product.barcode || null,
        expiryDate: product.expiry_date || null,
        clientReference,
      };
      await SyncQueueRepository.add(
        product.id < 0 ? 'PRODUCT' : 'PRODUCT_UPDATE',
        product.id < 0 ? { localId: product.id, request } : { id: product.id, request }
      );
    }

    const pendingOrders = await db.getAllAsync<any>(
      `SELECT * FROM orders WHERE sync_status = 'pending'`
    );
    for (const order of pendingOrders) {
      if (queuedOrderIds.has(order.id)) continue;
      const items = await db.getAllAsync<any>(
        'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
        [order.id]
      );
      if (items.length === 0) continue;
      const clientReference =
        order.client_reference ??
        `order-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
      await db.runAsync(
        'UPDATE orders SET client_reference = ?, order_number = ? WHERE id = ?',
        [clientReference, clientReference, order.id]
      );
      await SyncQueueRepository.add('ORDER', {
        localOrderId: order.id,
        request: {
          clientReference,
          items: items.map(item => ({
            productId: item.product_id,
            quantity: item.quantity,
          })),
          paymentMethod: order.payment_method,
          customerName: order.customer_name || undefined,
          customerPhone: order.customer_phone || undefined,
        },
      });
    }
  }
  
  async forceSync() {
    console.log('💪 Force sync triggered');
    await this.syncAll();
  }
  
  destroy() {
    if (this.unsubscribeNetwork) {
      this.unsubscribeNetwork();
      this.unsubscribeNetwork = null;
    }
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
}

export const syncService = new SyncService();
