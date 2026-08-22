import React from 'react';
import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { PurchasingService } from '@/server/services/purchasing.service';
import { createAdminClient } from '@/lib/supabase/server';
import { SupplierDetailClient } from '@/components/inventory/supplier-detail-client';
import { can, resolveAuthorizationContext } from '@/server/auth';

interface SupplierDetailPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: 'Supplier Details & Catalog | WSNexa Inventory',
  description: 'Manage supplier information, contact details, payment terms, and linked purchasing catalog',
};

export default async function SupplierDetailPage({ params }: SupplierDetailPageProps) {
  const { id } = await params;
  const { allowed, context } = await requireRoutePermission('/dashboard/inventory');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }

  if (!context || !context.user || !context.business || !context.activeBranch) {
    redirect('/login');
  }

  let hasCostPermission = false;
  try {
    const authContext = await resolveAuthorizationContext();
    hasCostPermission = await can({ context: authContext, permission: 'inventory.costs.view' });
  } catch {
    hasCostPermission = false;
  }

  const supplier = await PurchasingService.getSupplierById(context.business.id, id, {
    hasCostPermission,
  });

  if (!supplier) {
    notFound();
  }

  const admin = createAdminClient();
  const { data: rawItems } = await admin
    .from('inventory_items')
    .select('id, name, base_unit, cost_per_unit_cents')
    .eq('business_id', context.business.id)
    .eq('is_active', true)
    .order('name', { ascending: true });

  const availableItems = (rawItems || []).map((i) => ({
    id: i.id,
    name: i.name,
    baseUnit: i.base_unit,
    costPerUnitCents: i.cost_per_unit_cents || 0,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={supplier.name}
        description={`Vendor profile, agreed purchasing terms, and linked ingredient catalog`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Inventory', href: '/dashboard/inventory' },
          { label: 'Suppliers', href: '/dashboard/inventory/suppliers' },
          { label: supplier.name },
        ]}
        helpSlug="supplier-management"
      />

      <SupplierDetailClient
        supplier={supplier}
        availableItems={availableItems}
        hasCostPermission={hasCostPermission}
      />
    </div>
  );
}
