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
    
    // Use FIXED database name for data persistence
    const dbName = 'pos_myanmar.db';
    console.log(`Opening database: ${dbName}`);
    database = await SQLite.openDatabaseAsync(dbName);
    console.log('Database opened successfully');
    
    // Create or update tables
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

// Add column if it doesn't exist
const addColumnIfNotExists = async (tableName: string, columnName: string, columnType: string) => {
  try {
    await database?.execAsync(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`);
    console.log(`✅ Added column ${columnName} to ${tableName}`);
  } catch (error: any) {
    // Column already exists - this is fine
    if (!error.message?.includes('duplicate column')) {
      console.log(`Column ${columnName} already exists in ${tableName}`);
    }
  }
};

const createTables = async () => {
  if (!database) {
    throw new Error('Database not initialized');
  }
  
  try {
    console.log('Creating/Updating tables...');
    
    // Create products table (with all columns)
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY,
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
    console.log('Products table created/verified');
    
    // Try to add missing columns if they don't exist
    await addColumnIfNotExists('products', 'deleted', 'INTEGER DEFAULT 0');
    
    // Create orders table
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT,
        total_amount REAL,
        payment_method TEXT,
        status TEXT DEFAULT 'pending',
        sync_status TEXT DEFAULT 'pending',
        created_at INTEGER,
        synced_at INTEGER
      );
    `);
    console.log('Orders table created/verified');

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
    console.log('Order items table created/verified');

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
    console.log('Sync queue table created/verified');

    // Create indexes for better performance
    try {
      await database.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
        CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
        CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
        CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
        CREATE INDEX IF NOT EXISTS idx_orders_sync_status ON orders(sync_status);
        CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
        CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
      `);
      console.log('Indexes created');
    } catch (indexError) {
      console.log('Some indexes already exist');
    }

    console.log('All tables ready');
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

export const clearAllData = async () => {
  try {
    console.log('🗑️ Clearing all data from database...');
    const db = getDb();
    
    await db.execAsync('BEGIN TRANSACTION');
    
    await db.runAsync('DELETE FROM products');
    await db.runAsync('DELETE FROM orders');
    await db.runAsync('DELETE FROM order_items');
    await db.runAsync('DELETE FROM sync_queue');
    
    // Reset auto-increment counters
    await db.runAsync("DELETE FROM sqlite_sequence WHERE name IN ('orders', 'order_items', 'sync_queue')");
    
    await db.execAsync('COMMIT');
    
    console.log('✅ All data cleared successfully');
  } catch (error) {
    console.error('❌ Error clearing data:', error);
    const db = getDb();
    await db.execAsync('ROLLBACK');
    throw error;
  }
};

// Helper function to get typed query result
export async function queryFirst<T = any>(
  sql: string, 
  params: any[] = []
): Promise<T | null> {
  const db = getDb();
  return await db.getFirstAsync<T>(sql, params);
}

// Helper function to get typed query results
export async function queryAll<T = any>(
  sql: string, 
  params: any[] = []
): Promise<T[]> {
  const db = getDb();
  return await db.getAllAsync<T>(sql, params);
}

export const getDatabaseStats = async () => {
  try {
    const db = getDb();
    
    const productCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM products where deleted = 0');
    const deletedCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM products where deleted = 1');
    const orderCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM orders');
    const pendingSyncCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM sync_queue WHERE status = "pending"');
    
    return {
      products: productCount?.count || 0,
      deletedProducts: deletedCount?.count || 0,
      orders: orderCount?.count || 0,
      pendingSync: pendingSyncCount?.count || 0,
    };
  } catch (error) {
    console.error('Error getting database stats:', error);
    return { products: 0, deletedProducts: 0, orders: 0, pendingSync: 0 };
  }
};