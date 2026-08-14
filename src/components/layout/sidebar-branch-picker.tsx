'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BranchInfo } from '@/types';
import { switchActiveBranchAction } from '@/server/actions/branch-switcher';

interface SidebarBranchPickerProps {
  activeBranch: BranchInfo | null;
  branches: BranchInfo[];
  isOwner: boolean;
  onClose: () => void; // closes the mobile drawer after navigating
}

// ── Waiter cart helpers (shared logic) ──────────────────────────────────────

function checkAnyWaiterCartItems(): boolean {
  if (typeof window === 'undefined' || !window.sessionStorage) return false;
  try {
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      if (key && key.startsWith('wsnexa_waiter_cart:')) {
        const raw = window.sessionStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw) as { cart?: unknown[] };
          if (parsed.cart && parsed.cart.length > 0) return true;
        }
      }
    }
  } catch {
    // ignore
  }
  return false;
}

function clearAllWaiterCarts(): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      if (key && key.startsWith('wsnexa_waiter_cart:')) keysToRemove.push(key);
    }
    for (const k of keysToRemove) window.sessionStorage.removeItem(k);
  } catch {
    // ignore
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export const SidebarBranchPicker: React.FC<SidebarBranchPickerProps> = ({
  activeBranch,
  branches,
  isOwner,
  onClose,
}) => {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [pendingBranchId, setPendingBranchId] = useState<string | null>(null);

  // Don't render if no branch data
  if (!activeBranch || branches.length === 0) return null;

  // Single-branch staff: no switcher needed, just show current branch name
  const hasManyBranches = branches.length > 1;

  const isBranchesPage = pathname.startsWith('/dashboard/branches');

  const executeBranchSwitch = async (branchId: string) => {
    setSwitching(true);
    setPendingBranchId(null);
    setExpanded(false);
    clearAllWaiterCarts();
    const res = await switchActiveBranchAction(branchId);
    setSwitching(false);
    if (res.success) {
      onClose();
      window.location.reload();
    } else {
      alert(res.message || 'Failed to switch branch');
    }
  };

  const handleBranchSelect = (branchId: string) => {
    if (branchId === activeBranch.id) {
      setExpanded(false);
      return;
    }
    if (checkAnyWaiterCartItems()) {
      setPendingBranchId(branchId);
      setExpanded(false);
    } else {
      executeBranchSwitch(branchId);
    }
  };

  return (
    <>
      {/* ── Branches nav item ───────────────────────────────────────────── */}
      <div className="space-y-0.5">
        {/* Main row: nav link + expand toggle */}
        <div
          className={`flex min-h-[44px] items-center rounded-xl px-3 py-2 transition-all ${
            pathname.startsWith('/dashboard/branches')
              ? 'bg-zinc-950 text-white shadow-xs'
              : 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950'
          }`}
        >
          <Link
            href="/dashboard/branches"
            onClick={onClose}
            className="flex-1 text-xs font-bold truncate touch-manipulation"
          >
            Branches
          </Link>

          {/* Expand toggle — only shown when there are multiple branches */}
          {hasManyBranches && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              disabled={switching}
              className={`ml-2 flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition-all touch-manipulation min-h-[36px] shrink-0 ${
                pathname.startsWith('/dashboard/branches')
                  ? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
              aria-label={expanded ? 'Collapse branch list' : 'Expand branch list'}
            >
              <span className="hidden xs:inline truncate max-w-[80px]">{activeBranch.name}</span>
              <span
                className={`text-[10px] transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              >
                ▼
              </span>
            </button>
          )}

          {/* Single-branch: just show name badge */}
          {!hasManyBranches && (
            <span
              className={`ml-2 text-[10px] font-bold px-2 py-1 rounded-lg truncate max-w-[80px] shrink-0 ${
                pathname.startsWith('/dashboard/branches')
                  ? 'bg-zinc-800 text-zinc-200'
                  : 'bg-zinc-100 text-zinc-600'
              }`}
            >
              {activeBranch.name}
            </span>
          )}
        </div>

        {/* ── Expanded branch list accordion ──────────────────────────── */}
        {expanded && hasManyBranches && (
          <div className="ml-3 mt-1 rounded-2xl border border-zinc-200 bg-zinc-50/80 overflow-hidden">
            {/* Current branch label */}
            <div className="px-4 pt-3 pb-1">
              <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                Current Branch
              </p>
              <p className="text-xs font-extrabold text-zinc-950 mt-0.5 truncate">
                {activeBranch.name}
              </p>
            </div>

            {/* Branch list */}
            <div className="max-h-52 overflow-y-auto px-2 py-2 space-y-1">
              {branches.map((branch) => {
                const isActive = branch.id === activeBranch.id;
                return (
                  <button
                    key={branch.id}
                    type="button"
                    disabled={switching}
                    onClick={() => handleBranchSelect(branch.id)}
                    className={`w-full min-h-[44px] rounded-xl px-3 py-2 text-left text-xs flex items-center justify-between gap-2 transition-all touch-manipulation active:scale-[0.98] ${
                      isActive
                        ? 'bg-zinc-950 text-white font-bold shadow-sm'
                        : 'bg-white text-zinc-800 font-medium hover:bg-zinc-100 border border-zinc-200/80'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-extrabold truncate">{branch.name}</span>
                        {branch.isDefault && (
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 ${
                              isActive
                                ? 'bg-zinc-800 text-zinc-300'
                                : 'bg-zinc-200 text-zinc-600'
                            }`}
                          >
                            Primary
                          </span>
                        )}
                      </div>
                      <p
                        className={`text-[10px] ${
                          isActive ? 'text-zinc-400' : 'text-zinc-500'
                        }`}
                      >
                        {branch.code}
                      </p>
                    </div>

                    {isActive ? (
                      <span className="h-5 w-5 rounded-full bg-white text-zinc-950 font-black text-[11px] flex items-center justify-center shadow-xs shrink-0">
                        ✓
                      </span>
                    ) : (
                      <span className="text-zinc-400 font-bold text-[11px] shrink-0">
                        →
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Manage Branches link */}
            {isOwner && !isBranchesPage && (
              <div className="px-2 pb-2 pt-1 border-t border-zinc-200 mt-1">
                <Link
                  href="/dashboard/branches"
                  onClick={onClose}
                  className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl bg-zinc-100 text-zinc-950 font-extrabold text-xs hover:bg-zinc-200 transition-colors touch-manipulation"
                >
                  ⚙️ Manage Branches →
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Waiter-cart confirmation modal ──────────────────────────────── */}
      {pendingBranchId && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 border border-zinc-200 animate-in fade-in zoom-in-95 duration-150 mx-4">
            <div className="flex items-center gap-2 text-amber-600 font-extrabold text-sm uppercase tracking-wide">
              ⚠️ Switch Branch?
            </div>
            <p className="text-xs text-zinc-700 leading-relaxed font-medium">
              Switching branches will clear your current waiter order draft.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingBranchId(null)}
                className="flex-1 py-2.5 rounded-xl border border-zinc-300 text-zinc-700 font-bold text-xs hover:bg-zinc-100 min-h-[44px] touch-manipulation"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeBranchSwitch(pendingBranchId)}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-extrabold text-xs hover:bg-red-700 shadow-sm min-h-[44px] touch-manipulation"
              >
                Switch Branch
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
