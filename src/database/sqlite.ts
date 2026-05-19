// src/database/sqlite.ts
import * as SQLite from 'expo-sqlite';

let database: SQLite.SQLiteDatabase | null = null;
let isInitializing = false;
let initializationPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export const openDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  // If already have a database connection, return it
  if (database) {
    return database;
  }

  // If already initializing, wait for it
  if (isInitializing && initializationPromise) {
    return initializationPromise;
  }

  isInitializing = true;
  
  initializationPromise = (async () => {
    try {
      console.log('Opening database...');
      
      // Open database with proper name
      database = await SQLite.openDatabaseAsync('pos_myanmar.db');
      console.log('Database opened successfully');
      
      // Create tables
      await createTables();
      console.log('Tables created successfully');
      
      return database;
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    } finally {
      isInitializing = false;
    }
  })();

  return initializationPromise;
};

export const getDb = (): SQLite.SQLiteDatabase => {
  if (!database) {
    throw new Error('Database not initialized. Call openDatabase() first.');
  }
  return database;
};

export const isDatabaseReady = (): boolean => {
  return database !== null;
};

const createTables = async () => {
  if (!database) {
    throw new Error('Database not initialized');
  }
  
  try {
    // Create products table
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        stock INTEGER DEFAULT 0,
        barcode TEXT,
        image_url TEXT,
        sync_status TEXT DEFAULT 'synced',
        created_at INTEGER,
        updated_at INTEGER
      );
    `);

    // Create orders table
    await database.execAsync(`
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

    // Create order items table
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        product_id INTEGER,
        quantity INTEGER,
        unit_price REAL,
        total_price REAL,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
      );
    `);

    // Create sync queue table
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        data TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at INTEGER,
        retry_count INTEGER DEFAULT 0
      );
    `);

    // Create indexes
    await database.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
      CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
      CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
    `);

    console.log('All tables created successfully');
  } catch (error) {
    console.error('Error creating tables:', error);
    throw error;
  }
};

export const resetDatabase = async () => {
  try {
    console.log('🔄 Resetting database...');
    
    if (database) {
      await database.closeAsync();
      database = null;
    }
    
    // Wait a moment for close to complete
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await openDatabase();
    console.log('✅ Database reset successful');
  } catch (error) {
    console.error('Database reset error:', error);
    throw error;
  }
};

export const closeDatabase = async () => {
  if (database) {
    await database.closeAsync();
    database = null;
    console.log('Database closed');
  }
};