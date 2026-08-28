'use client';

import React from 'react';
import { HubSubNavigation, HubNavItem } from '@/components/layout/hub-sub-navigation';

interface CRMSubNavProps {
  canViewCustomers?: boolean;
  canViewReviews?: boolean;
  canViewReputation?: boolean;
  canViewLoyalty?: boolean;
  className?: string;
}

export function CRMSubNav({
  canViewCustomers = true,
  canViewReviews = false,
  canViewReputation = false,
  canViewLoyalty = false,
  className = '',
}: CRMSubNavProps) {
  const items: HubNavItem[] = [];

  if (canViewCustomers) {
    items.push({ id: 'directory', label: 'Customer Directory', href: '/dashboard/customers', icon: '👥', exact: true });
  }
  if (canViewReviews) {
    items.push({ id: 'reviews', label: 'Reviews', href: '/dashboard/reviews', icon: '⭐' });
  }
  if (canViewReputation) {
    items.push({ id: 'reputation', label: 'Reputation & Scores', href: '/dashboard/reputation', icon: '📊' });
  }
  if (canViewLoyalty) {
    items.push({ id: 'loyalty', label: 'Loyalty Program', href: '/dashboard/loyalty', icon: '🎁' });
  }

  return <HubSubNavigation items={items} className={className} />;
}
