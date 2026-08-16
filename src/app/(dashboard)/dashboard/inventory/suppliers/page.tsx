import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { PurchasingService } from '@/server/services/purchasing.service';
import { SupplierManagerClient } from '@/components/inventory/supplier-manager-client';

export const metadata: Metadata = {
  title: 'Suppliers & Vendors | WSNexa Inventory',
  description: 'Manage supplier directories, contact details, payment terms, and vendor price histories',
};

export default async function SuppliersPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard/inventory');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }

  if (!context || !context.user || !context.business) {
    redirect('/login');
  }

  const suppliers = await PurchasingService.getSuppliers();
  const currency = context.business.defaultCurrency || 'USD';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suppliers & Vendors"
        description="Maintain authorized vendor contacts, payment terms, purchasing catalogs, and historical cost comparisons"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Inventory', href: '/dashboard/inventory' },
          { label: 'Suppliers' },
        ]}
        helpSlug="supplier-management"
      />

      <SupplierManagerClient initialSuppliers={suppliers} currency={currency} />
    </div>
  );
}
