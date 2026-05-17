// src/database/repositories/productRepository.ts
import { getDb } from '../sqlite';
import { Product } from '../../types';

export const ProductRepository = {
  // Get all products
  getAll: async (): Promise<Product[]> => {
    const db = getDb();
    const result = await db.getAllAsync('SELECT * FROM products ORDER BY name');
    return result as Product[];
  },

  // Get product by ID
  getById: async (id: number): Promise<Product | null> => {
    const db = getDb();
    const result = await db.getFirstAsync('SELECT * FROM products WHERE id = ?', [id]);
    return result as Product | null;
  },

  // Search products by name or barcode
  search: async (query: string): Promise<Product[]> => {
    const db = getDb();
    const result = await db.getAllAsync(
      `SELECT * FROM products 
       WHERE name LIKE ? OR barcode LIKE ? 
       ORDER BY name`,
      [`%${query}%`, `%${query}%`]
    );
    return result as Product[];
  },
insertSampleProducts: async () => {
    try {
      const db = getDb();
      
      // Check if products exist
      const existing = await db.getAllAsync('SELECT COUNT(*) as count FROM products') as Array<{ count: number }>;
      const count = existing[0]?.count || 0;
      
      if (count === 0) {
        console.log('Inserting sample products...');
        
        const samples = [
          { name: 'ဆန် (အိတ်)', description: 'စပါးဆန်အကြမ်း ၅၀ ကီလို', price: 45000, stock: 100 },
          { name: 'ကြက်ဥ (ဒါဇင်)', description: 'ကြက်အိမ်မွေး ဥများ', price: 3500, stock: 200 },
          { name: 'သကြား ကီလို', description: 'အဖြူသကြား အမှုန့်', price: 2500, stock: 150 },
          { name: 'စားသုံးဆီ လီတာ', description: 'ပဲဆီစစ်စစ်', price: 5500, stock: 80 },
          { name: 'ခေါက်ဆွဲခြောက်', description: 'မြန်မာခေါက်ဆွဲခြောက်', price: 1200, stock: 300 },
          { name: 'ငံပြာရည်', description: 'အကြည်ငံပြာရည်', price: 800, stock: 500 },
          { name: 'ဆား', description: 'အိုင်အိုဒင်း ဆား', price: 500, stock: 400 },
          { name: 'ကြက်သား', description: 'အအေးခန်း ကြက်သား', price: 8000, stock: 50 },
        ];
        
        for (const sample of samples) {
          const now = Date.now();
          await db.runAsync(
            `INSERT INTO products (name, description, price, stock, sync_status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [sample.name, sample.description, sample.price, sample.stock, 'synced', now, now]
          );
        }
        
        console.log(`✅ ${samples.length} sample products inserted`);
      } else {
        console.log(`✅ ${count} products already exist`);
      }
    } catch (error) {
      console.error('Insert sample products error:', error);
    }
  },
  // Save or update product
  save: async (product: Partial<Product>): Promise<number> => {
    const db = getDb();
    const now = Date.now();

    if (product.id) {
      await db.runAsync(
        `UPDATE products 
         SET name = ?, description = ?, price = ?, stock = ?, barcode = ?, 
             sync_status = ?, updated_at = ?
         WHERE id = ?`,
        [
          product.name ?? '',
          product.description ?? '',
          product.price ?? 0,
          product.stock ?? 0,
          product.barcode ?? '',
          product.syncStatus ?? 'synced',
          now,
          product.id,
        ]
      );
      return product.id;
    } else {
      const result = await db.runAsync(
        `INSERT INTO products (name, description, price, stock, barcode, sync_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          product.name ?? '',
          product.description ?? '',
          product.price ?? 0,
          product.stock ?? 0,
          product.barcode ?? '',
          'pending',
          now,
          now,
        ]
      );
      return result.lastInsertRowId;
    }
  },

  // Update stock
  updateStock: async (productId: number, quantity: number): Promise<void> => {
    const db = getDb();
    await db.runAsync('UPDATE products SET stock = stock - ? WHERE id = ?', [
      quantity,
      productId,
    ]);
  },

  // Get low stock products
  getLowStock: async (threshold: number = 10): Promise<Product[]> => {
    const db = getDb();
    const result = await db.getAllAsync(
      'SELECT * FROM products WHERE stock <= ? ORDER BY stock ASC',
      [threshold]
    );
    return result as Product[];
  },
};