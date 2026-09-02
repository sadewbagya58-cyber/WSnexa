import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { InventoryService } from '@/server/services/inventory.service';
import { can, resolveAuthorizationContext } from '@/server/auth';
import { InventorySubNav } from '@/components/inventory/inventory-subnav';
import { resolveInventorySubNavPermissions } from '@/server/inventory/inventory-nav-permissions';

export const metadata: Metadata = {
  title: 'Stock Counts | WSNexa Inventory',
  description: 'Conduct physical inventory audits and reconcile stock variances',
};

export default async function StockCountsPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard/inventory/counts');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role, context?.membership?.customRoleId)} />;
  }

  if (!context || !context.user || !context.activeBranch) {
    redirect('/login');
  }

  let hasCostPermission = false;
  let canManageCounts = false;
  let navPermissions: Awaited<ReturnType<typeof resolveInventorySubNavPermissions>> = {
    canViewInventory: false,
    canViewItems: false,
    canViewCounts: false,
    canViewRecipes: false,
    canViewPurchasing: false,
    canViewReceiving: false,
    canViewTransfers: false,
    canViewSuppliers: false,
    canViewLocations: false,
    canViewWaste: false,
    canViewSettings: false,
  };

  try {
    const authContext = await resolveAuthorizationContext();
    const branchResource = {
      resourceType: 'branch' as const,
      resourceId: context.activeBranch.id,
      businessId: context.business.id,
      branchId: context.activeBranch.id,
      departmentId: null,
      organizationUnitId: null,
      serviceAreaId: null,
      ownerUserId: null,
    };
    hasCostPermission = await can({ context: authContext, permission: 'inventory.costs.view', resource: branchResource });
    const hasCountsManage = await can({ context: authContext, permission: 'inventory.counts.manage', resource: branchResource });
    const hasManage = await can({ context: authContext, permission: 'inventory.manage', resource: branchResource });
    canManageCounts = hasCountsManage || hasManage || authContext.isBusinessOwner;

    navPermissions = await resolveInventorySubNavPermissions(
      authContext,
      context.activeBranch.id,
      context.business.id
    );
  } catch {
    hasCostPermission = false;
    canManageCounts = false;
  }

  const counts = await InventoryService.getStockCounts(
    context.business.id,
    context.activeBranch.id,
    hasCostPermission
  );

  return (
    <div className="space-y-6 max-w-full">
      <PageHeader
        title="Physical Stock Counts"
        description={`Audit count sheets and variance reconciliations for ${context.activeBranch.name}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Inventory Hub', href: '/dashboard/inventory' },
          { label: 'Stock Counts' },
        ]}
        helpSlug="performing-physical-stock-counts"
        primaryAction={
          canManageCounts ? (
            <Link
              href="/dashboard/inventory/counts/new"
              className="flex min-h-[44px] items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-zinc-950 rounded-xl hover:bg-zinc-800 transition-colors shadow-xs"
            >
              + Start New Count
            </Link>
          ) : undefined
        }
      />

      <InventorySubNav {...navPermissions} />

      {counts.length === 0 ? (
        <div className="bg-white border border-dashed border-zinc-200 rounded-2xl p-10 text-center shadow-xs">
          <span className="text-3xl">📋</span>
          <h3 className="text-sm font-bold text-zinc-900 mt-2">No physical stock counts performed yet</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1">
            Start a stock count audit sheet to compare physical counts on shelves against expected system stock.
          </p>
          {canManageCounts && (
            <div className="mt-4">
              <Link href="/dashboard/inventory/counts/new">
                <Button size="sm" className="font-bold text-xs">
                  Start Physical Count
                </Button>
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Mobile Stock Count Cards View (< 768px) */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {counts.map((c) => {
              const formattedDate = c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '';
              return (
                <div
                  key={c.id}
                  className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-xs space-y-3"
                >
                  {/* Header: Title & Status Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/dashboard/inventory/counts/${c.id}`}
                        className="font-bold text-zinc-950 hover:underline text-sm block break-words"
                      >
                        {c.title}
                      </Link>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="text-[11px] font-mono font-bold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-md">
                          {c.countNumber}
                        </span>
                        {formattedDate && (
                          <span className="text-[11px] text-zinc-400 font-medium">
                            • {formattedDate}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase whitespace-nowrap ${
                          c.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : c.status === 'submitted'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>
                  </div>

                  {/* Details Card */}
                  <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-100 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-zinc-500 font-medium">Storage Location:</span>
                      <span className="font-bold text-zinc-900 truncate max-w-[60%] text-right">📍 {c.locationName}</span>
                    </div>

                    <div className="flex justify-between items-center text-[11px] border-t border-zinc-200/50 pt-1.5">
                      <span className="text-zinc-500 font-medium">Category Scope:</span>
                      <span className="font-semibold text-zinc-700 truncate max-w-[60%] text-right">{c.categoryName}</span>
                    </div>

                    <div className="flex justify-between items-center text-[11px] border-t border-zinc-200/50 pt-1.5">
                      <span className="text-zinc-500 font-medium">Items Counted:</span>
                      <span className="font-bold text-zinc-900">{c.totalItemsCounted} items</span>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="pt-1">
                    <Link href={`/dashboard/inventory/counts/${c.id}`} className="block">
                      <Button
                        size="sm"
                        variant={c.status === 'counting' ? 'primary' : 'outline'}
                        className={`w-full text-xs font-bold min-h-[44px] cursor-pointer ${
                          c.status === 'counting' ? 'bg-zinc-950 text-white hover:bg-zinc-800' : 'hover:bg-zinc-50'
                        }`}
                      >
                        {c.status === 'counting' ? 'Continue Count →' : 'View Audit Details →'}
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View (>= 768px) */}
          <div className="hidden md:block bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase tracking-wider font-bold">
                  <tr>
                    <th className="py-3 px-4">Count Sheet</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Category Scope</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Items Counted</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-medium">
                  {counts.map((c) => (
                    <tr key={c.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="py-3.5 px-4">
                        <Link
                          href={`/dashboard/inventory/counts/${c.id}`}
                          className="font-bold text-zinc-950 hover:underline block"
                        >
                          {c.title}
                        </Link>
                        <span className="text-[11px] font-mono text-zinc-400">{c.countNumber}</span>
                      </td>

                      <td className="py-3.5 px-4 text-zinc-700 font-medium">{c.locationName}</td>
                      <td className="py-3.5 px-4 text-zinc-500">{c.categoryName}</td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                            c.status === 'approved'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : c.status === 'submitted'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-bold text-zinc-800">{c.totalItemsCounted} items</td>

                      <td className="py-3.5 px-4 text-right">
                        <Link href={`/dashboard/inventory/counts/${c.id}`}>
                          <Button size="sm" variant="outline" className="text-xs font-bold h-7 cursor-pointer">
                            {c.status === 'counting' ? 'Continue Count →' : 'View Audit →'}
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
