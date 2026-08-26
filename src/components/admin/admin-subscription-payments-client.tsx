'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  cancelPendingPaymentIntentAction,
  expirePendingPaymentIntentAction,
} from '@/server/actions/subscription-payment-admin';

export interface AdminPaymentRecord {
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
  business?: {
    id: string;
    name: string;
    slug: string;
    status: string;
  } | null;
}

interface AdminSubscriptionPaymentsClientProps {
  initialData: {
    data: AdminPaymentRecord[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  filters: {
    status: string;
    provider: string;
    purpose: string;
    plan: string;
    search: string;
  };
}

export function AdminSubscriptionPaymentsClient({
  initialData,
  filters,
}: AdminSubscriptionPaymentsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(filters.search || '');
  const [selectedStatus, setSelectedStatus] = useState(filters.status || 'all');
  const [selectedProvider, setSelectedProvider] = useState(filters.provider || 'all');
  const [selectedPurpose, setSelectedPurpose] = useState(filters.purpose || 'all');
  const [selectedPlan, setSelectedPlan] = useState(filters.plan || 'all');

  const [selectedPayment, setSelectedPayment] = useState<AdminPaymentRecord | null>(null);
  const [adminReason, setAdminReason] = useState('');
  const [adminActionType, setAdminActionType] = useState<'cancel' | 'expire' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const applyFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (search.trim()) params.set('search', search.trim());
    else params.delete('search');

    if (selectedStatus !== 'all') params.set('status', selectedStatus);
    else params.delete('status');

    if (selectedProvider !== 'all') params.set('provider', selectedProvider);
    else params.delete('provider');

    if (selectedPurpose !== 'all') params.set('purpose', selectedPurpose);
    else params.delete('purpose');

    if (selectedPlan !== 'all') params.set('plan', selectedPlan);
    else params.delete('plan');

    params.set('page', '1');
    router.push(`/admin/subscription-payments?${params.toString()}`);
  };

  const handleAdminAction = async () => {
    if (!selectedPayment || !adminActionType) return;
    if (!adminReason.trim()) {
      setActionError('Administrative reason is required for this action.');
      return;
    }

    setIsSubmitting(true);
    setActionError(null);

    let res = null;
    if (adminActionType === 'cancel') {
      res = await cancelPendingPaymentIntentAction({
        paymentId: selectedPayment.id,
        reason: adminReason.trim(),
      });
    } else {
      res = await expirePendingPaymentIntentAction({
        paymentId: selectedPayment.id,
        reason: adminReason.trim(),
      });
    }

    setIsSubmitting(false);

    if (res.success && res.data) {
      setSelectedPayment(null);
      setAdminActionType(null);
      setAdminReason('');
      router.refresh();
    } else {
      setActionError(res.message || 'Action failed.');
    }
  };

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

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-zinc-950 tracking-tight">SaaS Subscription Payments</h1>
          <p className="text-xs text-zinc-600 font-medium mt-1">
            Platform-wide SaaS commercial subscription payment activity, intents, and gateway audit history.
          </p>
        </div>
        <div className="text-xs font-bold text-zinc-600 bg-zinc-100 px-3 py-1.5 rounded-xl border border-zinc-200">
          Total Intents: <span className="font-mono text-zinc-950 font-black">{initialData.total}</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 p-4 bg-zinc-50 border border-zinc-200 rounded-2xl">
        <input
          type="text"
          placeholder="Search ID, Tx ID, Ref..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
          className="h-9 px-3 text-xs bg-white border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-950 font-medium text-zinc-950"
        />

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="h-9 px-2 text-xs bg-white border border-zinc-300 rounded-xl font-medium text-zinc-950 cursor-pointer"
        >
          <option value="all">All Statuses</option>
          <option value="pending">PENDING</option>
          <option value="processing">PROCESSING</option>
          <option value="paid">PAID</option>
          <option value="failed">FAILED</option>
          <option value="cancelled">CANCELLED</option>
          <option value="expired">EXPIRED</option>
          <option value="refunded">REFUNDED</option>
        </select>

        <select
          value={selectedProvider}
          onChange={(e) => setSelectedProvider(e.target.value)}
          className="h-9 px-2 text-xs bg-white border border-zinc-300 rounded-xl font-medium text-zinc-950 cursor-pointer"
        >
          <option value="all">All Providers</option>
          <option value="onepay">OnePay</option>
          <option value="dialog">Dialog</option>
          <option value="payhere">PayHere</option>
          <option value="none">No Provider (Pending)</option>
        </select>

        <select
          value={selectedPurpose}
          onChange={(e) => setSelectedPurpose(e.target.value)}
          className="h-9 px-2 text-xs bg-white border border-zinc-300 rounded-xl font-medium text-zinc-950 cursor-pointer"
        >
          <option value="all">All Purposes</option>
          <option value="new_subscription">New Subscription</option>
          <option value="upgrade">Upgrade</option>
          <option value="downgrade">Downgrade</option>
          <option value="renewal">Renewal</option>
          <option value="reactivation">Reactivation</option>
        </select>

        <select
          value={selectedPlan}
          onChange={(e) => setSelectedPlan(e.target.value)}
          className="h-9 px-2 text-xs bg-white border border-zinc-300 rounded-xl font-medium text-zinc-950 cursor-pointer"
        >
          <option value="all">All Plans</option>
          <option value="starter">Starter</option>
          <option value="growth">Growth</option>
          <option value="enterprise">Enterprise</option>
        </select>

        <Button
          type="button"
          onClick={applyFilters}
          className="h-9 text-xs bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold rounded-xl transition-all cursor-pointer"
        >
          Filter Results ⚡
        </Button>
      </div>

      {/* Table */}
      {initialData.data.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-zinc-200 rounded-2xl space-y-2 bg-white">
          <p className="text-sm font-bold text-zinc-700">No subscription payments found.</p>
          <p className="text-xs text-zinc-400">No payment intent records match the selected filter criteria.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-500 uppercase tracking-wider text-[10px] font-black bg-zinc-50/70">
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Business</th>
                <th className="py-3.5 px-4">Plan</th>
                <th className="py-3.5 px-4">Purpose</th>
                <th className="py-3.5 px-4">Amount</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Provider</th>
                <th className="py-3.5 px-4">Ref / Tx ID</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 font-medium text-zinc-900">
              {initialData.data.map((item) => (
                <tr key={item.id} className="hover:bg-zinc-50/80 transition-colors">
                  <td className="py-3 px-4 font-mono text-zinc-600 whitespace-nowrap">
                    {new Date(item.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="py-3 px-4 font-extrabold text-zinc-950">
                    {item.business ? (
                      <Link
                        href={`/admin/businesses/${item.business.id}`}
                        className="hover:underline text-zinc-950 hover:text-purple-700"
                      >
                        {item.business.name}
                      </Link>
                    ) : (
                      <span className="text-zinc-400 font-mono text-[11px]">{item.business_id.slice(0, 8)}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-extrabold capitalize text-zinc-900">{item.plan_code}</td>
                  <td className="py-3 px-4 capitalize text-zinc-700">
                    {(item.payment_purpose || 'new_subscription').replace('_', ' ')}
                  </td>
                  <td className="py-3 px-4 font-mono font-black text-zinc-950">
                    LKR {item.amount_lkr.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">{renderStatusBadge(item.status)}</td>
                  <td className="py-3 px-4 text-zinc-500 font-medium">
                    {item.provider ? item.provider.toUpperCase() : '—'}
                  </td>
                  <td className="py-3 px-4 font-mono text-zinc-500 text-[11px]">
                    {item.provider_transaction_id ? item.provider_transaction_id : `#${item.id.slice(0, 8)}`}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPayment(item);
                        setAdminActionType(null);
                        setAdminReason('');
                        setActionError(null);
                      }}
                      className="px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-extrabold text-[11px] transition-all cursor-pointer shadow-2xs"
                    >
                      View Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail & Action Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-2xl space-y-6 max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-zinc-100 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-purple-900 bg-purple-100 border border-purple-200 px-2 py-0.5 rounded-full">
                  Super Admin Detail View
                </span>
                <h3 className="text-xl font-black text-zinc-950 tracking-tight mt-1">
                  Payment Intent #{selectedPayment.id}
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

            {actionError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-800">
                {actionError}
              </div>
            )}

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-400">Business</span>
                  <div className="font-extrabold text-zinc-950 text-sm mt-0.5">
                    {selectedPayment.business?.name || selectedPayment.business_id}
                  </div>
                </div>
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
                  <span className="text-[10px] uppercase font-bold text-zinc-400">Plan / Purpose</span>
                  <div className="font-semibold capitalize text-zinc-800 mt-0.5">
                    {selectedPayment.plan_code} ({(selectedPayment.payment_purpose || 'new_subscription').replace('_', ' ')})
                  </div>
                </div>
              </div>

              {/* Gateway Snapshot */}
              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100 space-y-1">
                <span className="text-[10px] uppercase font-bold text-zinc-400">Gateway Information</span>
                <div className="flex justify-between">
                  <span>Provider:</span>
                  <span className="font-mono font-bold text-zinc-950">
                    {selectedPayment.provider ? selectedPayment.provider.toUpperCase() : 'None (Pending Gateway)'}
                  </span>
                </div>
                {selectedPayment.provider_transaction_id && (
                  <div className="flex justify-between">
                    <span>Provider Tx ID:</span>
                    <span className="font-mono font-bold text-zinc-950">{selectedPayment.provider_transaction_id}</span>
                  </div>
                )}
                {selectedPayment.provider_reference && (
                  <div className="flex justify-between">
                    <span>Provider Ref:</span>
                    <span className="font-mono font-bold text-zinc-950">{selectedPayment.provider_reference}</span>
                  </div>
                )}
              </div>

              {/* Enterprise Snapshot if present */}
              {(() => {
                const breakdown = (selectedPayment.pricing_snapshot as {
                  breakdown?: {
                    basePrice?: number;
                    extraBranches?: number;
                    extraBranchCharge?: number;
                    extraStaffBlocks?: number;
                    extraStaffCharge?: number;
                  };
                } | null)?.breakdown;
                if (!breakdown) return null;
                return (
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl space-y-1 text-purple-950">
                    <span className="text-[10px] font-black uppercase text-purple-800">Enterprise Charge Breakdown</span>
                    <div className="flex justify-between">
                      <span>Base Enterprise (5/75):</span>
                      <span className="font-mono font-bold">LKR {breakdown.basePrice?.toLocaleString()}</span>
                    </div>
                    {typeof breakdown.extraBranches === 'number' && breakdown.extraBranches > 0 && (
                      <div className="flex justify-between">
                        <span>Extra Branches ({breakdown.extraBranches}):</span>
                        <span className="font-mono font-bold">+LKR {breakdown.extraBranchCharge?.toLocaleString()}</span>
                      </div>
                    )}
                    {typeof breakdown.extraStaffBlocks === 'number' && breakdown.extraStaffBlocks > 0 && (
                      <div className="flex justify-between">
                        <span>Extra Staff Blocks ({breakdown.extraStaffBlocks}):</span>
                        <span className="font-mono font-bold">+LKR {breakdown.extraStaffCharge?.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Admin Reason if recorded */}
              {selectedPayment.admin_reason && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
                  <span className="text-[10px] uppercase font-bold text-amber-800">Admin Action Reason:</span>
                  <p className="font-medium mt-0.5">{selectedPayment.admin_reason}</p>
                </div>
              )}

              {/* Admin Action Prompt */}
              {adminActionType && (
                <div className="p-4 bg-zinc-900 text-white rounded-2xl space-y-3">
                  <div className="text-xs font-bold text-amber-400">
                    Mandatory Reason for {adminActionType.toUpperCase()} Action:
                  </div>
                  <input
                    type="text"
                    placeholder="Enter administrative reason (e.g. duplicate_intent, abandoned_checkout)..."
                    value={adminReason}
                    onChange={(e) => setAdminReason(e.target.value)}
                    className="w-full h-9 px-3 text-xs bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAdminActionType(null)}
                      className="text-xs bg-zinc-800 text-white border-zinc-700 hover:bg-zinc-700"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      disabled={isSubmitting || !adminReason.trim()}
                      onClick={handleAdminAction}
                      className="text-xs bg-rose-600 hover:bg-rose-500 text-white font-extrabold"
                    >
                      Confirm {adminActionType.toUpperCase()}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between border-t border-zinc-100 pt-4">
              {selectedPayment.status === 'pending' && !adminActionType && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAdminActionType('cancel')}
                    className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
                  >
                    Cancel Intent
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAdminActionType('expire')}
                    className="text-xs text-slate-700 border-slate-200 hover:bg-slate-50"
                  >
                    Expire Intent
                  </Button>
                </div>
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
