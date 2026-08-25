'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { claimInvitationAction } from '@/server/actions/staff-invitation';
import { reconcileAccountTypeIntentAction } from '@/server/actions/account';

interface PendingAccessScreenProps {
  intent: string;
  userEmail: string;
  reason?: string | null;
}

export function PendingAccessScreen({ intent, userEmail, reason }: PendingAccessScreenProps) {
  const [inviteCode, setInviteCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [mismatchTarget, setMismatchTarget] = useState<'branch_manager' | 'staff' | null>(null);

  // 1. Subscription Suspended View (Commercially Suspended Workspace for Staff)
  if (reason === 'subscription_suspended') {
    return (
      <div className="max-w-md mx-auto bg-white border border-zinc-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl text-center">
        <div className="w-16 h-16 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-xs">
          💳
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-black text-zinc-950 uppercase tracking-wider">Subscription Suspended</h1>
          <p className="text-xs text-zinc-600 leading-relaxed">
            Your workspace account <span className="text-zinc-950 font-mono font-bold">{userEmail}</span> is temporarily restricted.
          </p>
        </div>

        <div className="p-4 bg-amber-50/80 rounded-xl border border-amber-200/80 text-left text-xs space-y-2">
          <div className="font-extrabold text-amber-950 uppercase text-[10px] tracking-wider">Workspace Access Notice</div>
          <p className="text-amber-900 leading-relaxed font-medium">
            This workspace is temporarily unavailable because the business subscription is suspended. Please contact your business owner or administrator.
          </p>
        </div>

        <div className="border-t border-zinc-100 pt-4 flex flex-col gap-2.5">
          <Link
            href="/customer"
            className="py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs uppercase tracking-wider rounded-xl transition-all block text-center"
          >
            Continue as Customer
          </Link>
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="w-full py-2.5 bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm"
            >
              Sign Out / Switch Account
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 1b. Subscription Cancelled View (Commercially Cancelled Workspace for Staff)
  if (reason === 'subscription_cancelled') {
    return (
      <div className="max-w-md mx-auto bg-white border border-zinc-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl text-center">
        <div className="w-16 h-16 bg-zinc-100 border border-zinc-300 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-xs">
          🛑
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-black text-zinc-950 uppercase tracking-wider">Subscription Cancelled</h1>
          <p className="text-xs text-zinc-600 leading-relaxed">
            Your workspace account <span className="text-zinc-950 font-mono font-bold">{userEmail}</span> is currently inactive.
          </p>
        </div>

        <div className="p-4 bg-zinc-100/80 rounded-xl border border-zinc-200 text-left text-xs space-y-2">
          <div className="font-extrabold text-zinc-900 uppercase text-[10px] tracking-wider">Workspace Access Notice</div>
          <p className="text-zinc-700 leading-relaxed font-medium">
            This workspace is currently inactive because the business subscription has been cancelled. Please contact your business owner or administrator.
          </p>
        </div>

        <div className="border-t border-zinc-100 pt-4 flex flex-col gap-2.5">
          <Link
            href="/customer"
            className="py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs uppercase tracking-wider rounded-xl transition-all block text-center"
          >
            Continue as Customer
          </Link>
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="w-full py-2.5 bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm"
            >
              Sign Out / Switch Account
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. Platform Administrative Suspended View (Abuse/Security Platform Suspension)
  if (reason === 'platform_suspended') {
    return (
      <div className="max-w-md mx-auto bg-white border border-zinc-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl text-center">
        <div className="w-16 h-16 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-xs">
          🚫
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-black text-zinc-950 uppercase tracking-wider">Workspace Suspended</h1>
          <p className="text-xs text-zinc-600 leading-relaxed">
            Your workspace account <span className="text-zinc-950 font-mono font-bold">{userEmail}</span> is restricted.
          </p>
        </div>

        <div className="p-4 bg-red-50/80 rounded-xl border border-red-200/80 text-left text-xs space-y-2">
          <div className="font-extrabold text-red-950 uppercase text-[10px] tracking-wider">Platform Security Policy</div>
          <p className="text-red-900 leading-relaxed font-medium">
            This workspace has been suspended by WSNexa platform administration.
          </p>
        </div>

        <div className="border-t border-zinc-100 pt-4 flex flex-col gap-2.5">
          <Link
            href="/customer"
            className="py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs uppercase tracking-wider rounded-xl transition-all block text-center"
          >
            Continue as Customer
          </Link>
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="w-full py-2.5 bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm"
            >
              Sign Out / Switch Account
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 3. Default Invitation Claim View (for pending invite / authorization)
  const formattedIntent = intent === 'branch_manager' ? 'Branch Manager' : 'Staff Member';

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setMismatchTarget(null);

    const res = await claimInvitationAction({ code: inviteCode.trim() });

    setIsSubmitting(false);

    if (res.success && res.data) {
      setSuccessMsg(res.message || 'Invitation claimed successfully! Redirecting to workspace...');
      setTimeout(() => {
        window.location.href = res.data!.targetRoute;
      }, 1000);
    } else {
      setErrorMsg(res.message || 'Unable to claim invitation code. Please verify and retry.');
      if (res.mismatchIntent && res.targetIntentNeeded) {
        setMismatchTarget(res.targetIntentNeeded);
      }
    }
  };

  const handleChangeAccountType = async () => {
    if (!mismatchTarget) return;
    setIsSubmitting(true);
    const recRes = await reconcileAccountTypeIntentAction(mismatchTarget);
    setIsSubmitting(false);
    if (recRes.success) {
      window.location.reload();
    } else {
      setErrorMsg(recRes.message || 'Failed to change account type intent.');
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white border border-zinc-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl text-center">
      <div className="w-16 h-16 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-xs">
        ⏳
      </div>

      <div className="space-y-2">
        <h1 className="text-xl font-black text-zinc-950 uppercase tracking-wider">Business Access Required</h1>
        <p className="text-xs text-zinc-600 leading-relaxed">
          Your account <span className="text-zinc-950 font-mono font-bold">{userEmail}</span> is registered with intent <span className="text-zinc-950 font-bold">{formattedIntent}</span>.
        </p>
      </div>

      <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 text-left text-xs space-y-2">
        <div className="font-bold text-zinc-900 uppercase text-[10px] tracking-wider">Security Authorization Rule</div>
        <p className="text-zinc-600 leading-relaxed">
          Staff and Manager privileges must be authorized server-side by a Business Owner. Enter your single-use invitation code below to activate access.
        </p>
      </div>

      {/* Invitation Code Claim Form */}
      <form onSubmit={handleClaimSubmit} className="space-y-3 pt-2">
        <div className="text-left">
          <label className="block text-[11px] font-semibold text-zinc-700 uppercase tracking-wider mb-1">
            Invitation Code
          </label>
          <input
            type="text"
            placeholder="WSN-MGR-K7P4-X2Q9"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            disabled={isSubmitting || !!successMsg}
            className="w-full bg-white text-zinc-950 font-mono text-sm border border-zinc-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-950 uppercase shadow-xs"
            required
          />
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-medium text-left space-y-2">
            <div>⚠️ {errorMsg}</div>
            {mismatchTarget && (
              <button
                type="button"
                onClick={handleChangeAccountType}
                disabled={isSubmitting}
                className="w-full py-2 px-3 bg-zinc-950 hover:bg-zinc-800 text-white font-bold text-[11px] rounded-lg transition-all shadow-xs"
              >
                Change Account Type to {mismatchTarget === 'branch_manager' ? 'Branch Manager' : 'Staff Member'}
              </button>
            )}
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold text-left">
            ✅ {successMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={!inviteCode.trim() || isSubmitting || !!successMsg}
          className="w-full py-3 bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all disabled:opacity-40 shadow-md active:scale-95"
        >
          {isSubmitting ? 'Validating & Claiming Code...' : 'Claim Invitation Code'}
        </button>
      </form>

      <div className="border-t border-zinc-100 pt-4 flex flex-col gap-2">
        <Link
          href="/customer"
          className="py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs uppercase tracking-wider rounded-xl transition-all block text-center"
        >
          Continue as Customer
        </Link>
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="text-xs text-zinc-500 hover:text-zinc-700 font-medium py-1 transition-colors"
          >
            Log Out / Switch Account
          </button>
        </form>
      </div>
    </div>
  );
}
