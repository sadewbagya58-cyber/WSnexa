import { OrderStatus } from '@/lib/validation/order';

export interface SafeActiveOrderRecord {
  orderId: string;
  orderNumberFormatted: string;
  branchId: string;
  tableId: string | null;
  tableName: string | null;
  createdAt: string;
  latestStatus: OrderStatus;
  accessToken: string;
}

const STORAGE_PREFIX = 'wsnexa_active_order_v1_';
const MAX_ORDERS_PER_BRANCH = 3;
const RETENTION_HOURS = 24;

/**
 * Saves a new active order safely into sessionStorage.
 */
export function saveActiveOrderToStorage(record: SafeActiveOrderRecord): void {
  if (typeof window === 'undefined') return;

  try {
    const key = `${STORAGE_PREFIX}${record.branchId}`;
    const existing = getActiveOrdersFromStorage(record.branchId);

    // Filter out duplicates if same orderId exists
    const filtered = existing.filter((item) => item.orderId !== record.orderId);

    // Prepend new order
    const updated = [record, ...filtered].slice(0, MAX_ORDERS_PER_BRANCH);

    sessionStorage.setItem(key, JSON.stringify(updated));
  } catch (err: unknown) {
    console.error('Failed to save active order to storage:', err);
  }
}

/**
 * Retrieves valid active orders for a branch from sessionStorage.
 */
export function getActiveOrdersFromStorage(branchId: string): SafeActiveOrderRecord[] {
  if (typeof window === 'undefined') return [];

  try {
    const key = `${STORAGE_PREFIX}${branchId}`;
    const raw = sessionStorage.getItem(key);
    if (!raw) return [];

    const items = JSON.parse(raw) as SafeActiveOrderRecord[];
    const now = Date.now();
    const cutoffMs = RETENTION_HOURS * 60 * 60 * 1000;

    // Filter by 24h retention and valid safe schema
    const valid = items.filter((item) => {
      if (!item || !item.orderId || !item.accessToken || !item.createdAt) return false;
      const createdTime = new Date(item.createdAt).getTime();
      return now - createdTime < cutoffMs;
    });

    if (valid.length !== items.length) {
      sessionStorage.setItem(key, JSON.stringify(valid));
    }

    return valid;
  } catch (err: unknown) {
    console.error('Failed to read active orders from storage:', err);
    return [];
  }
}

/**
 * Updates status of a stored active order.
 */
export function updateActiveOrderStatusInStorage(
  branchId: string,
  orderId: string,
  newStatus: OrderStatus
): void {
  if (typeof window === 'undefined') return;

  try {
    const existing = getActiveOrdersFromStorage(branchId);
    let updated = false;

    const newItems = existing.map((item) => {
      if (item.orderId === orderId) {
        updated = true;
        return { ...item, latestStatus: newStatus };
      }
      return item;
    });

    if (updated) {
      const key = `${STORAGE_PREFIX}${branchId}`;
      sessionStorage.setItem(key, JSON.stringify(newItems));
    }
  } catch (err: unknown) {
    console.error('Failed to update active order status in storage:', err);
  }
}
