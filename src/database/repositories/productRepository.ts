// src/database/repositories/productRepository.ts

import { getDb, isDatabaseReady } from '../sqlite';
import { Product } from '../../types';

export const ProductRepository = {

  // Get all products
  getAll: async (): Promise<Product[]> => {
    if (!isDatabaseReady()) {
      console.log('⏳ Database not ready, waiting...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const db = getDb();

    const result = await db.getAllAsync(
      'SELECT * FROM products ORDER BY name ASC'
    );

    return result as Product[];
  },

  // Get product by ID
  getById: async (id: number): Promise<Product | null> => {
    const db = getDb();

    const result = await db.getFirstAsync(
      'SELECT * FROM products WHERE id = ?',
      [id]
    );

    return result as Product | null;
  },

  // Search products
  search: async (query: string): Promise<Product[]> => {
    const db = getDb();

    const result = await db.getAllAsync(
      `SELECT * FROM products
       WHERE name LIKE ?
       OR barcode LIKE ?
       ORDER BY name ASC`,
      [`%${query}%`, `%${query}%`]
    );

    return result as Product[];
  },

  // SAVE OR UPDATE PRODUCT
  save: async (product: Partial<Product>): Promise<number> => {
    const db = getDb();
    const now = Date.now();

    try {

      // CHECK IF PRODUCT EXISTS
      const existing = await db.getFirstAsync(
            'SELECT id FROM products WHERE id = ?',
            [product.id ?? null]
      );

      // UPDATE EXISTING PRODUCT
      if (existing) {

        console.log(`🔄 Updating existing product ID: ${product.id}`);

        await db.runAsync(
          `UPDATE products
           SET
             name = ?,
             description = ?,
             price = ?,
             stock = ?,
             barcode = ?,
             sync_status = ?,
             updated_at = ?
           WHERE id = ?`,
          [
            product.name ?? '',
            product.description ?? '',
            product.price ?? 0,
            product.stock ?? 0,
            product.barcode ?? '',
            product.syncStatus ?? 'synced',
            now,
            product.id ?? null,
          ]
        );

        return product.id!;
      }

      // INSERT NEW PRODUCT
      console.log(`➕ Inserting new product ID: ${product.id}`);

      const result = await db.runAsync(
        `INSERT INTO products (
          id,
          name,
          description,
          price,
          stock,
          barcode,
          sync_status,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          product.id ?? null,
          product.name ?? '',
          product.description ?? '',
          product.price ?? 0,
          product.stock ?? 0,
          product.barcode ?? '',
          product.syncStatus ?? 'synced',
          now,
          now,
        ]
      );

      return Number(product.id || result.lastInsertRowId);

    } catch (error) {
      console.error('❌ Product save error:', error);
      throw error;
    }
  },

  // Update stock
  updateStock: async (
    productId: number,
    quantity: number
  ): Promise<void> => {

    const db = getDb();

    await db.runAsync(
      `UPDATE products
       SET stock = stock - ?
       WHERE id = ?`,
      [quantity, productId]
    );
  },

  // Get low stock products
  getLowStock: async (
    threshold: number = 10
  ): Promise<Product[]> => {

    const db = getDb();

    const result = await db.getAllAsync(
      `SELECT * FROM products
       WHERE stock <= ?
       ORDER BY stock ASC`,
      [threshold]
    );

    return result as Product[];
  },
};