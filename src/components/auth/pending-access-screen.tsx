'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { claimInvitationAction } from '@/server/actions/staff-invitation';

interface PendingAccessScreenProps {
  intent: string;
  userEmail: string;
}

export function PendingAccessScreen({ intent, userEmail }: PendingAccessScreenProps) {
  const [inviteCode, setInviteCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const formattedIntent = intent === 'branch_manager' ? 'Branch Manager' : 'Staff Member';

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await claimInvitationAction({ code: inviteCode.trim() });

    setIsSubmitting(false);

    if (res.success && res.data) {
      setSuccessMsg(res.message || 'Invitation claimed successfully! Redirecting to workspace...');
      setTimeout(() => {
        window.location.href = res.data!.targetRoute;
      }, 1000);
    } else {
      setErrorMsg(res.message || 'Unable to claim invitation code. Please verify and retry.');
    }
  };

  return (
    <div className="max-w-md mx-auto bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6 shadow-2xl text-center">
      <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center text-3xl mx-auto">
        ⏳
      </div>

      <div className="space-y-2">
        <h1 className="text-xl font-black text-white uppercase tracking-wider">Business Access Required</h1>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Your account <span className="text-amber-400 font-mono font-semibold">{userEmail}</span> is registered with intent <span className="text-white font-bold">{formattedIntent}</span>.
        </p>
      </div>

      <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 text-left text-xs space-y-2">
        <div className="font-bold text-zinc-200 uppercase text-[10px] tracking-wider">Security Authorization Rule</div>
        <p className="text-zinc-400 leading-relaxed">
          Staff and Manager privileges must be authorized server-side by a Business Owner. Enter your single-use invitation code below to activate access.
        </p>
      </div>

      {/* Invitation Code Claim Form */}
      <form onSubmit={handleClaimSubmit} className="space-y-3 pt-2">
        <div className="text-left">
          <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
            Invitation Code
          </label>
          <input
            type="text"
            placeholder="WSN-MGR-K7P4-X2Q9"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            disabled={isSubmitting || !!successMsg}
            className="w-full bg-zinc-950 text-white font-mono text-sm border border-zinc-800 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500 uppercase selection:bg-amber-500 selection:text-black"
            required
          />
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-medium text-left">
            ⚠️ {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-semibold text-left">
            ✅ {successMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={!inviteCode.trim() || isSubmitting || !!successMsg}
          className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all disabled:opacity-40 shadow-lg"
        >
          {isSubmitting ? 'Validating & Claiming Code...' : 'Claim Invitation Code'}
        </button>
      </form>

      <div className="border-t border-zinc-800 pt-4 flex flex-col gap-2">
        <Link
          href="/customer"
          className="py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs uppercase tracking-wider rounded-xl transition-all block text-center"
        >
          Continue as Customer
        </Link>
        <a
          href="/api/auth/logout"
          className="text-xs text-zinc-500 hover:text-zinc-400 font-medium py-1 transition-colors"
        >
          Log Out / Switch Account
        </a>
      </div>
    </div>
  );
}
