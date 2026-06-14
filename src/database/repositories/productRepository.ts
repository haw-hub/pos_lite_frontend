// src/database/repositories/productRepository.ts

import { getDb, isDatabaseReady, queryFirst, queryAll } from '../sqlite';

// Define Product type matching your database schema
export interface DBProduct {
  id: number;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  barcode: string | null;
  deleted: number;
  sync_status: string;
  created_at: number;
  updated_at: number;
  client_reference: string | null;
  expiry_date: string | null;
}

// Define the Product type for your app
export interface Product {
  id: number;
  name: string;
  description?: string;
  price: number;
  stock: number;
  barcode?: string;
  deleted?: boolean;
  syncStatus?: 'synced' | 'pending' | 'failed';
  createdAt?: number;
  updatedAt?: number;
  clientReference?: string;
  expiryDate?: string;
}

export const ProductRepository = {

  // Get all active products (deleted = 0)
  getAll: async (): Promise<Product[]> => {
    if (!isDatabaseReady()) {
      console.log('⏳ Database not ready, waiting...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const db = getDb();
    const result = await db.getAllAsync<DBProduct>(
      'SELECT * FROM products WHERE deleted = 0 ORDER BY name ASC'
    );

    return result.map(dbProduct => ({
      id: dbProduct.id,
      name: dbProduct.name,
      description: dbProduct.description || '',
      price: dbProduct.price,
      stock: dbProduct.stock,
      barcode: dbProduct.barcode || '',
      deleted: dbProduct.deleted === 1,
      syncStatus: dbProduct.sync_status as 'synced' | 'pending' | 'failed',
      createdAt: dbProduct.created_at,
      updatedAt: dbProduct.updated_at,
      expiryDate: dbProduct.expiry_date || undefined,
      clientReference: dbProduct.client_reference || undefined,
    }));
  },

  // Get product by ID
  getById: async (id: number): Promise<Product | null> => {
    const db = getDb();
    const result = await db.getFirstAsync<DBProduct>(
      'SELECT * FROM products WHERE id = ?',
      [id]
    );

    if (!result) return null;

    return {
      id: result.id,
      name: result.name,
      description: result.description || '',
      price: result.price,
      stock: result.stock,
      barcode: result.barcode || '',
      deleted: result.deleted === 1,
      syncStatus: result.sync_status as 'synced' | 'pending' | 'failed',
      createdAt: result.created_at,
      updatedAt: result.updated_at,
      clientReference: result.client_reference || undefined,
      expiryDate: result.expiry_date || undefined,
    };
  },

  // Search products
  search: async (query: string): Promise<Product[]> => {
    const db = getDb();
    const result = await db.getAllAsync<DBProduct>(
      `SELECT * FROM products
       WHERE deleted = 0
        AND (
            name LIKE ?
            OR barcode LIKE ?
        )
        ORDER BY name ASC`,
      [`%${query}%`, `%${query}%`]
    );

    return result.map(dbProduct => ({
      id: dbProduct.id,
      name: dbProduct.name,
      description: dbProduct.description || '',
      price: dbProduct.price,
      stock: dbProduct.stock,
      barcode: dbProduct.barcode || '',
      deleted: dbProduct.deleted === 1,
      syncStatus: dbProduct.sync_status as 'synced' | 'pending' | 'failed',
      createdAt: dbProduct.created_at,
      updatedAt: dbProduct.updated_at,
    }));
  },

  // Save or update product
  save: async (product: Partial<Product>): Promise<number> => {
    const db = getDb();
    const now = Date.now();

    try {
      console.log(`💾 [SAVE] ID=${product.id}, Name="${product.name}", Price=${product.price}, Stock=${product.stock}, Deleted=${product.deleted}`);

      // Check if product exists by ID
      const existing = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM products WHERE id = ?',
        [product.id ?? null]
      );

      // Update existing product
      if (existing) {
        console.log(`🔄 [UPDATE] Existing product ID: ${product.id}`);
        
        await db.runAsync(
          `UPDATE products
           SET
             name = ?,
             description = ?,
             price = ?,
             stock = ?,
             barcode = ?,
             deleted = ?,
             sync_status = ?,
             client_reference = COALESCE(?, client_reference),
             expiry_date = ?,
             updated_at = ?
           WHERE id = ?`,
          [
            product.name ?? '',
            product.description ?? '',
            product.price ?? 0,
            product.stock ?? 0,
            product.barcode ?? '',
            product.deleted ? 1 : 0,
            product.syncStatus ?? 'synced',
            product.clientReference ?? null,
            product.expiryDate ?? null,
            now,
            product.id ?? null,
          ]
        );

        console.log(`✅ [UPDATE] Completed for ID ${product.id}`);
        return product.id!;
      }

      // Insert new product
      console.log(`➕ [INSERT] New product ID: ${product.id}, Name: ${product.name}`);
      
      const result = await db.runAsync(
        `INSERT INTO products (
          id, name, description, price, stock, barcode, deleted, sync_status, client_reference, expiry_date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          product.id ?? null,
          product.name ?? '',
          product.description ?? '',
          product.price ?? 0,
          product.stock ?? 0,
          product.barcode ?? '',
          product.deleted ? 1 : 0,
          product.syncStatus ?? 'synced',
          product.clientReference ?? null,
          product.expiryDate ?? null,
          now,
          now,
        ]
      );

      const newId = Number(product.id || result.lastInsertRowId);
      console.log(`✅ [INSERT] Completed with ID ${newId}`);
      return newId;

    } catch (error) {
      console.error('❌ [SAVE] Error:', error);
      throw error;
    }
  },

  replaceLocalProduct: async (localId: number, serverProduct: Product): Promise<void> => {
    const db = getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO sync_mappings (entity_type, local_id, server_id)
       VALUES ('PRODUCT', ?, ?)`,
      [localId, serverProduct.id]
    );
    await db.runAsync(
      'UPDATE order_items SET product_id = ? WHERE product_id = ?',
      [serverProduct.id, localId]
    );
    await db.runAsync('DELETE FROM products WHERE id = ?', [localId]);
    await ProductRepository.save({ ...serverProduct, syncStatus: 'synced' });
  },

  markSynced: async (id: number): Promise<void> => {
    const db = getDb();
    await db.runAsync(
      `UPDATE products SET sync_status = 'synced', updated_at = ? WHERE id = ?`,
      [Date.now(), id]
    );
  },

  // Save multiple products in batch
  saveMany: async (products: Partial<Product>[]): Promise<void> => {
    const db = getDb();
    const now = Date.now();

    await db.runAsync('BEGIN TRANSACTION');
    try {
      for (const product of products) {
        const existing = await db.getFirstAsync<{ id: number }>(
          'SELECT id FROM products WHERE id = ?',
          [product.id ?? null]
        );
        
        if (existing) {
          await db.runAsync(
            `UPDATE products SET
              name = ?, description = ?, price = ?, stock = ?,
              barcode = ?, deleted = ?, sync_status = ?, expiry_date = ?, updated_at = ?
             WHERE id = ?`,
            [
              product.name ?? '',
              product.description ?? '',
              product.price ?? 0,
              product.stock ?? 0,
              product.barcode ?? '',
              product.deleted ? 1 : 0,
              product.syncStatus ?? 'synced',
              product.expiryDate ?? null,
              now,
              product.id ?? null,
            ]
          );
        } else {
          await db.runAsync(
            `INSERT INTO products (id, name, description, price, stock, barcode, deleted, sync_status, expiry_date, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              product.id ?? null,
              product.name ?? '',
              product.description ?? '',
              product.price ?? 0,
              product.stock ?? 0,
              product.barcode ?? '',
              product.deleted ? 1 : 0,
              product.syncStatus ?? 'synced',
              product.expiryDate ?? null,
              now,
              now,
            ]
          );
        }
      }
      await db.runAsync('COMMIT');
      console.log(`✅ [SAVE_MANY] Saved ${products.length} products`);
    } catch (error) {
      await db.runAsync('ROLLBACK');
      console.error('❌ [SAVE_MANY] Error:', error);
      throw error;
    }
  },

  // Update stock (decrease by quantity)
  updateStock: async (productId: number, quantity: number): Promise<void> => {
    const db = getDb();
    await db.runAsync(
      `UPDATE products
       SET stock = stock - ?,
           updated_at = ?
       WHERE id = ?`,
      [quantity, Date.now(), productId]
    );
    console.log(`📦 [UPDATE_STOCK] Product ${productId} decreased by ${quantity}`);
  },

  // Get low stock products
  getLowStock: async (threshold: number = 10): Promise<Product[]> => {
    const db = getDb();
    const result = await db.getAllAsync<DBProduct>(
      `SELECT * FROM products
       WHERE stock <= ? AND deleted = 0
       ORDER BY stock ASC`,
      [threshold]
    );

    return result.map(dbProduct => ({
      id: dbProduct.id,
      name: dbProduct.name,
      description: dbProduct.description || '',
      price: dbProduct.price,
      stock: dbProduct.stock,
      barcode: dbProduct.barcode || '',
      deleted: dbProduct.deleted === 1,
      syncStatus: dbProduct.sync_status as 'synced' | 'pending' | 'failed',
      createdAt: dbProduct.created_at,
      updatedAt: dbProduct.updated_at,
      expiryDate: dbProduct.expiry_date || undefined,
    }));
  },

  // Soft delete product
  softDelete: async (id: number): Promise<void> => {
    const db = getDb();
    await db.runAsync(
      `UPDATE products
      SET deleted = 1,
          sync_status = 'pending',
          updated_at = ?
      WHERE id = ?`,
      [Date.now(), id]
    );
    console.log(`🗑️ [SOFT_DELETE] Product ID ${id} marked as deleted`);
  },

  // Get all deleted products
  getDeletedProducts: async (): Promise<Product[]> => {
    const db = getDb();
    const result = await db.getAllAsync<DBProduct>(
      `SELECT *
      FROM products
      WHERE deleted = 1
      ORDER BY updated_at DESC`
    );

    console.log(`📋 [DELETED] Found ${result.length} deleted products`);
    
    return result.map(dbProduct => ({
      id: dbProduct.id,
      name: dbProduct.name,
      description: dbProduct.description || '',
      price: dbProduct.price,
      stock: dbProduct.stock,
      barcode: dbProduct.barcode || '',
      deleted: true,
      syncStatus: dbProduct.sync_status as 'synced' | 'pending' | 'failed',
      createdAt: dbProduct.created_at,
      updatedAt: dbProduct.updated_at,
      expiryDate: dbProduct.expiry_date || undefined,
    }));
  },

  // Restore soft-deleted product
  restoreProduct: async (id: number): Promise<void> => {
    const db = getDb();
    await db.runAsync(
      `UPDATE products
      SET deleted = 0,
          sync_status = 'pending',
          updated_at = ?
      WHERE id = ?`,
      [Date.now(), id]
    );
    console.log(`♻️ [RESTORE] Product ID ${id} restored`);
  },

  // Get product count
  getCount: async (includeDeleted: boolean = false): Promise<number> => {
    const db = getDb();
    const whereClause = includeDeleted ? '' : 'WHERE deleted = 0';
    const result = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM products ${whereClause}`
    );
    return result?.count || 0;
  },

  // Delete product permanently (hard delete)
  hardDelete: async (id: number): Promise<void> => {
    const db = getDb();
    await db.runAsync('DELETE FROM products WHERE id = ?', [id]);
    console.log(`🔥 [HARD_DELETE] Product ID ${id} permanently removed`);
  },

  // Get products by barcode
  getByBarcode: async (barcode: string): Promise<Product | null> => {
    const db = getDb();
    const result = await db.getFirstAsync<DBProduct>(
      'SELECT * FROM products WHERE barcode = ? AND deleted = 0',
      [barcode]
    );

    if (!result) return null;

    return {
      id: result.id,
      name: result.name,
      description: result.description || '',
      price: result.price,
      stock: result.stock,
      barcode: result.barcode || '',
      deleted: result.deleted === 1,
      syncStatus: result.sync_status as 'synced' | 'pending' | 'failed',
      createdAt: result.created_at,
      updatedAt: result.updated_at,
      expiryDate: result.expiry_date || undefined,
    };
  },
};
