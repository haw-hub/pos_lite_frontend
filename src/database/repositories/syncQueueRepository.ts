// src/database/repositories/syncQueueRepository.ts
import { getDb } from '../sqlite';

export interface SyncQueueItem {
  id?: number;
  type: 'ORDER' | 'PRODUCT' | 'PRODUCT_UPDATE';
  data: string;
  status: 'pending' | 'completed' | 'failed';
  created_at: number;
  retry_count: number;
}

export const SyncQueueRepository = {
  // Add item to sync queue [citation:10]
  add: async (type: SyncQueueItem['type'], data: any): Promise<number> => {
    const db = getDb();
    const result = await db.runAsync(
      `INSERT INTO sync_queue (type, data, status, created_at, retry_count)
       VALUES (?, ?, ?, ?, ?)`,
      [type, JSON.stringify(data), 'pending', Date.now(), 0]
    );
    return result.lastInsertRowId;
  },

  // Get all pending items
  getPending: async (): Promise<SyncQueueItem[]> => {
    const db = getDb();
    const result = await db.getAllAsync(
      'SELECT * FROM sync_queue WHERE status = "pending" ORDER BY created_at ASC'
    );
    return result as SyncQueueItem[];
  },

  // Mark as completed
  markCompleted: async (id: number): Promise<void> => {
    const db = getDb();
    await db.runAsync('UPDATE sync_queue SET status = "completed" WHERE id = ?', [
      id,
    ]);
  },

  // Mark as failed with retry count
  markFailed: async (id: number): Promise<void> => {
    const db = getDb();
    await db.runAsync(
      'UPDATE sync_queue SET status = "failed", retry_count = retry_count + 1 WHERE id = ?',
      [id]
    );
  },

  // Delete completed items older than 7 days
  cleanup: async (): Promise<void> => {
    const db = getDb();
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    await db.runAsync(
      'DELETE FROM sync_queue WHERE status = "completed" AND created_at < ?',
      [sevenDaysAgo]
    );
  },
};