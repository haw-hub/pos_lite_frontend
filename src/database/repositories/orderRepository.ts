import { getDb } from '../sqlite';
import { SyncQueueRepository } from './syncQueueRepository';

export interface LocalOrderInput {
  items: Array<{
    productId: number;
    quantity: number;
    unitPrice: number;
  }>;
  paymentMethod: string;
  totalAmount: number;
  customerName?: string;
  customerPhone?: string;
}

export interface LocalOrder {
  id: number;
  orderNumber: string;
  totalAmount: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
}

const createClientReference = () =>
  `order-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

export const OrderRepository = {
  getAll: async (): Promise<LocalOrder[]> => {
    const db = getDb();
    const rows = await db.getAllAsync<any>(
      'SELECT * FROM orders ORDER BY created_at DESC'
    );
    return rows.map(OrderRepository.toLocalOrder);
  },

  getToday: async (): Promise<LocalOrder[]> => {
    const db = getDb();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const rows = await db.getAllAsync<any>(
      'SELECT * FROM orders WHERE created_at >= ? ORDER BY created_at DESC',
      [start.getTime()]
    );
    return rows.map(OrderRepository.toLocalOrder);
  },

  cacheServerOrders: async (orders: any[]): Promise<void> => {
    const db = getDb();
    for (const order of orders) {
      const createdAt = new Date(order.createdAt).getTime() || Date.now();
      const existing = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM orders WHERE server_id = ? OR order_number = ? LIMIT 1',
        [order.id, order.orderNumber]
      );
      if (existing) {
        await db.runAsync(
          `UPDATE orders SET server_id = ?, order_number = ?, total_amount = ?,
           payment_method = ?, status = ?, sync_status = 'synced',
           created_at = ?, synced_at = ? WHERE id = ?`,
          [
            order.id,
            order.orderNumber,
            order.totalAmount,
            order.paymentMethod,
            String(order.status).toLowerCase(),
            createdAt,
            Date.now(),
            existing.id,
          ]
        );
      } else {
        await db.runAsync(
          `INSERT INTO orders (
            server_id, order_number, total_amount, payment_method, status,
            sync_status, created_at, synced_at
          ) VALUES (?, ?, ?, ?, ?, 'synced', ?, ?)`,
          [
            order.id,
            order.orderNumber,
            order.totalAmount,
            order.paymentMethod,
            String(order.status).toLowerCase(),
            createdAt,
            Date.now(),
          ]
        );
      }
    }
  },

  toLocalOrder: (row: any): LocalOrder => ({
    id: row.server_id ?? row.id,
    orderNumber: row.order_number,
    totalAmount: Number(row.total_amount || 0),
    paymentMethod: row.payment_method,
    status: String(row.status || 'pending').toUpperCase(),
    createdAt: new Date(row.created_at).toISOString(),
  }),

  savePending: async (input: LocalOrderInput): Promise<number> => {
    const db = getDb();
    const now = Date.now();
    const clientReference = createClientReference();

    await db.execAsync('BEGIN TRANSACTION');
    try {
      const result = await db.runAsync(
        `INSERT INTO orders (
          order_number, client_reference, total_amount, payment_method, status,
          sync_status, customer_name, customer_phone, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          clientReference,
          clientReference,
          input.totalAmount,
          input.paymentMethod,
          'pending',
          'pending',
          input.customerName ?? null,
          input.customerPhone ?? null,
          now,
        ]
      );
      const localOrderId = Number(result.lastInsertRowId);

      for (const item of input.items) {
        const product = await db.getFirstAsync<{ stock: number; name: string; expiry_date: string | null }>(
          'SELECT stock, name, expiry_date FROM products WHERE id = ? AND deleted = 0',
          [item.productId]
        );
        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }
        if (
          product.expiry_date &&
          new Date(`${product.expiry_date}T23:59:59`).getTime() < Date.now()
        ) {
          throw new Error(`${product.name} has expired`);
        }
        if (item.quantity <= 0 || product.stock < item.quantity) {
          throw new Error(`${product.name} has only ${product.stock} item(s) left`);
        }
        await db.runAsync(
          `INSERT INTO order_items (
            order_id, product_id, quantity, unit_price, total_price
          ) VALUES (?, ?, ?, ?, ?)`,
          [
            localOrderId,
            item.productId,
            item.quantity,
            item.unitPrice,
            item.unitPrice * item.quantity,
          ]
        );
        await db.runAsync(
          `UPDATE products
           SET stock = stock - ?, updated_at = ?
           WHERE id = ?`,
          [item.quantity, now, item.productId]
        );
      }

      await SyncQueueRepository.add('ORDER', {
        localOrderId,
        request: {
          clientReference,
          items: input.items.map(({ productId, quantity }) => ({ productId, quantity })),
          paymentMethod: input.paymentMethod,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
        },
      });
      await db.execAsync('COMMIT');
      return localOrderId;
    } catch (error) {
      await db.execAsync('ROLLBACK');
      throw error;
    }
  },

  markSynced: async (localOrderId: number, serverId: number, orderNumber: string): Promise<void> => {
    const db = getDb();
    await db.runAsync(
      `UPDATE orders
       SET server_id = ?, order_number = ?, status = 'completed',
           sync_status = 'synced', synced_at = ?
       WHERE id = ?`,
      [serverId, orderNumber, Date.now(), localOrderId]
    );
  },
};
