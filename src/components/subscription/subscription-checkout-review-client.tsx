'use client';

import React, { useState, ChangeEvent } from 'react';
import Link from 'next/link';
import { SubscriptionPlanCode, getPlanDefinition } from '@/lib/config/subscription-plans';
import {
  createSubscriptionPaymentIntentAction,
  CheckoutPreviewResult,
  PaymentIntentRecord,
} from '@/server/actions/subscription-checkout';
import {
  createBankTransferIntentAction,
  submitBankTransferProofAction,
} from '@/server/actions/subscription-bank-transfer';
import { EnterprisePricingInput } from '@/server/services/subscription-pricing.service';
import { getWSNexaBankDetails } from '@/lib/config/bank-transfer';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface SubscriptionCheckoutReviewClientProps {
  businessId: string;
  businessName: string;
  planCode: SubscriptionPlanCode;
  enterpriseConfig?: EnterprisePricingInput;
  preview: CheckoutPreviewResult;
}

type PaymentMethodTab = 'bank_transfer' | 'online_gateway';

export function SubscriptionCheckoutReviewClient({
  businessId,
  businessName,
  planCode,
  enterpriseConfig,
  preview,
}: SubscriptionCheckoutReviewClientProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodTab>('bank_transfer');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Online gateway state
  const [createdGatewayIntent, setCreatedGatewayIntent] = useState<PaymentIntentRecord | null>(null);

  // Bank transfer submission state
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [rawReference, setRawReference] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [submittedProofResult, setSubmittedProofResult] = useState<{
    paymentId: string;
    normalizedReference: string;
    claimStatus: string;
    amountLkr: number;
  } | null>(null);

  const planDef = getPlanDefinition(planCode);
  const { quote, allowed, conflicts, isUpgrade, isDowngrade, isRenewal } = preview;
  const bankDetails = getWSNexaBankDetails();

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        setErrorMessage('Proof file exceeds 5MB limit. Please upload a smaller file.');
        return;
      }
      setProofFile(file);
      setErrorMessage(null);
    }
  };

  // 1. Online Gateway Flow Handler
  const handleCreateGatewayIntent = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const attemptId = `attempt_${Date.now()}`;
      const res = await createSubscriptionPaymentIntentAction({
        planCode,
        enterpriseConfig,
        checkoutAttemptId: attemptId,
      });

      if (!res.success || !res.data) {
        setErrorMessage(res.message || res.error || 'Failed to create payment intent');
        setIsSubmitting(false);
        return;
      }

      setCreatedGatewayIntent(res.data);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'An error occurred during checkout');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Direct Bank Transfer Submission Handler
  const handleSubmitBankTransfer = async () => {
    if (!bankDetails.isConfigured) {
      setErrorMessage(bankDetails.unconfiguredMessage);
      return;
    }

    if (!rawReference || rawReference.trim().length < 4) {
      setErrorMessage('Please enter a valid bank transfer transaction reference number (minimum 4 characters).');
      return;
    }

    if (!proofFile) {
      setErrorMessage('Please upload a clear deposit slip image or PDF receipt.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    let uploadedStoragePath: string | null = null;
    const supabase = createClient();

    try {
      // Step A: Create or reuse bank transfer payment intent
      const intentRes = await createBankTransferIntentAction({
        planCode,
        enterpriseConfig,
      });

      if (!intentRes.success || !intentRes.data) {
        throw new Error(intentRes.message || intentRes.error || 'Failed to initialize bank transfer payment intent.');
      }

      const paymentId = intentRes.data.paymentId;
      const fileExt = proofFile.name.split('.').pop() || 'png';
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `receipts/${businessId}/${paymentId}/${fileName}`;
      uploadedStoragePath = filePath;

      // Step B: Upload file to private storage bucket 'bank-transfer-receipts'
      const { error: uploadError } = await supabase.storage
        .from('bank-transfer-receipts')
        .upload(filePath, proofFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Failed to upload receipt image: ${uploadError.message}`);
      }

      // Step C: Register proof & bank reference claim via atomic RPC
      const submitRes = await submitBankTransferProofAction({
        paymentId,
        rawReference: rawReference.trim(),
        filePath,
        fileSizeBytes: proofFile.size,
        mimeType: proofFile.type,
        notes: transferNotes.trim() || undefined,
      });

      if (!submitRes.success || !submitRes.data) {
        // Tier 1 Client Compensation: Remove uploaded file if RPC failed
        await supabase.storage.from('bank-transfer-receipts').remove([filePath]);
        throw new Error(submitRes.message || submitRes.error || 'Failed to submit bank transfer proof.');
      }

      setSubmittedProofResult({
        paymentId,
        normalizedReference: submitRes.data.normalizedReference,
        claimStatus: submitRes.data.claimStatus,
        amountLkr: intentRes.data.amountLkr,
      });
    } catch (err: unknown) {
      // Tier 1 Client Compensation Catch-All
      if (uploadedStoragePath) {
        try {
          await supabase.storage.from('bank-transfer-receipts').remove([uploadedStoragePath]);
        } catch {
          // Non-blocking
        }
      }
      setErrorMessage(err instanceof Error ? err.message : 'An error occurred during submission.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // SCREEN A: Bank Transfer Proof Submitted (Under Review)
  if (submittedProofResult) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pt-4">
        <Card className="p-8 space-y-6 border-zinc-200 shadow-xl rounded-3xl text-center bg-white">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-3xl mx-auto shadow-xs">
            📄
          </div>

          <div>
            <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300 px-3 py-1 rounded-full">
              Proof Submitted — Under Review
            </span>
            <h1 className="text-2xl font-black text-zinc-950 tracking-tight mt-3">
              Payment Under Verification
            </h1>
            <p className="text-xs text-zinc-600 font-medium mt-1 max-w-lg mx-auto">
              Your deposit slip and reference claim for{' '}
              <span className="font-extrabold text-zinc-950">{businessName}</span> have been securely submitted to the administration team.
            </p>
          </div>

          <div className="p-5 bg-zinc-50 rounded-2xl border border-zinc-200 text-left text-xs space-y-2 font-mono text-zinc-700">
            <div className="flex justify-between border-b border-zinc-200 pb-2">
              <span className="text-zinc-500 font-bold uppercase text-[10px]">Payment Intent:</span>
              <span className="font-bold text-zinc-950">#{submittedProofResult.paymentId.slice(0, 13)}</span>
            </div>
            <div className="flex justify-between border-b border-zinc-200 pb-2">
              <span className="text-zinc-500 font-bold uppercase text-[10px]">Bank Reference:</span>
              <span className="font-bold text-zinc-950">{submittedProofResult.normalizedReference}</span>
            </div>
            <div className="flex justify-between border-b border-zinc-200 pb-2">
              <span className="text-zinc-500 font-bold uppercase text-[10px]">Amount Deposited:</span>
              <span className="font-bold text-emerald-700">
                LKR {submittedProofResult.amountLkr.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 font-bold uppercase text-[10px]">Claim Status:</span>
              <span className="font-extrabold text-amber-700 uppercase">
                {submittedProofResult.claimStatus === 'disputed_conflict' ? 'Conflict Review' : 'Under Review'}
              </span>
            </div>
          </div>

          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-xs text-emerald-950 text-left space-y-1">
            <div className="font-extrabold uppercase text-[10px] text-emerald-900">What happens next?</div>
            <p className="leading-relaxed">
              Our financial operations team cross-references your bank statement reference with official corporate bank deposits. Once confirmed, your subscription will activate automatically and you will receive an in-app confirmation notification.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link href="/dashboard/settings/subscription" className="flex-1">
              <Button type="button" variant="outline" className="w-full h-11 text-xs font-bold rounded-2xl">
                View Subscription & Billing
              </Button>
            </Link>
            <Link href="/dashboard" className="flex-1">
              <Button type="button" className="w-full h-11 text-xs font-extrabold bg-zinc-950 text-white rounded-2xl hover:bg-zinc-800">
                Return to Dashboard
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  // SCREEN B: Gateway Unavailable Screen (Preserved)
  if (createdGatewayIntent) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pt-4">
        <Card className="p-8 space-y-6 border-zinc-200 shadow-xl rounded-3xl text-center bg-white">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-3xl mx-auto shadow-xs">
            💳
          </div>

          <div>
            <span className="text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 px-3 py-1 rounded-full">
              Payment Intent Pending
            </span>
            <h1 className="text-2xl font-black text-zinc-950 tracking-tight mt-3">
              Online Card Gateway Staging
            </h1>
            <p className="text-xs text-zinc-600 font-medium mt-1 max-w-lg mx-auto">
              Your subscription checkout intent has been prepared for{' '}
              <span className="font-extrabold text-zinc-950">{businessName}</span>.
            </p>
          </div>

          <div className="p-5 bg-zinc-50 rounded-2xl border border-zinc-200 text-left text-xs space-y-2 font-mono text-zinc-700">
            <div className="flex justify-between border-b border-zinc-200 pb-2">
              <span className="text-zinc-500 font-bold uppercase text-[10px]">Intent Reference:</span>
              <span className="font-bold text-zinc-950">#{createdGatewayIntent.id.slice(0, 13)}</span>
            </div>
            <div className="flex justify-between border-b border-zinc-200 pb-2">
              <span className="text-zinc-500 font-bold uppercase text-[10px]">Plan Selection:</span>
              <span className="font-bold text-zinc-950">{planDef.name} Plan</span>
            </div>
            <div className="flex justify-between border-b border-zinc-200 pb-2">
              <span className="text-zinc-500 font-bold uppercase text-[10px]">Billing Amount:</span>
              <span className="font-bold text-emerald-700 font-mono">
                LKR {createdGatewayIntent.amountLkr.toLocaleString()} / month
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 font-bold uppercase text-[10px]">Intent Status:</span>
              <span className="font-extrabold text-amber-700 uppercase">{createdGatewayIntent.status}</span>
            </div>
          </div>

          <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl text-xs text-amber-900 text-left space-y-2">
            <div className="font-extrabold uppercase text-[10px] text-amber-800">Gateway Status Note</div>
            <p className="leading-relaxed">
              Online card and mobile payment gateway integrations are currently in pre-commercial staging. During this phase, you can activate your subscription immediately using Direct Bank Transfer below, or coordinate manual settlement with support.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCreatedGatewayIntent(null);
                setSelectedMethod('bank_transfer');
              }}
              className="flex-1 h-11 text-xs font-bold rounded-2xl"
            >
              Pay via Bank Transfer Instead
            </Button>
            <Link href="/dashboard/settings/subscription" className="flex-1">
              <Button type="button" className="w-full h-11 text-xs font-extrabold bg-zinc-950 text-white rounded-2xl hover:bg-zinc-800">
                Return to Billing
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  // SCREEN C: Main Checkout Review & Payment Form
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-950 tracking-tight">Review Subscription Checkout</h1>
          <p className="text-xs font-medium text-zinc-600 mt-0.5">
            Review order details and select payment method for {businessName}.
          </p>
        </div>
        <Link href="/dashboard/settings/subscription">
          <Button variant="outline" className="text-xs h-9">
            ← Change Plan
          </Button>
        </Link>
      </div>

      {/* Downgrade Conflicts Warning */}
      {!allowed && conflicts && conflicts.length > 0 && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-5 space-y-3">
          <div className="flex items-center gap-2 text-red-900 font-extrabold text-sm">
            <span>⚠️</span> Cannot Switch to {planDef.name} Yet
          </div>
          <p className="text-xs text-red-800 font-medium">
            Your current resource usage exceeds the limits for the {planDef.name} plan. Please reduce usage before changing your subscription.
          </p>
          <ul className="text-xs font-mono text-red-900 space-y-1 pl-2">
            {conflicts.map((c, idx) => (
              <li key={idx}>• {c.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Order Itemization Card */}
      <Card className="p-6 space-y-6 border-zinc-200 shadow-sm rounded-3xl bg-white">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Selected Plan</div>
            <div className="text-xl font-black text-zinc-950 flex items-center gap-2 mt-0.5">
              <span>{planDef.name}</span>
              {isRenewal && (
                <span className="text-[10px] font-extrabold bg-blue-100 text-blue-900 px-2 py-0.5 rounded-md">
                  RENEWAL
                </span>
              )}
              {isUpgrade && (
                <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-md">
                  UPGRADE
                </span>
              )}
              {isDowngrade && (
                <span className="text-[10px] font-extrabold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md">
                  DOWNGRADE
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Billing Interval</div>
            <div className="text-sm font-bold text-zinc-900 mt-0.5 capitalize">Monthly</div>
          </div>
        </div>

        {/* Enterprise Configuration Breakdown */}
        {planCode === 'enterprise' && quote.breakdown && (
          <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200/80 space-y-2 text-xs">
            <div className="font-black text-zinc-950 uppercase text-[10px] tracking-wider border-b border-zinc-200 pb-1">
              Enterprise Scale Configuration
            </div>
            <div className="flex justify-between text-zinc-700">
              <span>Requested Scale:</span>
              <span className="font-bold text-zinc-950">
                {quote.breakdown.requestedBranches} Branches / {quote.breakdown.requestedStaff} Staff
              </span>
            </div>
            <div className="flex justify-between text-zinc-700">
              <span>Base Enterprise (5 Branches / 75 Staff):</span>
              <span className="font-mono font-bold text-zinc-900">
                LKR {quote.breakdown.basePrice.toLocaleString()} / mo
              </span>
            </div>
            {quote.breakdown.extraBranches > 0 && (
              <div className="flex justify-between text-zinc-700">
                <span>Extra Branches ({quote.breakdown.extraBranches}):</span>
                <span className="font-mono font-bold text-zinc-900">
                  +LKR {quote.breakdown.extraBranchCharge.toLocaleString()} / mo
                </span>
              </div>
            )}
            {quote.breakdown.extraStaffBlocks > 0 && (
              <div className="flex justify-between text-zinc-700">
                <span>Extra Staff ({quote.breakdown.extraStaffBlocks} blocks of 25):</span>
                <span className="font-mono font-bold text-zinc-900">
                  +LKR {quote.breakdown.extraStaffCharge.toLocaleString()} / mo
                </span>
              </div>
            )}
          </div>
        )}

        {/* Total Price Summary */}
        <div className="pt-2 border-t border-zinc-100 flex justify-between items-center">
          <div>
            <span className="text-xs font-black uppercase text-zinc-500">Final Monthly Amount</span>
            <p className="text-[11px] font-medium text-zinc-400">Authoritative calculated subscription price</p>
          </div>
          <div className="text-2xl font-black font-mono text-zinc-950">
            LKR {quote.total.toLocaleString()} <span className="text-xs font-normal text-zinc-500">/ mo</span>
          </div>
        </div>
      </Card>

      {/* Payment Method Selector Tabs */}
      <div className="space-y-4">
        <label className="block text-xs font-black uppercase tracking-wider text-zinc-700">
          Select Payment Method
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setSelectedMethod('bank_transfer')}
            className={`p-4 rounded-2xl border text-left transition-all ${
              selectedMethod === 'bank_transfer'
                ? 'border-emerald-600 bg-emerald-50/50 shadow-xs ring-2 ring-emerald-500/20'
                : 'border-zinc-200 bg-white hover:border-zinc-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-zinc-950">🏦 Direct Bank Transfer</span>
              {selectedMethod === 'bank_transfer' && (
                <span className="h-2 w-2 rounded-full bg-emerald-600" />
              )}
            </div>
            <p className="text-[11px] text-zinc-600 mt-1">
              Deposit via online banking / CDM and upload transaction proof.
            </p>
            <span className="inline-block mt-2 text-[10px] font-black uppercase bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded">
              Recommended in Sri Lanka
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedMethod('online_gateway')}
            className={`p-4 rounded-2xl border text-left transition-all ${
              selectedMethod === 'online_gateway'
                ? 'border-zinc-900 bg-zinc-50 shadow-xs ring-2 ring-zinc-500/20'
                : 'border-zinc-200 bg-white hover:border-zinc-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-zinc-950">💳 Online Card Gateway</span>
              {selectedMethod === 'online_gateway' && (
                <span className="h-2 w-2 rounded-full bg-zinc-900" />
              )}
            </div>
            <p className="text-[11px] text-zinc-600 mt-1">
              Visa / Mastercard / Mobile wallets via payment gateway.
            </p>
            <span className="inline-block mt-2 text-[10px] font-black uppercase bg-amber-100 text-amber-900 px-2 py-0.5 rounded">
              Pre-Commercial Staging
            </span>
          </button>
        </div>
      </div>

      {/* METHOD 1: Bank Transfer Instructions & Upload Panel */}
      {selectedMethod === 'bank_transfer' && (
        <Card className="p-6 space-y-5 border-emerald-200 bg-white rounded-3xl shadow-sm">
          {!bankDetails.isConfigured ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 border-b border-zinc-100 pb-4">
                <span className="text-3xl p-2 bg-amber-50 rounded-2xl border border-amber-200">🏦</span>
                <div>
                  <h2 className="text-base font-black text-zinc-950">
                    Direct Bank Transfer Notice
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Self-service bank transfer onboarding for WSNexa is currently in progress.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl text-xs text-amber-950 space-y-3">
                <div className="font-extrabold text-[11px] uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                  <span>ℹ️</span> Direct Settlement Assistance
                </div>
                <p className="leading-relaxed font-medium">
                  {bankDetails.unconfiguredMessage}
                </p>
                <div className="pt-2 border-t border-amber-200/60 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 bg-white/70 rounded-xl border border-amber-200/60">
                    <span className="text-[10px] uppercase font-bold text-amber-800 block">Support Email</span>
                    <a href={`mailto:${bankDetails.supportEmail}`} className="underline font-bold text-zinc-950 break-all">
                      {bankDetails.supportEmail}
                    </a>
                  </div>
                  <div className="p-2.5 bg-white/70 rounded-xl border border-amber-200/60">
                    <span className="text-[10px] uppercase font-bold text-amber-800 block">Support Hotline</span>
                    <a href={`tel:${bankDetails.supportPhone}`} className="underline font-bold text-zinc-950">
                      {bankDetails.supportPhone}
                    </a>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs text-zinc-600">
                <p>
                  To arrange subscription activation for <strong className="text-zinc-950">{businessName}</strong> on the{' '}
                  <strong className="text-zinc-950">{planDef.name}</strong> plan (LKR {quote.total.toLocaleString()} / mo), our operations team will assist you with direct invoice settlement.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="border-b border-zinc-100 pb-3">
                <h2 className="text-sm font-black text-zinc-950 flex items-center gap-2">
                  <span>🏦</span> Official WSNexa Deposit Account Details
                </h2>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Please transfer the exact amount of <strong className="text-zinc-900">LKR {quote.total.toLocaleString()}</strong> to the following account:
                </p>
              </div>

              {/* Account Details Box */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-zinc-50 rounded-2xl border border-zinc-200 text-xs">
                <div>
                  <span className="text-[10px] font-black uppercase text-zinc-400">Bank Name</span>
                  <p className="font-bold text-zinc-900">{bankDetails.bankName}</p>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-zinc-400">Branch</span>
                  <p className="font-bold text-zinc-900">{bankDetails.branchName}</p>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-zinc-400">Account Name</span>
                  <p className="font-bold text-zinc-900">{bankDetails.accountName}</p>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-zinc-400">Account Number</span>
                  <p className="font-mono font-black text-emerald-800 text-sm">{bankDetails.accountNumber}</p>
                </div>
              </div>

              {/* Upload Form */}
              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-black text-zinc-800 mb-1" htmlFor="bankReference">
                    Bank Transaction Reference Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="bankReference"
                    type="text"
                    placeholder="e.g. TXN-89471928, CDM-0492"
                    value={rawReference}
                    onChange={(e) => setRawReference(e.target.value.toUpperCase())}
                    className="w-full h-11 px-3.5 text-xs font-mono font-bold bg-white border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-950 uppercase"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Enter the reference number from your bank app, receipt, or SMS confirmation.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-black text-zinc-800 mb-1" htmlFor="receiptFile">
                    Upload Deposit Slip / Receipt (PNG, JPG, PDF) <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="receiptFile"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,application/pdf"
                    onChange={handleFileChange}
                    className="w-full text-xs text-zinc-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-zinc-100 file:text-zinc-800 hover:file:bg-zinc-200 cursor-pointer"
                  />
                  {proofFile && (
                    <p className="text-[10px] text-emerald-700 font-bold mt-1">
                      ✓ Selected: {proofFile.name} ({(proofFile.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1" htmlFor="transferNotes">
                    Optional Transfer Notes
                  </label>
                  <input
                    id="transferNotes"
                    type="text"
                    placeholder="e.g. Deposited via People's Bank online app"
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                    className="w-full h-10 px-3 text-xs bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-950"
                  />
                </div>
              </div>
            </>
          )}
        </Card>
      )}

      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs font-bold text-red-900">
          {errorMessage}
        </div>
      )}

      {/* Action Buttons */}
      <div className="pt-2 space-y-3">
        {selectedMethod === 'bank_transfer' ? (
          bankDetails.isConfigured ? (
            <Button
              type="button"
              disabled={!allowed || isSubmitting || !proofFile || rawReference.trim().length < 4}
              onClick={handleSubmitBankTransfer}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-2xl shadow-md transition-all cursor-pointer disabled:opacity-40"
            >
              {isSubmitting ? 'Uploading Proof & Submitting...' : 'Submit Bank Transfer Proof 📄'}
            </Button>
          ) : (
            <a
              href={`mailto:${bankDetails.supportEmail}?subject=Direct%20Subscription%20Transfer%20Inquiry%20-%20${encodeURIComponent(businessName)}`}
              className="block w-full"
            >
              <Button
                type="button"
                className="w-full h-12 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-sm rounded-2xl shadow-md transition-all cursor-pointer"
              >
                Contact Support for Direct Settlement Assistance ✉️
              </Button>
            </a>
          )
        ) : (
          <Button
            type="button"
            disabled={!allowed || isSubmitting}
            onClick={handleCreateGatewayIntent}
            className="w-full h-12 bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold text-sm rounded-2xl shadow-md transition-all cursor-pointer disabled:opacity-40"
          >
            {isSubmitting ? 'Preparing Payment Intent...' : 'Continue to Payment ⚡'}
          </Button>
        )}

        <div className="text-center text-[11px] text-zinc-500 font-medium space-y-1">
          <p>
            By proceeding, you agree to the WSNexa{' '}
            <Link href="/legal/subscription-billing" target="_blank" className="underline hover:text-zinc-950 font-bold">
              Subscription & Billing Terms
            </Link>{' '}
            and{' '}
            <Link href="/legal/refund-cancellation" target="_blank" className="underline hover:text-zinc-950 font-bold">
              Refund & Cancellation Policy
            </Link>.
          </p>
          <p className="text-[10px] text-zinc-400">
            Monthly billing in Sri Lankan Rupees (LKR). Initial pilot subscriptions include a 7-day evaluation satisfaction guarantee.
          </p>
        </div>
      </div>
    </div>
  );
}
