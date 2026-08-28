'use client';

import React from 'react';
import { HubSubNavigation, HubNavItem } from '@/components/layout/hub-sub-navigation';

interface SettingsSubNavProps {
  canViewBusiness?: boolean;
  canViewVenueProfile?: boolean;
  canViewBranches?: boolean;
  canViewOrderSecurity?: boolean;
  canViewPayments?: boolean;
  canManageInventorySettings?: boolean;
  canViewSubscription?: boolean;
  className?: string;
}

export function SettingsSubNav({
  canViewBusiness = true,
  canViewVenueProfile = true,
  canViewBranches = true,
  canViewOrderSecurity = true,
  canViewPayments = true,
  canManageInventorySettings = true,
  canViewSubscription = false,
  className = '',
}: SettingsSubNavProps) {
  const items: HubNavItem[] = [
    { id: 'settings-hub', label: 'Settings Hub', href: '/dashboard/settings', icon: '⚙️', exact: true },
  ];

  if (canViewBusiness) {
    items.push({ id: 'business', label: 'Business Profile', href: '/dashboard/business', icon: '🏢' });
  }
  if (canViewVenueProfile) {
    items.push({ id: 'venue-profile', label: 'Venue Profile', href: '/dashboard/venue-profile', icon: '🏬' });
  }
  if (canViewBranches) {
    items.push({ id: 'branches', label: 'Branches', href: '/dashboard/branches', icon: '📍' });
  }
  if (canViewOrderSecurity) {
    items.push({ id: 'order-security', label: 'Order Security', href: '/dashboard/settings/order-security', icon: '🛡️' });
  }
  if (canViewPayments) {
    items.push({ id: 'payments', label: 'Payment Methods', href: '/dashboard/settings/payments', icon: '💳' });
  }
  if (canManageInventorySettings) {
    items.push({ id: 'inventory-settings', label: 'Inventory Policies', href: '/dashboard/inventory/settings', icon: '📦' });
  }
  if (canViewSubscription) {
    items.push({ id: 'subscription', label: 'Billing & Plans', href: '/dashboard/settings/subscription', icon: '💎' });
  }

  return <HubSubNavigation items={items} className={className} />;
}
