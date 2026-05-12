// src/database/sqlite.ts
import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase;

export const openDatabase = async () => {
  db = await SQLite.openDatabaseAsync('pos_myanmar.db');
  await createTables();
  return db;
};

const createTables = async () => {
  // Products table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      stock INTEGER DEFAULT 0,
      barcode TEXT,
      sync_status TEXT DEFAULT 'synced',
      created_at INTEGER,
      updated_at INTEGER
    );
  `);

  // Orders table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      local_id TEXT UNIQUE,
      order_number TEXT,
      total_amount REAL,
      payment_method TEXT,
      status TEXT DEFAULT 'pending',
      sync_status TEXT DEFAULT 'pending',
      created_at INTEGER,
      synced_at INTEGER
    );
  `);

  // Order items table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      product_id INTEGER,
      quantity INTEGER,
      unit_price REAL,
      total_price REAL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
  `);

  // Sync queue table for offline mutations [citation:10]
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      data TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at INTEGER,
      retry_count INTEGER DEFAULT 0
    );
  `);

  // Create indexes for performance
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
  `);

  console.log('Database tables created successfully');
};

export const getDb = () => db;