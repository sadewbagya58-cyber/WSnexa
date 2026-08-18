import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { PermissionService } from '@/server/services/permission.service';
import { InventoryService } from '@/server/services/inventory.service';

export const metadata: Metadata = {
  title: 'Waste Tracking | WSNexa Inventory',
  description: 'Log and analyze kitchen and bar food waste, spoilage, and preparation trimmings',
};

export default async function InventoryWastePage() {
  const { allowed, context } = await requireRoutePermission('/dashboard/inventory/waste');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }

  if (!context || !context.user || !context.activeBranch) {
    redirect('/login');
  }

  const hasCostPermission = await PermissionService.hasPermission(
    context.user.id,
    context.business.id,
    context.activeBranch.id,
    'inventory.costs.view'
  );

  const wasteRecords = await InventoryService.getWasteRecords(context.business.id, context.activeBranch.id, {
    hasCostPermission,
    limit: 100,
  });

  const formatCurrency = (cents: number | null, currency: string) => {
    if (cents === null) return '—';
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currency || 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(cents / 100);
    } catch {
      return `${currency} ${(cents / 100).toFixed(2)}`;
    }
  };

  const formatReason = (reason: string) => {
    switch (reason) {
      case 'spoiled': return 'Spoiled / Rotten';
      case 'expired': return 'Expired';
      case 'prep_waste': return 'Prep Trimming';
      case 'overcooked': return 'Overcooked / Burnt';
      case 'dropped': return 'Dropped on Floor';
      case 'customer_return': return 'Customer Return';
      case 'staff_meal': return 'Staff Meal';
      case 'damaged': return 'Packaging Damaged';
      default: return reason;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Waste & Spoilage Log"
        description={`Record and review kitchen & bar waste for ${context.activeBranch.name}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Inventory Hub', href: '/dashboard/inventory' },
          { label: 'Waste Tracking' },
        ]}
        helpSlug="recording-stock-adjustments-and-waste"
      />

      {wasteRecords.length === 0 ? (
        <div className="bg-white border border-dashed border-zinc-200 rounded-2xl p-10 text-center shadow-xs">
          <span className="text-3xl">🗑️</span>
          <h3 className="text-sm font-bold text-zinc-900 mt-2">Zero waste logged</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1">
            No food or beverage waste records logged for this branch yet. You can log waste directly from any item row.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Mobile Waste Cards View */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {wasteRecords.map((w) => (
              <div
                key={w.id}
                className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-zinc-950 text-sm block truncate">{w.itemName}</span>
                    <span className="text-[11px] text-zinc-500 font-medium mt-0.5 block">📍 {w.locationName}</span>
                  </div>

                  <div className="shrink-0">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
                      {formatReason(w.reason)}
                    </span>
                  </div>
                </div>

                <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-100 space-y-2 text-xs">
                  <div className="flex justify-between items-baseline">
                    <span className="text-zinc-500 text-[11px] font-medium">Quantity Wasted:</span>
                    <span className="font-black text-rose-600 text-sm">
                      -{w.quantity} {w.unit}
                    </span>
                  </div>

                  {hasCostPermission && (
                    <div className="flex justify-between items-center text-[11px] border-t border-zinc-200/50 pt-1.5">
                      <span className="text-zinc-500">Estimated Financial Loss:</span>
                      <span className="font-mono font-bold text-zinc-950">
                        {w.totalCostCents !== null ? formatCurrency(w.totalCostCents, w.currency) : '—'}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-[11px] text-zinc-400 border-t border-zinc-200/50 pt-1.5 font-mono">
                    <span>Logged At:</span>
                    <span>
                      {new Date(w.createdAt).toLocaleDateString()} {new Date(w.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {w.notes && (
                    <div className="border-t border-zinc-200/50 pt-1.5 text-[11px] text-zinc-600 italic">
                      &quot;{w.notes}&quot;
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase tracking-wider font-bold">
                  <tr>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Item & Location</th>
                    <th className="py-3 px-4">Wasted Qty</th>
                    <th className="py-3 px-4">Reason</th>
                    {hasCostPermission && <th className="py-3 px-4">Estimated Loss</th>}
                    <th className="py-3 px-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-medium">
                  {wasteRecords.map((w) => (
                    <tr key={w.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="py-3.5 px-4 text-zinc-500">
                        <div>{new Date(w.createdAt).toLocaleDateString()}</div>
                        <div className="text-[10px] text-zinc-400">
                          {new Date(w.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-zinc-950">{w.itemName}</div>
                        <div className="text-[11px] text-zinc-400">{w.locationName}</div>
                      </td>

                      <td className="py-3.5 px-4 font-black text-rose-600">
                        -{w.quantity} {w.unit}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          {formatReason(w.reason)}
                        </span>
                      </td>

                      {hasCostPermission && (
                        <td className="py-3.5 px-4 font-bold text-zinc-900">
                          {w.totalCostCents !== null ? formatCurrency(w.totalCostCents, w.currency) : '—'}
                        </td>
                      )}

                      <td className="py-3.5 px-4 text-zinc-500 text-[11px] italic">
                        {w.notes || '—'}
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
