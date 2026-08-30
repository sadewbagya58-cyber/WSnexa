'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const CORE_DASHBOARD_ROUTES = [
  '/dashboard',
  '/dashboard/menu',
  '/dashboard/menu/categories',
  '/dashboard/menu/items',
  '/dashboard/waiter',
  '/dashboard/kitchen',
  '/dashboard/cashier',
  '/dashboard/inventory',
  '/dashboard/inventory/items',
  '/dashboard/inventory/recipes',
  '/dashboard/inventory/purchasing',
  '/dashboard/reservations',
  '/dashboard/reports',
  '/dashboard/tables',
  '/dashboard/tables/areas',
  '/dashboard/tables/new',
  '/dashboard/tables/bulk',
  '/dashboard/business',
  '/dashboard/branches',
  '/dashboard/team',
  '/dashboard/settings',
  '/dashboard/settings/subscription',
  '/dashboard/organization',
  '/dashboard/organization/structure',
  '/dashboard/organization/positions',
  '/dashboard/organization/job-titles',
  '/dashboard/organization/chart',
  '/dashboard/people',
  '/dashboard/people/acting',
  '/dashboard/people/secondments',
  '/dashboard/people/integrity',
];

export const RoutePrefetcher: React.FC = () => {
  const router = useRouter();

  useEffect(() => {
    const prefetchRoutes = () => {
      CORE_DASHBOARD_ROUTES.forEach((route) => {
        try {
          router.prefetch(route);
        } catch {
          // Ignore prefetch failures in unsupported environments
        }
      });
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(prefetchRoutes, { timeout: 2000 });
    } else {
      const timer = setTimeout(prefetchRoutes, 1000);
      return () => clearTimeout(timer);
    }
  }, [router]);

  return null;
};
