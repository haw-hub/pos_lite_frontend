// src/database/sqlite.ts
import * as SQLite from 'expo-sqlite';

let database: SQLite.SQLiteDatabase | null = null;
let isInitialized = false;

export const openDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  try {
    console.log('Opening database...');
    
    // Close existing connection if any
    if (database) {
      try {
        await database.closeAsync();
      } catch (e) {
        console.log('Error closing existing database:', e);
      }
      database = null;
      isInitialized = false;
    }
    
    // Open database with a timestamp to ensure fresh start
    const dbName = `pos_myanmar_${Date.now()}.db`;
    console.log(`Creating new database: ${dbName}`);
    database = await SQLite.openDatabaseAsync(dbName);
    console.log('Database opened successfully');
    
    // Create tables
    await createTables();
    
    isInitialized = true;
    console.log('Database fully initialized');
    
    return database;
  } catch (error) {
    console.error('Database initialization error:', error);
    database = null;
    isInitialized = false;
    throw error;
  }
};

export const getDb = (): SQLite.SQLiteDatabase => {
  if (!database) {
    throw new Error('Database not initialized. Call openDatabase() first.');
  }
  return database;
};

export const isDatabaseReady = (): boolean => {
  return isInitialized && database !== null;
};

export const waitForDatabase = async (maxRetries = 10): Promise<boolean> => {
  for (let i = 0; i < maxRetries; i++) {
    if (isDatabaseReady()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return false;
};

const createTables = async () => {
  if (!database) {
    throw new Error('Database not initialized');
  }
  
  try {
    console.log('Creating tables...');
    
    // Create products table
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        stock INTEGER DEFAULT 0,
        barcode TEXT,
        deleted INTEGER DEFAULT 0,
        sync_status TEXT DEFAULT 'synced',
        created_at INTEGER,
        updated_at INTEGER
      );
    `);
    console.log('Products table created');

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
    console.log('Orders table created');

    // Create order items table
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        product_id INTEGER,
        quantity INTEGER,
        unit_price REAL,
        total_price REAL
      );
    `);
    console.log('Order items table created');

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
    console.log('Sync queue table created');

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
      try {
        await database.closeAsync();
      } catch (e) {
        console.log('Error closing database:', e);
      }
      database = null;
    }
    
    isInitialized = false;
    
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Reopen fresh database
    await openDatabase();
    console.log('✅ Database reset successful');
  } catch (error) {
    console.error('Database reset error:', error);
    throw error;
  }
};