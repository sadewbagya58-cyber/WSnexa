'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FormattedStockTransfer } from '@/server/services/inventory.service';
import { sendStockTransferAction, receiveStockTransferAction } from '@/server/actions/inventory';

interface StockTransfersClientProps {
  transfers: FormattedStockTransfer[];
  activeBranchId: string;
  branchName: string;
  canManageTransfers: boolean;
}

export function StockTransfersClient({
  transfers,
  activeBranchId,
  branchName,
  canManageTransfers,
}: StockTransfersClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loadingTransferId, setLoadingTransferId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleDispatch = async (transferId: string) => {
    setLoadingTransferId(transferId);
    setFeedback(null);

    const res = await sendStockTransferAction(transferId);
    setLoadingTransferId(null);

    if (res.success) {
      setFeedback({ type: 'success', message: 'Transfer dispatched successfully! Stock has been deducted and marked in transit.' });
      startTransition(() => {
        router.refresh();
      });
    } else {
      setFeedback({ type: 'error', message: res.message || 'Failed to dispatch transfer.' });
    }
  };

  const handleReceive = async (transferId: string) => {
    setLoadingTransferId(transferId);
    setFeedback(null);

    const res = await receiveStockTransferAction({ transferId });
    setLoadingTransferId(null);

    if (res.success) {
      setFeedback({ type: 'success', message: 'Stock received successfully into destination location!' });
      startTransition(() => {
        router.refresh();
      });
    } else {
      setFeedback({ type: 'error', message: res.message || 'Failed to receive stock.' });
    }
  };

  const incomingInTransit = transfers.filter(
    (t) => t.destinationBranchId === activeBranchId && t.status === 'in_transit'
  );

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-bold border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {feedback.type === 'success' ? '✓ ' : '⚠️ '}
          {feedback.message}
        </div>
      )}

      {/* Incoming In-Transit Transfers Alert */}
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
                  Stock has been dispatched and is currently in transit. Click &ldquo;Receive Stock&rdquo; to accept items into {branchName} inventory.
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

                <Button
                  size="sm"
                  type="button"
                  disabled={loadingTransferId === t.id || isPending}
                  onClick={() => handleReceive(t.id)}
                  className="w-full text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white min-h-[38px] shadow-xs"
                >
                  {loadingTransferId === t.id ? 'Receiving Stock...' : `Receive Stock into ${t.destinationLocationName}`}
                </Button>
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
                      <Button
                        size="sm"
                        type="button"
                        disabled={loadingTransferId === t.id || isPending}
                        onClick={() => handleDispatch(t.id)}
                        className="w-full text-xs font-bold bg-zinc-950 text-white min-h-[38px] rounded-xl shadow-xs"
                      >
                        {loadingTransferId === t.id ? 'Dispatching Transfer...' : 'Dispatch Transfer →'}
                      </Button>
                    ) : t.status === 'in_transit' && isDestination ? (
                      <Button
                        size="sm"
                        type="button"
                        disabled={loadingTransferId === t.id || isPending}
                        onClick={() => handleReceive(t.id)}
                        className="w-full text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white min-h-[38px] rounded-xl shadow-xs"
                      >
                        {loadingTransferId === t.id ? 'Receiving Stock...' : `Receive Stock into ${t.destinationLocationName}`}
                      </Button>
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
                            <Button
                              size="sm"
                              type="button"
                              disabled={loadingTransferId === t.id || isPending}
                              onClick={() => handleDispatch(t.id)}
                              className="text-xs font-bold bg-zinc-950 text-white h-7"
                            >
                              {loadingTransferId === t.id ? 'Dispatching...' : 'Dispatch →'}
                            </Button>
                          ) : t.status === 'in_transit' && isDestination ? (
                            <Button
                              size="sm"
                              type="button"
                              disabled={loadingTransferId === t.id || isPending}
                              onClick={() => handleReceive(t.id)}
                              className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white h-7"
                            >
                              {loadingTransferId === t.id ? 'Receiving...' : 'Receive Stock'}
                            </Button>
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
