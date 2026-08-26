'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cancelOwnerPendingPaymentIntentAction } from '@/server/actions/subscription-payment-admin';

export interface SubscriptionPaymentItem {
  id: string;
  business_id: string;
  plan_code: string;
  amount_lkr: number;
  currency: string;
  status: string;
  payment_purpose: string;
  provider: string | null;
  provider_transaction_id: string | null;
  provider_reference: string | null;
  pricing_snapshot: Record<string, unknown> | null;
  created_at: string;
  processing_at: string | null;
  paid_at: string | null;
  failed_at: string | null;
  cancelled_at: string | null;
  expired_at: string | null;
  refunded_at: string | null;
  failure_code: string | null;
  failure_message: string | null;
  admin_reason: string | null;
}

interface OwnerBillingHistoryClientProps {
  initialPayments: SubscriptionPaymentItem[];
  total: number;
  page: number;
  totalPages: number;
}

export function OwnerBillingHistoryClient({
  initialPayments,
  total,
  page,
  totalPages,
}: OwnerBillingHistoryClientProps) {
  const router = useRouter();
  const [payments, setPayments] = useState<SubscriptionPaymentItem[]>(initialPayments);
  const [selectedPayment, setSelectedPayment] = useState<SubscriptionPaymentItem | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const renderStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    switch (s) {
      case 'pending':
        return <Badge variant="solid" className="bg-amber-100 text-amber-900 border border-amber-300 font-black text-[10px] px-2 py-0.5">PENDING</Badge>;
      case 'processing':
        return <Badge variant="solid" className="bg-blue-100 text-blue-900 border border-blue-300 font-black text-[10px] px-2 py-0.5">PROCESSING</Badge>;
      case 'paid':
        return <Badge variant="solid" className="bg-emerald-600 text-white border border-emerald-700 font-black text-[10px] px-2 py-0.5">PAID</Badge>;
      case 'failed':
        return <Badge variant="solid" className="bg-rose-100 text-rose-900 border border-rose-300 font-black text-[10px] px-2 py-0.5">FAILED</Badge>;
      case 'cancelled':
        return <Badge variant="solid" className="bg-zinc-100 text-zinc-800 border border-zinc-300 font-black text-[10px] px-2 py-0.5">CANCELLED</Badge>;
      case 'expired':
        return <Badge variant="solid" className="bg-slate-100 text-slate-800 border border-slate-300 font-black text-[10px] px-2 py-0.5">EXPIRED</Badge>;
      case 'refunded':
        return <Badge variant="solid" className="bg-purple-100 text-purple-900 border border-purple-300 font-black text-[10px] px-2 py-0.5">REFUNDED</Badge>;
      default:
        return <Badge variant="solid" className="bg-zinc-100 text-zinc-800 font-black text-[10px] px-2 py-0.5">{status.toUpperCase()}</Badge>;
    }
  };

  const handleCancelPending = async (paymentId: string) => {
    if (!confirm('Are you sure you want to cancel this pending payment intent?')) return;
    setIsCancelling(true);
    setActionError(null);

    const res = await cancelOwnerPendingPaymentIntentAction({ paymentId });
    setIsCancelling(false);

    if (res.success && res.data) {
      const updatedItem = res.data as SubscriptionPaymentItem;
      setPayments((prev) =>
        prev.map((p) => (p.id === paymentId ? updatedItem : p))
      );
      if (selectedPayment?.id === paymentId) {
        setSelectedPayment(updatedItem);
      }
      router.refresh();
    } else {
      setActionError(res.message || 'Failed to cancel payment intent');
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
        <div>
          <h2 className="text-lg font-black text-zinc-950 tracking-tight">Billing & Payment History</h2>
          <p className="text-xs text-zinc-500 font-medium mt-0.5">
            Review past SaaS subscription payment records, checkout intents, and transaction details.
          </p>
        </div>
        <div className="text-xs font-bold text-zinc-500">
          Total Records: <span className="font-mono text-zinc-950">{total}</span>
        </div>
      </div>

      {actionError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-800">
          {actionError}
        </div>
      )}

      {/* Empty State */}
      {payments.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-zinc-200 rounded-2xl space-y-2">
          <p className="text-sm font-bold text-zinc-600">No subscription payment history yet.</p>
          <p className="text-xs text-zinc-400">Payment records will appear here when checkout intents are initiated.</p>
        </div>
      ) : (
        /* Payment History Table */
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-500 uppercase tracking-wider text-[10px] font-black bg-zinc-50/50">
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Plan</th>
                <th className="py-3 px-3">Purpose</th>
                <th className="py-3 px-3">Amount</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Provider</th>
                <th className="py-3 px-3">Ref ID</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 font-medium text-zinc-900">
              {payments.map((item) => (
                <tr key={item.id} className="hover:bg-zinc-50/80 transition-colors">
                  <td className="py-3 px-3 font-mono text-zinc-600 whitespace-nowrap">
                    {new Date(item.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="py-3 px-3 font-extrabold capitalize text-zinc-950">{item.plan_code}</td>
                  <td className="py-3 px-3 capitalize text-zinc-700">
                    {(item.payment_purpose || 'new_subscription').replace('_', ' ')}
                  </td>
                  <td className="py-3 px-3 font-mono font-black text-zinc-950">
                    LKR {item.amount_lkr.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">{renderStatusBadge(item.status)}</td>
                  <td className="py-3 px-3 text-zinc-500 font-medium">
                    {item.provider ? item.provider.toUpperCase() : 'Not connected'}
                  </td>
                  <td className="py-3 px-3 font-mono text-zinc-500 text-[11px]">
                    #{item.id.slice(0, 8)}
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setSelectedPayment(item)}
                      className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-extrabold text-[11px] transition-all cursor-pointer"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center border-t border-zinc-100 pt-4 text-xs">
          <span className="text-zinc-500">
            Page <span className="font-mono font-bold text-zinc-950">{page}</span> of{' '}
            <span className="font-mono font-bold text-zinc-950">{totalPages}</span>
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={page <= 1}
              onClick={() => router.push(`/dashboard/settings/subscription?page=${page - 1}`)}
              className="text-xs h-8 px-3"
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => router.push(`/dashboard/settings/subscription?page=${page + 1}`)}
              className="text-xs h-8 px-3"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Payment Detail Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-2xl space-y-6 max-w-lg w-full">
            <div className="flex justify-between items-start border-b border-zinc-100 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Payment Detail</span>
                <h3 className="text-xl font-black text-zinc-950 tracking-tight mt-0.5">
                  Intent #{selectedPayment.id.slice(0, 8)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPayment(null)}
                className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-black text-sm flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-400">Status</span>
                  <div className="mt-1">{renderStatusBadge(selectedPayment.status)}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-400">Total Amount</span>
                  <div className="font-mono font-black text-zinc-950 text-sm mt-0.5">
                    LKR {selectedPayment.amount_lkr.toLocaleString()}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-400">Plan Code</span>
                  <div className="font-extrabold capitalize text-zinc-950 mt-0.5">{selectedPayment.plan_code}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-400">Billing Interval</span>
                  <div className="font-extrabold text-zinc-950 mt-0.5">Monthly</div>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] uppercase font-bold text-zinc-400">Purpose</span>
                  <div className="font-semibold capitalize text-zinc-800 mt-0.5">
                    {(selectedPayment.payment_purpose || 'new_subscription').replace('_', ' ')}
                  </div>
                </div>
              </div>

              {/* Provider Info */}
              <div className="space-y-1 p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                <span className="text-[10px] uppercase font-bold text-zinc-400">Gateway Information</span>
                <div className="flex justify-between text-zinc-700">
                  <span>Provider:</span>
                  <span className="font-mono font-bold text-zinc-950">
                    {selectedPayment.provider ? selectedPayment.provider.toUpperCase() : 'Not connected'}
                  </span>
                </div>
                {selectedPayment.provider_transaction_id && (
                  <div className="flex justify-between text-zinc-700">
                    <span>Transaction ID:</span>
                    <span className="font-mono font-bold text-zinc-950">{selectedPayment.provider_transaction_id}</span>
                  </div>
                )}
                {selectedPayment.provider_reference && (
                  <div className="flex justify-between text-zinc-700">
                    <span>Reference:</span>
                    <span className="font-mono font-bold text-zinc-950">{selectedPayment.provider_reference}</span>
                  </div>
                )}
              </div>

              {/* Enterprise Snapshot if present */}
              {(() => {
                const breakdown = (selectedPayment.pricing_snapshot as { breakdown?: { requestedBranches?: number; requestedStaff?: number } } | null)?.breakdown;
                if (!breakdown) return null;
                return (
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl space-y-1.5 text-purple-950">
                    <span className="text-[10px] font-black uppercase text-purple-800">Enterprise Pricing Snapshot</span>
                    <div className="flex justify-between text-[11px]">
                      <span>Requested Scale:</span>
                      <span className="font-mono font-bold">
                        {breakdown.requestedBranches ?? 5} branches /{' '}
                        {breakdown.requestedStaff ?? 75} staff
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Timestamps */}
              <div className="space-y-1 text-[11px] text-zinc-500 border-t border-zinc-100 pt-3">
                <div className="flex justify-between">
                  <span>Created At:</span>
                  <span className="font-mono text-zinc-800">{new Date(selectedPayment.created_at).toLocaleString()}</span>
                </div>
                {selectedPayment.paid_at && (
                  <div className="flex justify-between">
                    <span>Paid At:</span>
                    <span className="font-mono text-emerald-700 font-bold">{new Date(selectedPayment.paid_at).toLocaleString()}</span>
                  </div>
                )}
                {selectedPayment.cancelled_at && (
                  <div className="flex justify-between">
                    <span>Cancelled At:</span>
                    <span className="font-mono text-zinc-700 font-bold">{new Date(selectedPayment.cancelled_at).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Safe Modal Actions */}
            <div className="flex items-center justify-between border-t border-zinc-100 pt-4">
              {selectedPayment.status === 'pending' && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isCancelling}
                  onClick={() => handleCancelPending(selectedPayment.id)}
                  className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
                >
                  Cancel Pending Intent
                </Button>
              )}

              {selectedPayment.status === 'paid' && (
                <span className="text-[11px] font-bold text-zinc-400">Receipt: Coming Soon</span>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedPayment(null)}
                className="text-xs ml-auto"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
