// src/database/repositories/syncQueueRepository.ts
import { getDb } from '../sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SyncQueueItem {
  id?: number;
  type: 'ORDER' | 'PRODUCT' | 'PRODUCT_UPDATE' | 'PRODUCT_DELETE' | 'PRODUCT_RESTORE';
  data: string;
  status: 'pending' | 'completed' | 'failed';
  created_at: number;
  retry_count: number;
  actor_user_id?: number;
}

const currentUserId = async (): Promise<number | null> => {
  const stored = await AsyncStorage.getItem('user_data');
  if (!stored) return null;
  return Number(JSON.parse(stored).userId) || null;
};

export const SyncQueueRepository = {
  // Add item to sync queue
  add: async (type: SyncQueueItem['type'], data: any): Promise<number> => {
    const db = getDb();
    const actorUserId = await currentUserId();
    if (!actorUserId) throw new Error('Authenticated user is required for offline sync');
    const result = await db.runAsync(
      `INSERT INTO sync_queue (type, data, status, created_at, retry_count, actor_user_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [type, JSON.stringify(data), 'pending', Date.now(), 0, actorUserId]
    );
    console.log(`📝 Added to sync queue: ${type}`, data.id || data.orderNumber);
    return result.lastInsertRowId;
  },

  // Get all pending items
  getPending: async (): Promise<SyncQueueItem[]> => {
    const db = getDb();
    const actorUserId = await currentUserId();
    if (!actorUserId) return [];
    const result = await db.getAllAsync<SyncQueueItem>(
      `SELECT * FROM sync_queue
       WHERE status IN ("pending", "failed") AND actor_user_id = ?
       ORDER BY created_at ASC`,
      [actorUserId]
    );
    return result;
  },

  getAllPending: async (): Promise<SyncQueueItem[]> => {
    const db = getDb();
    return db.getAllAsync<SyncQueueItem>(
      'SELECT * FROM sync_queue WHERE status IN ("pending", "failed") ORDER BY created_at ASC'
    );
  },

  // Mark as completed
  markCompleted: async (id: number): Promise<void> => {
    const db = getDb();
    await db.runAsync('UPDATE sync_queue SET status = "completed" WHERE id = ?', [id]);
    console.log(`✅ Sync queue item ${id} marked as completed`);
  },

  // Mark as failed with retry count
  markFailed: async (id: number): Promise<void> => {
    const db = getDb();
    await db.runAsync(
      'UPDATE sync_queue SET status = "pending", retry_count = retry_count + 1 WHERE id = ?',
      [id]
    );
    const retry = await SyncQueueRepository.getRetryCount(id);
    console.log(`Sync queue item ${id} scheduled for retry (${retry})`);
  },

  // Get retry count for an item
  getRetryCount: async (id: number): Promise<number> => {
    const db = getDb();
    const result = await db.getFirstAsync<{ retry_count: number }>(
      'SELECT retry_count FROM sync_queue WHERE id = ?',
      [id]
    );
    return result?.retry_count || 0;
  },

  // Delete failed item (no more retries)
  deleteFailed: async (id: number): Promise<void> => {
    const db = getDb();
    await db.runAsync('DELETE FROM sync_queue WHERE id = ?', [id]);
    console.log(`🗑️ Deleted failed sync item ${id}`);
  },

  // Get all failed items
  getFailed: async (): Promise<SyncQueueItem[]> => {
    const db = getDb();
    const result = await db.getAllAsync<SyncQueueItem>(
      'SELECT * FROM sync_queue WHERE status = "failed" ORDER BY created_at ASC'
    );
    return result;
  },

  // Delete all failed items
  clearFailed: async (): Promise<void> => {
    const db = getDb();
    const result = await db.runAsync('DELETE FROM sync_queue WHERE status = "failed"');
    console.log(`🗑️ Deleted ${result.changes} failed sync items`);
  },

  // Delete completed items older than 7 days
  cleanup: async (): Promise<void> => {
    const db = getDb();
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const result = await db.runAsync(
      'DELETE FROM sync_queue WHERE status = "completed" AND created_at < ?',
      [sevenDaysAgo]
    );
    if (result.changes > 0) {
      console.log(`🧹 Cleaned up ${result.changes} old completed items`);
    }
  },
};
