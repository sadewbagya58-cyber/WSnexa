/**
 * WSNexa Storage Adapter
 * Abstracts persistent key-value storage across Native Android (@capacitor/preferences),
 * Web (localStorage), and Server/Node (in-memory).
 */

let isNativeCapacitor: boolean | null = null;

async function checkIsNative(): Promise<boolean> {
  if (isNativeCapacitor !== null) return isNativeCapacitor;
  try {
    const { Capacitor } = await import('@capacitor/core');
    isNativeCapacitor = Capacitor.isNativePlatform();
  } catch {
    isNativeCapacitor = false;
  }
  return isNativeCapacitor;
}

// In-memory fallback for SSR or environments without localStorage
const memoryStore = new Map<string, string>();

export class StorageAdapter {
  /**
   * Retrieves an item by key
   */
  static async getItem(key: string): Promise<string | null> {
    const isNative = await checkIsNative();
    if (isNative) {
      try {
        const { Preferences } = await import('@capacitor/preferences');
        const { value } = await Preferences.get({ key });
        return value;
      } catch (err) {
        console.warn(`[StorageAdapter] Native getItem failed for ${key}, falling back:`, err);
      }
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        return window.localStorage.getItem(key);
      } catch (err) {
        console.warn(`[StorageAdapter] localStorage getItem failed for ${key}:`, err);
      }
    }

    return memoryStore.get(key) ?? null;
  }

  /**
   * Stores an item by key
   */
  static async setItem(key: string, value: string): Promise<void> {
    const isNative = await checkIsNative();
    if (isNative) {
      try {
        const { Preferences } = await import('@capacitor/preferences');
        await Preferences.set({ key, value });
        return;
      } catch (err) {
        console.warn(`[StorageAdapter] Native setItem failed for ${key}, falling back:`, err);
      }
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(key, value);
        return;
      } catch (err) {
        console.warn(`[StorageAdapter] localStorage setItem failed for ${key}:`, err);
      }
    }

    memoryStore.set(key, value);
  }

  /**
   * Removes an item by key
   */
  static async removeItem(key: string): Promise<void> {
    const isNative = await checkIsNative();
    if (isNative) {
      try {
        const { Preferences } = await import('@capacitor/preferences');
        await Preferences.remove({ key });
        return;
      } catch (err) {
        console.warn(`[StorageAdapter] Native removeItem failed for ${key}, falling back:`, err);
      }
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(key);
        return;
      } catch (err) {
        console.warn(`[StorageAdapter] localStorage removeItem failed for ${key}:`, err);
      }
    }

    memoryStore.delete(key);
  }

  /**
   * Clears all items matching an optional prefix (or all items if prefix omitted)
   */
  static async clear(prefix?: string): Promise<void> {
    const isNative = await checkIsNative();
    if (isNative) {
      try {
        const { Preferences } = await import('@capacitor/preferences');
        if (!prefix) {
          await Preferences.clear();
          return;
        }
        const { keys } = await Preferences.keys();
        for (const k of keys) {
          if (k.startsWith(prefix)) {
            await Preferences.remove({ key: k });
          }
        }
        return;
      } catch (err) {
        console.warn(`[StorageAdapter] Native clear failed, falling back:`, err);
      }
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        if (!prefix) {
          window.localStorage.clear();
          return;
        }
        const keysToRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k && k.startsWith(prefix)) {
            keysToRemove.push(k);
          }
        }
        for (const k of keysToRemove) {
          window.localStorage.removeItem(k);
        }
        return;
      } catch (err) {
        console.warn(`[StorageAdapter] localStorage clear failed:`, err);
      }
    }

    if (!prefix) {
      memoryStore.clear();
    } else {
      for (const k of Array.from(memoryStore.keys())) {
        if (k.startsWith(prefix)) {
          memoryStore.delete(k);
        }
      }
    }
  }

  /**
   * Retrieves all keys stored
   */
  static async getKeys(prefix?: string): Promise<string[]> {
    const isNative = await checkIsNative();
    if (isNative) {
      try {
        const { Preferences } = await import('@capacitor/preferences');
        const { keys } = await Preferences.keys();
        return prefix ? keys.filter((k) => k.startsWith(prefix)) : keys;
      } catch (err) {
        console.warn(`[StorageAdapter] Native keys failed, falling back:`, err);
      }
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const keys: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k && (!prefix || k.startsWith(prefix))) {
            keys.push(k);
          }
        }
        return keys;
      } catch (err) {
        console.warn(`[StorageAdapter] localStorage keys failed:`, err);
      }
    }

    const keys = Array.from(memoryStore.keys());
    return prefix ? keys.filter((k) => k.startsWith(prefix)) : keys;
  }
}
