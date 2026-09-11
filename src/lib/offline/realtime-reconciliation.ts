/**
 * WSNexa Realtime Recovery & State Reconciliation
 * Phase 38 Mobile Foundation
 */

import { networkStatus } from './network-status';
import { syncQueue } from './sync-queue';

type ReconciliationCallback = () => Promise<void> | void;

class RealtimeReconciliationManager {
  private reconcilers: Set<ReconciliationCallback> = new Set();
  private isReconciling = false;
  private initialized = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  public async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    // 1. Listen for network restoration
    networkStatus.subscribe((state) => {
      if (state.connected) {
        this.reconcile('network_restored');
      }
    });

    // 2. Listen for native Android app lifecycle (foregrounding)
    try {
      const { App } = await import('@capacitor/app');
      await App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          this.reconcile('app_foregrounded');
        }
      });
    } catch {
      // Browser visibilitychange fallback
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            this.reconcile('visibility_change');
          }
        });
      }
    }
  }

  /**
   * Registers a view or component data reconciler to refresh on reconnect
   */
  public registerReconciler(callback: ReconciliationCallback): () => void {
    this.reconcilers.add(callback);
    return () => {
      this.reconcilers.delete(callback);
    };
  }

  /**
   * Triggers the full reconciliation sequence:
   * 1. Flushes pending offline sync queue
   * 2. Executes all registered view reconcilers to fetch fresh authoritative state
   */
  public async reconcile(reason: string): Promise<void> {
    if (this.isReconciling) return;
    if (!networkStatus.isOnline()) return;

    this.isReconciling = true;
    console.log(`[RealtimeReconciliation] Starting reconciliation (reason: ${reason})`);

    try {
      // Step 1: Process queued offline mutations
      if (syncQueue.hasPendingMutations()) {
        await syncQueue.processQueue();
      }

      // Step 2: Execute view reconcilers in parallel
      const tasks = Array.from(this.reconcilers).map(async (fn) => {
        try {
          await fn();
        } catch (err) {
          console.warn('[RealtimeReconciliation] Reconciler error:', err);
        }
      });

      await Promise.all(tasks);
      console.log('[RealtimeReconciliation] Completed reconciliation successfully.');
    } catch (err) {
      console.error('[RealtimeReconciliation] Failed during reconciliation:', err);
    } finally {
      this.isReconciling = false;
    }
  }
}

export const realtimeReconciliation = new RealtimeReconciliationManager();
