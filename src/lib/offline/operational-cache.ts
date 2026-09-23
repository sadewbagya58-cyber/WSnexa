/**
 * WSNexa Local Operational Data Cache
 * Phase 38 Offline-First Resilience
 *
 * Provides type-safe, multi-tenant & branch-isolated persistence for:
 * - Branch Menu Catalog & Modifiers
 * - Dining Tables & Service Areas
 * - Active Kitchen Tickets Snapshot
 * - In-Progress Stock Count Sheets
 *
 * Backed by StorageAdapter (@capacitor/preferences on native / localStorage on web).
 */

import { StorageAdapter } from './storage-adapter';
import type { BranchMenuCatalog } from '@/server/services/menu-catalog.service';

const CACHE_PREFIX = 'wsnexa_op_cache_v1';

export interface CachedTableLayout {
  tables: Array<{
    id: string;
    name: string;
    tableNumber: number | null;
    serviceAreaId: string;
    status?: string;
  }>;
  areas: Array<{
    id: string;
    name: string;
  }>;
  cachedAt: string;
}

export interface CachedCatalogRecord {
  catalog: BranchMenuCatalog;
  cachedAt: string;
}

export class OperationalCacheManager {
  private getStorageKey(businessId: string, branchId: string, entity: string): string {
    const biz = businessId || 'default_biz';
    const br = branchId || 'default_branch';
    return `${CACHE_PREFIX}:${biz}:${br}:${entity}`;
  }

  /**
   * Caches active branch menu catalog
   */
  public async saveBranchCatalog(
    businessId: string,
    branchId: string,
    catalog: BranchMenuCatalog
  ): Promise<void> {
    if (!businessId || !branchId || !catalog) return;
    try {
      const key = this.getStorageKey(businessId, branchId, 'catalog');
      const record: CachedCatalogRecord = {
        catalog,
        cachedAt: new Date().toISOString(),
      };
      await StorageAdapter.setItem(key, JSON.stringify(record));
    } catch (err) {
      console.warn('[OperationalCache] Failed to save catalog cache:', err);
    }
  }

  /**
   * Retrieves cached branch menu catalog
   */
  public async getBranchCatalog(
    businessId: string,
    branchId: string
  ): Promise<BranchMenuCatalog | null> {
    if (!businessId || !branchId) return null;
    try {
      const key = this.getStorageKey(businessId, branchId, 'catalog');
      const raw = await StorageAdapter.getItem(key);
      if (!raw) return null;
      const record = JSON.parse(raw) as CachedCatalogRecord;
      return record.catalog || null;
    } catch (err) {
      console.warn('[OperationalCache] Failed to parse catalog cache:', err);
      return null;
    }
  }

  /**
   * Caches active branch dining tables and service areas layout
   */
  public async saveBranchTables(
    businessId: string,
    branchId: string,
    tables: CachedTableLayout['tables'],
    areas: CachedTableLayout['areas']
  ): Promise<void> {
    if (!businessId || !branchId) return;
    try {
      const key = this.getStorageKey(businessId, branchId, 'tables');
      const record: CachedTableLayout = {
        tables: tables || [],
        areas: areas || [],
        cachedAt: new Date().toISOString(),
      };
      await StorageAdapter.setItem(key, JSON.stringify(record));
    } catch (err) {
      console.warn('[OperationalCache] Failed to save tables cache:', err);
    }
  }

  /**
   * Retrieves cached branch dining tables and service areas layout
   */
  public async getBranchTables(
    businessId: string,
    branchId: string
  ): Promise<CachedTableLayout | null> {
    if (!businessId || !branchId) return null;
    try {
      const key = this.getStorageKey(businessId, branchId, 'tables');
      const raw = await StorageAdapter.getItem(key);
      if (!raw) return null;
      return (JSON.parse(raw) as CachedTableLayout) || null;
    } catch (err) {
      console.warn('[OperationalCache] Failed to parse tables cache:', err);
      return null;
    }
  }

  /**
   * Caches active kitchen tickets snapshot
   */
  public async saveKitchenTickets(
    businessId: string,
    branchId: string,
    tickets: unknown[]
  ): Promise<void> {
    if (!businessId || !branchId) return;
    try {
      const key = this.getStorageKey(businessId, branchId, 'kitchen_tickets');
      await StorageAdapter.setItem(key, JSON.stringify(tickets || []));
    } catch (err) {
      console.warn('[OperationalCache] Failed to save kitchen tickets cache:', err);
    }
  }

  /**
   * Retrieves cached kitchen tickets snapshot
   */
  public async getKitchenTickets(
    businessId: string,
    branchId: string
  ): Promise<unknown[] | null> {
    if (!businessId || !branchId) return null;
    try {
      const key = this.getStorageKey(businessId, branchId, 'kitchen_tickets');
      const raw = await StorageAdapter.getItem(key);
      if (!raw) return null;
      return (JSON.parse(raw) as unknown[]) || null;
    } catch (err) {
      console.warn('[OperationalCache] Failed to parse kitchen tickets cache:', err);
      return null;
    }
  }

  /**
   * Caches active operational orders / tickets snapshot
   */
  public async saveActiveTickets(
    businessId: string,
    branchId: string,
    tickets: unknown[]
  ): Promise<void> {
    return this.saveKitchenTickets(businessId, branchId, tickets);
  }

  /**
   * Retrieves cached operational orders / tickets snapshot
   */
  public async getActiveTickets(
    businessId: string,
    branchId: string
  ): Promise<unknown[] | null> {
    return this.getKitchenTickets(businessId, branchId);
  }

  /**
   * Clears operational cache for a specific branch (e.g. on branch switch)
   */
  public async clearBranchOperationalData(businessId: string, branchId: string): Promise<void> {
    try {
      const prefix = `${CACHE_PREFIX}:${businessId}:${branchId}`;
      await StorageAdapter.clear(prefix);
    } catch (err) {
      console.warn('[OperationalCache] Failed to clear branch cache:', err);
    }
  }

  /**
   * Clears all cached operational data
   */
  public async clearAllOperationalData(): Promise<void> {
    try {
      await StorageAdapter.clear(CACHE_PREFIX);
    } catch (err) {
      console.warn('[OperationalCache] Failed to clear all cache:', err);
    }
  }
}

export const operationalCache = new OperationalCacheManager();
