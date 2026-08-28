'use client';

import React from 'react';
import { HubSubNavigation, HubNavItem } from '@/components/layout/hub-sub-navigation';

interface InventorySubNavProps {
  canViewInventory?: boolean;
  canViewItems?: boolean;
  canViewCounts?: boolean;
  canViewRecipes?: boolean;
  canViewPurchasing?: boolean;
  canViewLocations?: boolean;
  canViewSuppliers?: boolean;
  canViewReceiving?: boolean;
  canViewTransfers?: boolean;
  canViewWaste?: boolean;
  canViewSettings?: boolean;
  className?: string;
}

export function InventorySubNav({
  canViewInventory = false,
  canViewItems = false,
  canViewCounts = false,
  canViewRecipes = false,
  canViewPurchasing = false,
  canViewLocations = false,
  canViewSuppliers = false,
  canViewReceiving = false,
  canViewTransfers = false,
  canViewWaste = false,
  canViewSettings = false,
  className = '',
}: InventorySubNavProps) {
  const items: HubNavItem[] = [];

  if (canViewInventory) {
    items.push({ id: 'overview', label: 'Operations Hub', href: '/dashboard/inventory', icon: '📊', exact: true });
  }
  if (canViewItems) {
    items.push({ id: 'items', label: 'Stock Items', href: '/dashboard/inventory/items', icon: '🥦' });
  }
  if (canViewCounts) {
    items.push({ id: 'counts', label: 'Physical Counts', href: '/dashboard/inventory/counts', icon: '📋' });
  }
  if (canViewRecipes) {
    items.push({ id: 'recipes', label: 'Recipes & BOM', href: '/dashboard/inventory/recipes', icon: '🍽️' });
  }
  if (canViewPurchasing) {
    items.push({ id: 'purchasing', label: 'Purchasing (PO)', href: '/dashboard/inventory/purchasing', icon: '📦' });
  }
  if (canViewReceiving) {
    items.push({ id: 'receiving', label: 'Receiving', href: '/dashboard/inventory/receiving', icon: '📥' });
  }
  if (canViewTransfers) {
    items.push({ id: 'transfers', label: 'Stock Transfers', href: '/dashboard/inventory/transfers', icon: '🚚' });
  }
  if (canViewSuppliers) {
    items.push({ id: 'suppliers', label: 'Suppliers', href: '/dashboard/inventory/suppliers', icon: '🏢' });
  }
  if (canViewLocations) {
    items.push({ id: 'locations', label: 'Storage Locations', href: '/dashboard/inventory/locations', icon: '📍' });
  }
  if (canViewWaste) {
    items.push({ id: 'waste', label: 'Waste Log', href: '/dashboard/inventory/waste', icon: '🗑️' });
  }
  if (canViewSettings) {
    items.push({ id: 'settings', label: 'Policies & Setup', href: '/dashboard/inventory/settings', icon: '⚙️' });
  }

  return <HubSubNavigation items={items} className={className} />;
}
