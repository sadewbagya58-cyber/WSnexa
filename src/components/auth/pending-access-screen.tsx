'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface PendingAccessScreenProps {
  intent: string;
  userEmail: string;
}

export function PendingAccessScreen({ intent, userEmail }: PendingAccessScreenProps) {
  const [inviteCode, setInviteCode] = useState('');
  const [isCodeSubmitted, setIsCodeSubmitted] = useState(false);

  const formattedIntent = intent === 'branch_manager' ? 'Branch Manager' : 'Staff Member';

  const handleClaimSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsCodeSubmitted(true);
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
          Staff and Manager privileges must be authorized server-side by a Business Owner. Selecting a role does not grant access automatically.
        </p>
      </div>

      {/* Invitation Code Placeholder Form */}
      <form onSubmit={handleClaimSubmit} className="space-y-3 pt-2">
        <div className="text-left">
          <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
            Have an Invitation Code?
          </label>
          <input
            type="text"
            placeholder="WSN-MGR-XXXXXX"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            className="w-full bg-zinc-950 text-white font-mono text-sm border border-zinc-800 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500 uppercase"
          />
        </div>

        {isCodeSubmitted && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 text-xs font-mono">
            ℹ️ Invitation code claim engine is coming in Phase 14. Your code has been recorded.
          </div>
        )}

        <button
          type="submit"
          disabled={!inviteCode.trim()}
          className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all disabled:opacity-40"
        >
          Claim Invitation Code
        </button>
      </form>

      <div className="border-t border-zinc-800 pt-4 flex flex-col gap-2">
        <Link
          href="/customer"
          className="py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all block text-center"
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
