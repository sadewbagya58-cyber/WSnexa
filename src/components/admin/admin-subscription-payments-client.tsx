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
import {
  approveBankTransferPaymentAdminAction,
  rejectBankTransferPaymentAdminAction,
  getAdminBankTransferReviewDetailsAction,
  AdminBankTransferReviewDetails,
} from '@/server/actions/subscription-bank-transfer-admin';

export interface AdminPaymentRecord {
  id: string;
  business_id: string;
  plan_code: string;
  amount_lkr: number;
  currency: string;
  status: string;
  payment_method?: string | null;
  review_status?: string | null;
  verified_at?: string | null;
  reconciliation_notes?: string | null;
  bank_statement_ref?: string | null;
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
    paymentMethod?: string;
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
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(filters.paymentMethod || 'all');

  const [selectedPayment, setSelectedPayment] = useState<AdminPaymentRecord | null>(null);
  const [adminReason, setAdminReason] = useState('');
  const [adminActionType, setAdminActionType] = useState<'cancel' | 'expire' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Bank transfer review state
  const [reviewDossier, setReviewDossier] = useState<AdminBankTransferReviewDetails | null>(null);
  const [isLoadingDossier, setIsLoadingDossier] = useState(false);
  const [settlementStatementRef, setSettlementStatementRef] = useState('');
  const [settlementReconciliationNote, setSettlementReconciliationNote] = useState('');
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [isSettling, setIsSettling] = useState(false);

  const closeModal = () => {
    setSelectedPayment(null);
    setReviewDossier(null);
    setAdminActionType(null);
    setAdminReason('');
    setActionError(null);
    setSettlementStatementRef('');
    setSettlementReconciliationNote('');
    setRejectionReasonInput('');
  };

  const openModal = async (item: AdminPaymentRecord) => {
    setSelectedPayment(item);
    setReviewDossier(null);
    setAdminActionType(null);
    setAdminReason('');
    setActionError(null);
    setSettlementStatementRef('');
    setSettlementReconciliationNote('');
    setRejectionReasonInput('');

    if (item.payment_method === 'manual_bank_transfer') {
      setIsLoadingDossier(true);
      try {
        const res = await getAdminBankTransferReviewDetailsAction(item.id);
        if (res.success && res.data) {
          setReviewDossier(res.data);
        }
      } catch (err) {
        console.warn('Failed to load review dossier:', err);
      } finally {
        setIsLoadingDossier(false);
      }
    }
  };

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

    if (selectedPaymentMethod !== 'all') params.set('paymentMethod', selectedPaymentMethod);
    else params.delete('paymentMethod');

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
      closeModal();
      router.refresh();
    } else {
      setActionError(res.message || 'Action failed.');
    }
  };

  const handleApproveBankTransfer = async () => {
    if (!selectedPayment) return;
    if (!settlementStatementRef.trim()) {
      setActionError('External bank statement transaction reference is required.');
      return;
    }
    if (!settlementReconciliationNote.trim()) {
      setActionError('Reconciliation audit note is required.');
      return;
    }

    setIsSettling(true);
    setActionError(null);

    try {
      const res = await approveBankTransferPaymentAdminAction({
        paymentId: selectedPayment.id,
        expectedPlanId: selectedPayment.plan_code,
        expectedAmountLkr: selectedPayment.amount_lkr,
        externalBankStatementRef: settlementStatementRef.trim(),
        reconciliationNote: settlementReconciliationNote.trim(),
      });

      if (res.success) {
        closeModal();
        router.refresh();
      } else {
        setActionError(res.message || res.error || 'Settlement failed.');
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Settlement failed.');
    } finally {
      setIsSettling(false);
    }
  };

  const handleRejectBankTransfer = async () => {
    if (!selectedPayment) return;
    if (!rejectionReasonInput.trim()) {
      setActionError('A rejection reason is required.');
      return;
    }

    setIsSettling(true);
    setActionError(null);

    try {
      const res = await rejectBankTransferPaymentAdminAction({
        paymentId: selectedPayment.id,
        rejectionReason: rejectionReasonInput.trim(),
      });

      if (res.success) {
        closeModal();
        router.refresh();
      } else {
        setActionError(res.message || res.error || 'Rejection failed.');
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Rejection failed.');
    } finally {
      setIsSettling(false);
    }
  };

  const renderStatusBadge = (status: string, reviewStatus?: string | null) => {
    if (reviewStatus === 'under_review') {
      return (
        <Badge variant="solid" className="bg-amber-500 text-white border border-amber-600 font-black text-[10px] px-2 py-0.5">
          UNDER REVIEW
        </Badge>
      );
    }

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

  const renderMethodBadge = (item: AdminPaymentRecord) => {
    if (item.payment_method === 'manual_bank_transfer') {
      return (
        <span className="inline-flex items-center gap-1 font-bold text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
          🏦 Bank Transfer
        </span>
      );
    }
    if (item.provider) {
      return (
        <span className="inline-flex items-center gap-1 font-bold text-[10px] text-zinc-700 bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded-md">
          💳 {item.provider.toUpperCase()}
        </span>
      );
    }
    return <span className="text-zinc-400 font-mono text-[11px]">—</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-purple-900 bg-purple-100 border border-purple-200 px-2 py-0.5 rounded-full">
              Super Admin Console
            </span>
            <span className="text-xs text-zinc-500 font-medium">SaaS Subscription Ledger</span>
          </div>
          <h1 className="text-2xl font-black text-zinc-950 tracking-tight mt-1">Subscription Payments</h1>
          <p className="text-xs text-zinc-600 font-medium mt-0.5">
            Platform-wide transaction history, bank transfer verification, and audit reconciliation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="neutral" className="text-xs px-3 py-1 font-black">
            {initialData.total} Total Payments
          </Badge>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="sm:col-span-2">
            <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1">
              Search Reference / ID
            </label>
            <input
              type="text"
              placeholder="Filter by #reference, ID, or tx ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
              className="w-full h-9 px-3 text-xs bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full h-9 px-2 text-xs bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="paid">Paid</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          {/* Payment Method Filter */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1">Method</label>
            <select
              value={selectedPaymentMethod}
              onChange={(e) => setSelectedPaymentMethod(e.target.value)}
              className="w-full h-9 px-2 text-xs bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
            >
              <option value="all">All Methods</option>
              <option value="manual_bank_transfer">🏦 Bank Transfer</option>
              <option value="online_gateway">💳 Online Gateway</option>
            </select>
          </div>

          {/* Plan Filter */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1">Plan</label>
            <select
              value={selectedPlan}
              onChange={(e) => setSelectedPlan(e.target.value)}
              className="w-full h-9 px-2 text-xs bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
            >
              <option value="all">All Plans</option>
              <option value="starter">Starter</option>
              <option value="growth">Growth</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSearch('');
              setSelectedStatus('all');
              setSelectedProvider('all');
              setSelectedPurpose('all');
              setSelectedPlan('all');
              setSelectedPaymentMethod('all');
              router.push('/admin/subscription-payments');
            }}
            className="text-xs h-8"
          >
            Reset Filters
          </Button>
          <Button type="button" onClick={applyFilters} className="text-xs h-8 bg-zinc-950 text-white hover:bg-zinc-800">
            Apply Filters
          </Button>
        </div>
      </div>

      {/* Payments Table */}
      {initialData.data.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-zinc-200 space-y-2">
          <div className="text-3xl">🧾</div>
          <div className="text-sm font-extrabold text-zinc-900">No payment records found</div>
          <p className="text-xs text-zinc-500">Try adjusting your filters or search terms.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-500 uppercase tracking-wider text-[10px] font-black bg-zinc-50/70">
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Business</th>
                <th className="py-3.5 px-4">Plan</th>
                <th className="py-3.5 px-4">Method</th>
                <th className="py-3.5 px-4">Amount</th>
                <th className="py-3.5 px-4">Status</th>
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
                  <td className="py-3 px-4 whitespace-nowrap">{renderMethodBadge(item)}</td>
                  <td className="py-3 px-4 font-mono font-black text-zinc-950">
                    LKR {item.amount_lkr.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">{renderStatusBadge(item.status, item.review_status)}</td>
                  <td className="py-3 px-4 font-mono text-zinc-500 text-[11px]">
                    {item.provider_transaction_id ? item.provider_transaction_id : `#${item.id.slice(0, 8)}`}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => openModal(item)}
                      className={`px-3 py-1 rounded-lg font-extrabold text-[11px] transition-all cursor-pointer shadow-2xs ${
                        item.review_status === 'under_review'
                          ? 'bg-amber-600 hover:bg-amber-700 text-white ring-2 ring-amber-400/30'
                          : 'bg-zinc-900 hover:bg-zinc-800 text-white'
                      }`}
                    >
                      {item.review_status === 'under_review' ? 'Verify Slip 🔍' : 'View Detail'}
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
                  Super Admin Settlement Desk
                </span>
                <h3 className="text-xl font-black text-zinc-950 tracking-tight mt-1">
                  Payment #{selectedPayment.id.slice(0, 13)}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
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
                  <div className="mt-1">{renderStatusBadge(selectedPayment.status, selectedPayment.review_status)}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-400">Total Amount</span>
                  <div className="font-mono font-black text-zinc-950 text-sm mt-0.5">
                    LKR {selectedPayment.amount_lkr.toLocaleString()}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-400">Method</span>
                  <div className="mt-1">{renderMethodBadge(selectedPayment)}</div>
                </div>
              </div>

              {/* SECTION: Bank Transfer Verification Dossier */}
              {selectedPayment.payment_method === 'manual_bank_transfer' && (
                <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2">
                    <span className="text-xs font-black uppercase text-emerald-950">
                      🏦 Bank Transfer Review Dossier
                    </span>
                    {isLoadingDossier && (
                      <span className="text-[10px] font-bold text-emerald-700 animate-pulse">
                        Loading receipt & claims...
                      </span>
                    )}
                  </div>

                  {reviewDossier && (
                    <div className="space-y-3">
                      {/* Conflict Alert */}
                      {reviewDossier.claim?.claimStatus === 'disputed_conflict' && (
                        <div className="p-3 bg-amber-100 border border-amber-300 rounded-xl text-amber-950 space-y-1">
                          <div className="font-extrabold text-xs flex items-center gap-1">
                            <span>⚠️</span> CONFLICT DETECTED: MULTIPLE BUSINESS CLAIMS
                          </div>
                          <p className="text-[11px] leading-relaxed">
                            Another business has submitted this identical bank reference. Check your bank statement meticulously to verify which customer actually made the deposit before approving.
                          </p>
                        </div>
                      )}

                      {/* Reference Details */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-zinc-500">Customer Reference</span>
                          <p className="font-mono font-bold text-zinc-900">{reviewDossier.claim?.rawReference || '—'}</p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase text-zinc-500">Normalized Reference</span>
                          <p className="font-mono font-bold text-zinc-900">{reviewDossier.claim?.normalizedReference || '—'}</p>
                        </div>
                      </div>

                      {/* Resource Audit */}
                      <div className="p-2.5 bg-white rounded-xl border border-emerald-200/80 text-[11px] space-y-1">
                        <span className="text-[10px] font-black uppercase text-zinc-500">Current Resource Audit</span>
                        <div className="flex justify-between">
                          <span>Active Branches in Workspace:</span>
                          <span className="font-bold text-zinc-900">{reviewDossier.resourceAudit.activeBranches}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Active Staff Members:</span>
                          <span className="font-bold text-zinc-900">{reviewDossier.resourceAudit.activeStaff}</span>
                        </div>
                      </div>

                      {/* Deposit Slip Viewer */}
                      {reviewDossier.proof?.signedUrl ? (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[10px] font-black uppercase text-zinc-600">Uploaded Deposit Slip:</span>
                          <div className="rounded-xl overflow-hidden border border-zinc-300 bg-white">
                            {reviewDossier.proof.mimeType === 'application/pdf' ? (
                              <div className="p-4 text-center space-y-2">
                                <span className="text-2xl">📄</span>
                                <p className="text-xs font-bold text-zinc-800">PDF Bank Slip Document</p>
                                <a
                                  href={reviewDossier.proof.signedUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-block text-xs font-bold text-emerald-700 underline hover:no-underline"
                                >
                                  Open PDF Document in New Tab ↗
                                </a>
                              </div>
                            ) : (
                              <a
                                href={reviewDossier.proof.signedUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block group relative"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={reviewDossier.proof.signedUrl}
                                  alt="Deposit Slip"
                                  className="w-full max-h-56 object-contain bg-zinc-900/5 group-hover:opacity-95 transition-opacity"
                                />
                                <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 text-white rounded text-[10px] font-bold">
                                  Click to view full size ↗
                                </div>
                              </a>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-zinc-100 rounded-xl text-zinc-500 text-center text-xs">
                          {isLoadingDossier ? 'Loading slip...' : 'No proof file uploaded yet.'}
                        </div>
                      )}

                      {/* Verification & Settlement Form (Only for pending / processing / under_review) */}
                      {selectedPayment.status !== 'paid' && selectedPayment.review_status !== 'approved' && (
                        <div className="p-3 bg-white rounded-xl border border-emerald-300 space-y-3 mt-2">
                          <div className="text-xs font-extrabold text-emerald-950">
                            Verify Bank Statement & Approve Settlement
                          </div>

                          <div>
                            <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                              External Bank Statement Tx ID / Narration <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. CBS-0947192, COMB-DEPOSIT-20261003"
                              value={settlementStatementRef}
                              onChange={(e) => setSettlementStatementRef(e.target.value)}
                              className="w-full h-8 px-2.5 text-xs bg-zinc-50 border border-zinc-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-emerald-600"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                              Reconciliation Audit Note <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Verified deposit in Commercial Bank account by admin"
                              value={settlementReconciliationNote}
                              onChange={(e) => setSettlementReconciliationNote(e.target.value)}
                              className="w-full h-8 px-2.5 text-xs bg-zinc-50 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                            />
                          </div>

                          <div className="flex gap-2 pt-1">
                            <Button
                              type="button"
                              disabled={isSettling || !settlementStatementRef.trim() || !settlementReconciliationNote.trim()}
                              onClick={handleApproveBankTransfer}
                              className="flex-1 h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs"
                            >
                              {isSettling ? 'Settling Atomically...' : 'Approve & Activate Subscription ⚡'}
                            </Button>
                          </div>

                          {/* Rejection Option */}
                          <div className="pt-2 border-t border-zinc-100 space-y-2">
                            <span className="text-[10px] font-bold text-rose-700 uppercase">Or Reject Payment:</span>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="Rejection reason (e.g. Deposit not found in statement)..."
                                value={rejectionReasonInput}
                                onChange={(e) => setRejectionReasonInput(e.target.value)}
                                className="flex-1 h-8 px-2 text-xs bg-zinc-50 border border-zinc-300 rounded-lg text-rose-900"
                              />
                              <Button
                                type="button"
                                disabled={isSettling || !rejectionReasonInput.trim()}
                                onClick={handleRejectBankTransfer}
                                className="h-8 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
                              >
                                Reject
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

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
                onClick={closeModal}
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
