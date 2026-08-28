import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { InventoryService } from '@/server/services/inventory.service';
import { sendStockTransferAction, receiveStockTransferAction } from '@/server/actions/inventory';
import { can, resolveAuthorizationContext } from '@/server/auth';
import { InventorySubNav } from '@/components/inventory/inventory-subnav';

export const metadata: Metadata = {
  title: 'Stock Transfers | WSNexa Inventory',
  description: 'Manage internal and cross-branch inventory transfers and receipts',
};

export default async function StockTransfersPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard/inventory/transfers');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }

  if (!context || !context.user || !context.activeBranch) {
    redirect('/login');
  }

  let canManageTransfers = false;
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
    const hasPerm =
      (await can({ context: authContext, permission: 'inventory.transfers.manage', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'inventory.manage', resource: branchResource }));
    canManageTransfers = hasPerm || authContext.isBusinessOwner;
  } catch {
    canManageTransfers = false;
  }

  const activeBranchId = context.activeBranch.id;
  const branchName = context.activeBranch.name;
  const transfers = await InventoryService.getStockTransfers(
    context.business.id,
    activeBranchId
  );

  const incomingInTransit = transfers.filter(
    (t) => t.destinationBranchId === activeBranchId && t.status === 'in_transit'
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Transfers"
        description={`Internal location transfers and cross-branch dispatches for ${context.activeBranch.name}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Inventory Hub', href: '/dashboard/inventory' },
          { label: 'Stock Transfers' },
        ]}
        helpSlug="managing-stock-transfers"
        primaryAction={
          canManageTransfers
            ? {
                label: '+ New Transfer',
                href: '/dashboard/inventory/transfers/new',
              }
            : undefined
        }
      />

      <InventorySubNav />

      {/* Transfer Lifecycle Flow Guide */}
      <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-4 text-xs text-zinc-600">
        <span className="font-bold text-zinc-900 block mb-1">Transfer Lifecycle:</span>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="bg-white border border-zinc-200 px-2.5 py-1 rounded-lg font-semibold text-zinc-700">
            1. Create Draft
          </span>
          <span className="text-zinc-400">→</span>
          <span className="bg-white border border-zinc-200 px-2.5 py-1 rounded-lg font-semibold text-zinc-700">
            2. Dispatch Transfer <span className="text-zinc-400">(Source stock deducted)</span>
          </span>
          <span className="text-zinc-400">→</span>
          <span className="bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg font-semibold text-amber-800">
            3. In Transit 🚚
          </span>
          <span className="text-zinc-400">→</span>
          <span className="bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg font-semibold text-emerald-800">
            4. Receive Stock <span className="text-emerald-600">(Destination stock updated)</span>
          </span>
        </div>
      </div>

      {/* Incoming In-Transit Transfers (Actionable Alert Section for Destination Branch) */}
      {incomingInTransit.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🚚</span>
              <div>
                <h2 className="text-sm font-bold text-amber-950">
                  Incoming Transfers Awaiting Receipt ({incomingInTransit.length})
                </h2>
                <p className="text-xs text-amber-800">
                  Stock has been dispatched and is currently in transit. Click &ldquo;Receive Stock&rdquo; to accept items into {context.activeBranch.name} inventory.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {incomingInTransit.map((t) => (
              <div
                key={t.id}
                className="bg-white border border-amber-200 rounded-xl p-4 flex flex-col justify-between gap-3 shadow-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-zinc-950">{t.transferNumber}</span>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                      In Transit
                    </span>
                  </div>
                  <p className="text-xs text-zinc-700">
                    From <strong className="text-zinc-950">{t.sourceBranchName}</strong> ({t.sourceLocationName}) →{' '}
                    <strong className="text-zinc-950">{t.destinationLocationName}</strong>
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    Dispatched: {t.sentAt ? new Date(t.sentAt).toLocaleString() : 'Recently'}
                  </p>
                </div>

                <form
                  action={async () => {
                    'use server';
                    await receiveStockTransferAction({ transferId: t.id });
                  }}
                >
                  <Button
                    size="sm"
                    type="submit"
                    className="w-full text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white min-h-[38px] shadow-xs"
                  >
                    Receive Stock into {t.destinationLocationName}
                  </Button>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Transfers Table */}
      {transfers.length === 0 ? (
        <div className="bg-white border border-dashed border-zinc-200 rounded-2xl p-10 text-center shadow-xs">
          <span className="text-3xl">🚚</span>
          <h3 className="text-sm font-bold text-zinc-900 mt-2">No stock transfers found</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1">
            Transfer stock between storage areas (e.g. Main Store → Main Kitchen) or across authorized branches.
          </p>
          {canManageTransfers && (
            <div className="mt-4">
              <Link href="/dashboard/inventory/transfers/new">
                <Button size="sm" className="font-bold text-xs">
                  Create Stock Transfer
                </Button>
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Mobile Transfers Cards View */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {transfers.map((t) => {
              const isDestination = t.destinationBranchId === activeBranchId;
              const isSource = t.sourceBranchId === activeBranchId;

              return (
                <div
                  key={t.id}
                  className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono font-bold text-zinc-950 text-sm block">{t.transferNumber}</span>
                      <span className="text-[11px] text-zinc-400 font-mono mt-0.5 block">
                        {new Date(t.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="shrink-0">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase whitespace-nowrap ${
                          t.status === 'received'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : t.status === 'in_transit'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : t.status === 'sent'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-zinc-100 text-zinc-700 border border-zinc-200'
                        }`}
                      >
                        {t.status === 'in_transit' ? 'In Transit 🚚' : t.status === 'received' ? 'Received ✓' : t.status}
                      </span>
                    </div>
                  </div>

                  <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-100 space-y-2 text-xs">
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-zinc-500 font-medium">Source:</span>
                        <div className="text-right">
                          <span className="font-bold text-zinc-900">{t.sourceBranchName}</span>
                          <span className="text-zinc-400 block text-[10px]">{t.sourceLocationName}</span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-[11px] border-t border-zinc-200/50 pt-1.5">
                        <span className="text-zinc-500 font-medium">Destination:</span>
                        <div className="text-right">
                          <span className="font-bold text-zinc-900">{t.destinationBranchName}</span>
                          <span className="text-zinc-400 block text-[10px]">{t.destinationLocationName}</span>
                        </div>
                      </div>
                    </div>

                    {t.status === 'in_transit' && !isDestination && (
                      <div className="border-t border-zinc-200/50 pt-1.5 text-[11px] text-zinc-500">
                        Awaiting receipt at {t.destinationBranchName}
                      </div>
                    )}
                    {t.status === 'in_transit' && isDestination && (
                      <div className="border-t border-zinc-200/50 pt-1.5 text-[11px] font-semibold text-amber-700">
                        Ready to receive into {t.destinationLocationName}
                      </div>
                    )}
                  </div>

                  {/* Mobile Actions */}
                  <div className="pt-1">
                    {t.status === 'draft' ? (
                      <form
                        action={async () => {
                          'use server';
                          await sendStockTransferAction(t.id);
                        }}
                      >
                        <Button size="sm" type="submit" className="w-full text-xs font-bold bg-zinc-950 text-white min-h-[38px] rounded-xl shadow-xs">
                          Dispatch Transfer →
                        </Button>
                      </form>
                    ) : t.status === 'in_transit' && isDestination ? (
                      <form
                        action={async () => {
                          'use server';
                          await receiveStockTransferAction({ transferId: t.id });
                        }}
                      >
                        <Button size="sm" type="submit" className="w-full text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white min-h-[38px] rounded-xl shadow-xs">
                          Receive Stock into {t.destinationLocationName}
                        </Button>
                      </form>
                    ) : t.status === 'in_transit' && isSource ? (
                      <span className="inline-flex items-center justify-center w-full py-2 rounded-xl text-xs font-semibold bg-zinc-100 text-zinc-600 border border-zinc-200">
                        Awaiting {t.destinationBranchName}
                      </span>
                    ) : (
                      <span className="text-zinc-400 text-xs italic block text-center py-1">Transfer Completed</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase tracking-wider font-bold">
                  <tr>
                    <th className="py-3 px-4">Transfer #</th>
                    <th className="py-3 px-4">Source</th>
                    <th className="py-3 px-4">Destination</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-medium">
                  {transfers.map((t) => {
                    const isDestination = t.destinationBranchId === activeBranchId;
                    const isSource = t.sourceBranchId === activeBranchId;

                    return (
                      <tr key={t.id} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-zinc-950">
                          {t.transferNumber}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-bold text-zinc-900">{t.sourceBranchName}</div>
                          <div className="text-[11px] text-zinc-400">{t.sourceLocationName}</div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-bold text-zinc-900">{t.destinationBranchName}</div>
                          <div className="text-[11px] text-zinc-400">{t.destinationLocationName}</div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex flex-col items-start gap-1">
                            <span
                              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase whitespace-nowrap ${
                                t.status === 'received'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : t.status === 'in_transit'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : t.status === 'sent'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-zinc-100 text-zinc-700 border border-zinc-200'
                              }`}
                            >
                              {t.status === 'in_transit' ? 'In Transit' : t.status === 'received' ? 'Received' : t.status}
                            </span>
                            {t.status === 'in_transit' && !isDestination && (
                              <span className="text-[10px] text-zinc-400">
                                Awaiting receipt at {t.destinationBranchName}
                              </span>
                            )}
                            {t.status === 'in_transit' && isDestination && (
                              <span className="text-[10px] font-semibold text-amber-700">
                                Ready to receive at {branchName}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-zinc-500">
                          {new Date(t.createdAt).toLocaleDateString()}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          {t.status === 'draft' ? (
                            <form
                              action={async () => {
                                'use server';
                                await sendStockTransferAction(t.id);
                              }}
                              className="inline-block"
                            >
                              <Button size="sm" type="submit" className="text-xs font-bold bg-zinc-950 text-white h-7">
                                Dispatch →
                              </Button>
                            </form>
                          ) : t.status === 'in_transit' && isDestination ? (
                            <form
                              action={async () => {
                                'use server';
                                await receiveStockTransferAction({ transferId: t.id });
                              }}
                              className="inline-block"
                            >
                              <Button size="sm" type="submit" className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white h-7">
                                Receive Stock
                              </Button>
                            </form>
                          ) : t.status === 'in_transit' && isSource ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 text-zinc-600 border border-zinc-200">
                              Awaiting {t.destinationBranchName}
                            </span>
                          ) : (
                            <span className="text-zinc-400 text-[11px] italic">Completed</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
