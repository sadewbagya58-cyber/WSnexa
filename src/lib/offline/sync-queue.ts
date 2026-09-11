/**
 * WSNexa Offline Mutation Synchronization Queue
 * Phase 38 Mobile Foundation & Offline Resilience
 */

import { QueuedMutation, MutationStatus, EntityType, SyncEngineStats, MutationClassification } from './offline-types';
import { StorageAdapter } from './storage-adapter';
import { networkStatus } from './network-status';

const QUEUE_STORAGE_PREFIX = 'wsnexa_sync_queue_v1';
const MAX_DEFAULT_ATTEMPTS = 5;

// Operations that MUST NEVER be queued offline
const ONLINE_ONLY_OPERATIONS = new Set([
  'payment',
  'process_payment',
  'refund',
  'settlement',
  'close_register',
  'subscription_upgrade',
  'subscription_checkout',
  'cancel_order', // Authoritative Order Cancellation is QA-closed
  'cancel_item',
  'invite_staff',
  'modify_rbac',
  'publish_venue',
]);

type QueueListener = (stats: SyncEngineStats) => void;
type MutationHandler = (mutation: QueuedMutation) => Promise<{ success: boolean; data?: unknown; error?: string; status?: number }>;

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class SyncQueueManager {
  private queue: QueuedMutation[] = [];
  private isProcessing = false;
  private listeners: Set<QueueListener> = new Set();
  private customHandlers: Map<string, MutationHandler> = new Map();
  private lastSyncedAt: string | null = null;
  private initialized = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  public async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    await this.loadQueueFromStorage();

    // Auto-process queue when network returns
    networkStatus.subscribe((state) => {
      if (state.connected && this.hasPendingMutations()) {
        this.processQueue();
      }
    });
  }

  private getStorageKey(businessId?: string, branchId?: string): string {
    const biz = businessId || 'default';
    const br = branchId || 'all';
    return `${QUEUE_STORAGE_PREFIX}:${biz}:${br}`;
  }

  private async loadQueueFromStorage(): Promise<void> {
    try {
      const keys = await StorageAdapter.getKeys(QUEUE_STORAGE_PREFIX);
      const loaded: QueuedMutation[] = [];

      for (const key of keys) {
        const raw = await StorageAdapter.getItem(key);
        if (raw) {
          try {
            const items = JSON.parse(raw) as QueuedMutation[];
            if (Array.isArray(items)) {
              loaded.push(...items);
            }
          } catch (parseErr) {
            console.warn(`[SyncQueue] Failed to parse queue at ${key}:`, parseErr);
          }
        }
      }

      // Filter and deduplicate by operation_id
      const seen = new Set<string>();
      this.queue = loaded.filter((item) => {
        if (!item || !item.operation_id || seen.has(item.operation_id)) return false;
        seen.add(item.operation_id);
        return true;
      });

      // Reset any stuck 'syncing' status back to 'pending' on startup
      for (const item of this.queue) {
        if (item.status === 'syncing') {
          item.status = 'pending';
        }
      }

      this.notifyListeners();
    } catch (err) {
      console.error('[SyncQueue] Failed to load queue from storage:', err);
    }
  }

  private async persistQueue(): Promise<void> {
    try {
      // Group queue by business and branch
      const groups = new Map<string, QueuedMutation[]>();

      for (const item of this.queue) {
        const key = this.getStorageKey(item.business_id, item.branch_id);
        const list = groups.get(key) || [];
        list.push(item);
        groups.set(key, list);
      }

      // If queue is empty, clear existing keys
      if (this.queue.length === 0) {
        await StorageAdapter.clear(QUEUE_STORAGE_PREFIX);
      } else {
        for (const [key, items] of groups.entries()) {
          await StorageAdapter.setItem(key, JSON.stringify(items));
        }
      }

      this.notifyListeners();
    } catch (err) {
      console.error('[SyncQueue] Failed to persist queue:', err);
    }
  }

  /**
   * Classifies an operation to guarantee invariant safety
   */
  public classifyOperation(action: string): MutationClassification {
    const normalized = action.toLowerCase().trim();
    if (ONLINE_ONLY_OPERATIONS.has(normalized)) {
      return 'ONLINE_ONLY';
    }
    return 'OFFLINE_QUEUEABLE';
  }

  /**
   * Registers a custom handler for a specific entity or action
   */
  public registerHandler(actionKey: string, handler: MutationHandler): void {
    this.customHandlers.set(actionKey, handler);
  }

  /**
   * Queues an operational mutation for background / offline synchronization
   */
  public async enqueue<TPayload = Record<string, unknown>>(params: {
    entity_type: EntityType;
    entity_id: string;
    action: string;
    payload: TPayload;
    business_id: string;
    branch_id: string;
    user_id: string;
    operation_id?: string;
    max_attempts?: number;
  }): Promise<QueuedMutation<TPayload>> {
    // 1. Invariant Check: Verify operation is not forbidden offline
    const classification = this.classifyOperation(params.action);
    if (classification === 'ONLINE_ONLY') {
      throw new Error(
        `[SyncQueue Invariant Violation] Action "${params.action}" is strictly ONLINE-ONLY and must never be queued offline.`
      );
    }

    // 2. Deduplication check: Check if identical operation_id already queued
    const operationId = params.operation_id || generateUUID();
    const existing = this.queue.find((q) => q.operation_id === operationId);
    if (existing) {
      return existing as QueuedMutation<TPayload>;
    }

    const mutation: QueuedMutation<TPayload> = {
      operation_id: operationId,
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      action: params.action,
      payload: params.payload,
      status: 'pending',
      created_at: new Date().toISOString(),
      client_timestamp: Date.now(),
      attempt_count: 0,
      max_attempts: params.max_attempts || MAX_DEFAULT_ATTEMPTS,
      business_id: params.business_id,
      branch_id: params.branch_id,
      user_id: params.user_id,
    };

    this.queue.push(mutation as QueuedMutation);
    await this.persistQueue();

    // If online, kick off sync immediately in the background
    if (networkStatus.isOnline()) {
      this.processQueue().catch((err) => {
        console.warn('[SyncQueue] Immediate sync attempt failed:', err);
      });
    }

    return mutation;
  }

  /**
   * Computes exponential backoff delay in milliseconds
   */
  public calculateBackoffDelay(attemptCount: number): number {
    const baseDelayMs = 1000;
    const maxDelayMs = 30000;
    const backoff = Math.min(baseDelayMs * Math.pow(2, attemptCount), maxDelayMs);
    const jitter = Math.random() * 500;
    return Math.floor(backoff + jitter);
  }

  /**
   * Processes all pending mutations in the queue sequentially (FIFO)
   */
  public async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    if (!networkStatus.isOnline()) return;

    this.isProcessing = true;
    this.notifyListeners();

    try {
      // Sort by client_timestamp ascending for strict FIFO ordering
      const pendingItems = this.queue
        .filter((item) => item.status === 'pending')
        .sort((a, b) => a.client_timestamp - b.client_timestamp);

      for (const item of pendingItems) {
        // Re-check network connectivity before each item
        if (!networkStatus.isOnline()) {
          console.log('[SyncQueue] Network disconnected during sync, pausing.');
          break;
        }

        item.status = 'syncing';
        item.attempt_count += 1;
        item.last_attempt_at = new Date().toISOString();
        this.notifyListeners();

        try {
          const handler = this.customHandlers.get(item.action) || this.customHandlers.get(item.entity_type);
          let result: { success: boolean; data?: unknown; error?: string; status?: number };

          if (handler) {
            result = await handler(item);
          } else {
            // Default server synchronization dispatch
            result = await this.defaultServerDispatch(item);
          }

          if (result.success) {
            item.status = 'synced';
            item.server_response = result.data;
            item.last_error = undefined;
            this.lastSyncedAt = new Date().toISOString();
          } else {
            item.last_error = result.error || 'Server rejected mutation';
            item.last_http_status = result.status;

            // Check if failure is a conflict (409) or permanent client error (4xx)
            if (result.status === 409) {
              item.status = 'conflict';
            } else if (result.status && result.status >= 400 && result.status < 500) {
              item.status = 'failed';
            } else if (item.attempt_count >= item.max_attempts) {
              item.status = 'failed';
            } else {
              item.status = 'pending'; // Will retry next pass
            }
          }
        } catch (itemErr: unknown) {
          const errorMessage = itemErr instanceof Error ? itemErr.message : String(itemErr);
          item.last_error = errorMessage;
          if (item.attempt_count >= item.max_attempts) {
            item.status = 'failed';
          } else {
            item.status = 'pending';
          }
        }

        await this.persistQueue();
      }

      // Cleanup completed synced items older than 1 hour to prevent unbounded growth
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      this.queue = this.queue.filter(
        (item) => !(item.status === 'synced' && item.client_timestamp < oneHourAgo)
      );
      await this.persistQueue();
    } finally {
      this.isProcessing = false;
      this.notifyListeners();
    }
  }

  /**
   * Default HTTP / Server Actions dispatcher for queued mutations
   */
  private async defaultServerDispatch(
    mutation: QueuedMutation
  ): Promise<{ success: boolean; data?: unknown; error?: string; status?: number }> {
    try {
      const response = await fetch('/api/mobile/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': mutation.operation_id,
        },
        body: JSON.stringify({
          operation_id: mutation.operation_id,
          entity_type: mutation.entity_type,
          entity_id: mutation.entity_id,
          action: mutation.action,
          payload: mutation.payload,
          branch_id: mutation.branch_id,
          business_id: mutation.business_id,
          client_timestamp: mutation.client_timestamp,
        }),
      });

      const data = await response.json().catch(() => null);

      if (response.ok) {
        return { success: true, data };
      }

      return {
        success: false,
        status: response.status,
        error: data?.error || `Server returned ${response.status}`,
      };
    } catch (networkErr: unknown) {
      return {
        success: false,
        error: networkErr instanceof Error ? networkErr.message : 'Network failure',
      };
    }
  }

  /**
   * Retries a specific failed or conflict mutation manually
   */
  public async retryMutation(operationId: string): Promise<void> {
    const item = this.queue.find((q) => q.operation_id === operationId);
    if (!item) return;

    item.status = 'pending';
    item.attempt_count = 0;
    item.last_error = undefined;
    await this.persistQueue();

    if (networkStatus.isOnline()) {
      this.processQueue();
    }
  }

  /**
   * Discards a specific mutation permanently
   */
  public async discardMutation(operationId: string): Promise<void> {
    this.queue = this.queue.filter((q) => q.operation_id !== operationId);
    await this.persistQueue();
  }

  /**
   * Clears all synced records
   */
  public async clearSynced(): Promise<void> {
    this.queue = this.queue.filter((q) => q.status !== 'synced');
    await this.persistQueue();
  }

  public getQueue(branchId?: string): QueuedMutation[] {
    if (!branchId) return [...this.queue];
    return this.queue.filter((q) => q.branch_id === branchId);
  }

  public hasPendingMutations(): boolean {
    return this.queue.some((q) => q.status === 'pending');
  }

  public getStats(): SyncEngineStats {
    let pending = 0;
    let syncing = 0;
    let synced = 0;
    let failed = 0;
    let conflict = 0;

    for (const item of this.queue) {
      switch (item.status) {
        case 'pending':
          pending++;
          break;
        case 'syncing':
          syncing++;
          break;
        case 'synced':
          synced++;
          break;
        case 'failed':
          failed++;
          break;
        case 'conflict':
          conflict++;
          break;
      }
    }

    return {
      pending_count: pending,
      syncing_count: syncing,
      synced_count: synced,
      failed_count: failed,
      conflict_count: conflict,
      last_synced_at: this.lastSyncedAt,
      is_syncing: this.isProcessing,
    };
  }

  public subscribe(listener: QueueListener): () => void {
    this.listeners.add(listener);
    listener(this.getStats());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const stats = this.getStats();
    for (const listener of this.listeners) {
      try {
        listener(stats);
      } catch (err) {
        console.error('[SyncQueue] Listener error:', err);
      }
    }
  }
}

export const syncQueue = new SyncQueueManager();
