/**
 * WSNexa Network Status Manager
 * Provides reliable, native-aware network state detection using @capacitor/network
 * with seamless web fallback.
 */

import { NetworkState } from './offline-types';

type NetworkListener = (state: NetworkState) => void;

class NetworkStatusManager {
  private currentState: NetworkState = {
    connected: typeof navigator !== 'undefined' ? navigator.onLine : true,
    connection_type: 'unknown',
    last_changed_at: new Date().toISOString(),
  };

  private listeners: Set<NetworkListener> = new Set();
  private initialized = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  public async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    try {
      const { Network } = await import('@capacitor/network');
      const status = await Network.getStatus();
      this.updateState({
        connected: status.connected,
        connection_type: (status.connectionType as NetworkState['connection_type']) || 'unknown',
        last_changed_at: new Date().toISOString(),
      });

      // Listen for native status changes
      await Network.addListener('networkStatusChange', (status) => {
        this.updateState({
          connected: status.connected,
          connection_type: (status.connectionType as NetworkState['connection_type']) || 'unknown',
          last_changed_at: new Date().toISOString(),
        });
      });
    } catch {
      // Web fallback
      if (typeof window !== 'undefined') {
        const updateWebStatus = () => {
          this.updateState({
            connected: navigator.onLine,
            connection_type: navigator.onLine ? 'wifi' : 'none',
            last_changed_at: new Date().toISOString(),
          });
        };

        window.addEventListener('online', updateWebStatus);
        window.addEventListener('offline', updateWebStatus);
      }
    }
  }

  private updateState(newState: NetworkState): void {
    const hasChanged = 
      this.currentState.connected !== newState.connected ||
      this.currentState.connection_type !== newState.connection_type;

    this.currentState = newState;

    if (hasChanged) {
      for (const listener of this.listeners) {
        try {
          listener(this.currentState);
        } catch (err) {
          console.error('[NetworkStatusManager] Listener error:', err);
        }
      }
    }
  }

  public getState(): NetworkState {
    return { ...this.currentState };
  }

  public isOnline(): boolean {
    return this.currentState.connected;
  }

  public isOffline(): boolean {
    return !this.currentState.connected;
  }

  public subscribe(listener: NetworkListener): () => void {
    this.listeners.add(listener);
    // Immediately emit current state
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * For testing & offline matrix validation: allows programmatic override of network state
   */
  public _overrideStateForTesting(connected: boolean, type: NetworkState['connection_type'] = 'unknown'): void {
    this.updateState({
      connected,
      connection_type: type,
      last_changed_at: new Date().toISOString(),
    });
  }
}

export const networkStatus = new NetworkStatusManager();
