import { getDb } from '../sqlite';
import { SyncQueueRepository } from './syncQueueRepository';

export interface LocalDebt {
  id: string;
  serverId?: number;
  orderClientReference?: string;
  customerId: string;
  customerName: string;
  phone?: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate?: string;
  note?: string;
  orderNumber?: string;
  orderStatus?: string;
  order?: any;
  syncStatus: 'synced' | 'pending';
  createdAt: number;
}

const customerKey = (id?: string | number | null, name?: string, phone?: string) =>
  id != null && String(id).length ? `server-${id}` : `local-${(phone || name || 'customer').trim().toLowerCase()}`;

const fromRow = (row: any): LocalDebt => ({
  id: String(row.id),
  serverId: row.server_id ?? undefined,
  orderClientReference: row.order_client_reference ?? undefined,
  customerId: row.customer_key,
  customerName: row.customer_name,
  phone: row.customer_phone ?? undefined,
  totalAmount: Number(row.total_amount || 0),
  paidAmount: Number(row.paid_amount || 0),
  remainingAmount: Number(row.remaining_amount || 0),
  dueDate: row.due_date ?? undefined,
  note: row.note ?? undefined,
  orderNumber: row.order_number ?? undefined,
  orderStatus: row.order_status ?? undefined,
  order: row.order_items_json ? JSON.parse(row.order_items_json) : undefined,
  syncStatus: row.sync_status === 'pending' ? 'pending' : 'synced',
  createdAt: Number(row.created_at || Date.now()),
});

export const DebtRepository = {
  getOpenCustomers: async () => {
    const db = getDb();
    const rows = await db.getAllAsync<any>(
      `SELECT customer_key, MAX(customer_name) AS customer_name, MAX(customer_phone) AS phone,
              SUM(remaining_amount) AS total_debt, COUNT(*) AS order_count
       FROM debts WHERE remaining_amount > 0 GROUP BY customer_key
       ORDER BY total_debt DESC, customer_name COLLATE NOCASE ASC`
    );
    return rows.map(row => ({
      customerId: row.customer_key,
      customerName: row.customer_name,
      phone: row.phone || '',
      totalDebt: Number(row.total_debt || 0),
      orderCount: Number(row.order_count || 0),
    }));
  },

  getByCustomer: async (key: string): Promise<LocalDebt[]> => {
    const db = getDb();
    const rows = await db.getAllAsync<any>(
      'SELECT * FROM debts WHERE customer_key = ? ORDER BY created_at DESC', [key]
    );
    return rows.map(fromRow);
  },

  createForOfflineOrder: async (input: {
    localOrderId: number;
    clientReference: string;
    customerName: string;
    customerPhone: string;
    totalAmount: number;
    dueDate?: string;
    note?: string;
    items: any[];
  }) => {
    const db = getDb();
    const now = Date.now();
    const key = customerKey(null, input.customerName, input.customerPhone);
    await db.runAsync(
      `INSERT OR REPLACE INTO debts (
        id, order_client_reference, customer_key, customer_name, customer_phone,
        total_amount, paid_amount, remaining_amount, due_date, note, order_number,
        order_status, order_items_json, sync_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 'PENDING', ?, 'pending', ?, ?)`,
      [
        `local-${input.localOrderId}`, input.clientReference, key, input.customerName, input.customerPhone,
        input.totalAmount, input.totalAmount, input.dueDate ?? null, input.note ?? null,
        input.clientReference, JSON.stringify({ items: input.items }), now, now,
      ]
    );
  },

  cacheServerDebts: async (serverDebts: any[]): Promise<void> => {
    const db = getDb();
    for (const debt of serverDebts) {
      const order = debt.order || {};
      const customer = debt.customer || order.customer || {};
      const key = customerKey(customer.id, customer.name, customer.phone);
      const reference = order.clientReference || null;
      const existing = reference
        ? await db.getFirstAsync<any>('SELECT id FROM debts WHERE order_client_reference = ? LIMIT 1', [reference])
        : await db.getFirstAsync<any>('SELECT id FROM debts WHERE server_id = ? LIMIT 1', [debt.id]);
      const id = existing?.id || String(debt.id);
      const total = Number(debt.totalAmount || order.totalAmount || 0);
      const remaining = Number(debt.remainingAmount ?? total);
      const paid = Number(debt.paidAmount ?? Math.max(0, total - remaining));
      const createdAt = new Date(debt.createdAt || order.createdAt || Date.now()).getTime();
      await db.runAsync(
        `INSERT OR REPLACE INTO debts (
          id, server_id, order_client_reference, customer_key, customer_name, customer_phone,
          total_amount, paid_amount, remaining_amount, due_date, note, order_number,
          order_status, order_items_json, sync_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?)`,
        [id, debt.id, reference, key, customer.name || 'ဖောက်သည်', customer.phone || null, total, paid,
          remaining, debt.dueDate || null, debt.note || null, order.orderNumber || null,
          order.status || (remaining <= 0 ? 'COMPLETED' : 'PENDING'), JSON.stringify(order), createdAt, Date.now()]
      );
    }
  },

  recordPayment: async (debt: LocalDebt, amount: number, paymentMethod: 'CASH' | 'TRANSFER') => {
    if (!Number.isFinite(amount) || amount <= 0 || amount > debt.remainingAmount) {
      throw new Error('Payment amount is invalid');
    }
    const db = getDb();
    const remaining = Math.max(0, debt.remainingAmount - amount);
    await db.runAsync(
      `UPDATE debts SET paid_amount = paid_amount + ?, remaining_amount = ?,
       order_status = ?, sync_status = 'pending', updated_at = ? WHERE id = ?`,
      [amount, remaining, remaining === 0 ? 'COMPLETED' : 'PENDING', Date.now(), debt.id]
    );
    await SyncQueueRepository.add(
      debt.serverId ? 'DEBT_PAYMENT' : 'DEBT_PAYMENT_ORDER',
      debt.serverId
        ? { debtId: debt.serverId, amount, paymentMethod, localDebtId: debt.id }
        : { orderClientReference: debt.orderClientReference, amount, paymentMethod, localDebtId: debt.id }
    );
  },

  markSynced: async (id: string) => {
    const db = getDb();
    await db.runAsync("UPDATE debts SET sync_status = 'synced', updated_at = ? WHERE id = ?", [Date.now(), id]);
  },
};
