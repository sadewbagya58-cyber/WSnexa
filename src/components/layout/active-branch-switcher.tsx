'use client';

import React, { useState } from 'react';
import { BranchInfo } from '@/types';
import { switchActiveBranchAction } from '@/server/actions/branch-switcher';

interface ActiveBranchSwitcherProps {
  activeBranch: BranchInfo | null;
  branches: BranchInfo[];
  isOwner: boolean;
}

function checkAnyWaiterCartItems(): boolean {
  if (typeof window === 'undefined' || !window.sessionStorage) return false;
  try {
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      if (key && key.startsWith('wsnexa_waiter_cart:')) {
        const raw = window.sessionStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.cart && parsed.cart.length > 0) {
            return true;
          }
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
      if (key && key.startsWith('wsnexa_waiter_cart:')) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

export const ActiveBranchSwitcher: React.FC<ActiveBranchSwitcherProps> = ({
  activeBranch,
  branches,
  isOwner,
}) => {
  const [switching, setSwitching] = useState<boolean>(false);
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const [pendingBranchId, setPendingBranchId] = useState<string | null>(null);

  if (!activeBranch || branches.length === 0) return null;

  const executeBranchSwitch = async (branchId: string) => {
    setSwitching(true);
    setDropdownOpen(false);
    setPendingBranchId(null);

    clearAllWaiterCarts();

    const res = await switchActiveBranchAction(branchId);
    setSwitching(false);

    if (res.success) {
      window.location.reload();
    } else {
      alert(res.message || 'Failed to switch branch');
    }
  };

  const handleBranchSelect = (branchId: string) => {
    if (branchId === activeBranch.id) {
      setDropdownOpen(false);
      return;
    }

    if (checkAnyWaiterCartItems()) {
      setPendingBranchId(branchId);
      setDropdownOpen(false);
    } else {
      executeBranchSwitch(branchId);
    }
  };

  return (
    <div className="relative min-w-0">
      <button
        type="button"
        disabled={switching}
        onClick={() => setDropdownOpen((prev) => !prev)}
        className="flex items-center gap-1.5 xs:gap-2 rounded-xl border border-zinc-300 bg-white px-2.5 sm:px-3 py-1.5 text-xs font-bold text-zinc-950 shadow-2xs hover:bg-zinc-50 active:scale-95 transition-all touch-manipulation min-h-[44px] sm:min-h-[38px] min-w-0"
        aria-label={`Current Branch: ${activeBranch.name}. Tap to switch branch.`}
      >
        <span className="text-zinc-500 font-medium hidden sm:inline shrink-0">Branch:</span>
        <span className="font-extrabold text-zinc-950 truncate max-w-[105px] xs:max-w-[155px] sm:max-w-none">
          📍 {activeBranch.name}
        </span>
        {activeBranch.isDefault && (
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-zinc-600 hidden md:inline shrink-0">
            Primary
          </span>
        )}
        <span className="text-[10px] text-zinc-400 shrink-0 ml-0.5">▼</span>
      </button>

      {dropdownOpen && (
        <>
          {/* Backdrop for closing */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-40"
            onClick={() => setDropdownOpen(false)}
          />

          {/* Mobile Bottom Sheet & Desktop Dropdown Container */}
          <div
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-white p-5 shadow-2xl animate-in slide-in-from-bottom-5 duration-200 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-1 sm:w-72 sm:rounded-2xl sm:p-3 sm:shadow-2xl sm:animate-in sm:fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div>
                <h3 className="font-black text-sm text-zinc-950 uppercase tracking-wider">Switch Branch</h3>
                <p className="text-[11px] text-zinc-500">{branches.length} Location{branches.length > 1 ? 's' : ''} Available</p>
              </div>
              <button
                type="button"
                onClick={() => setDropdownOpen(false)}
                className="h-8 w-8 rounded-full bg-zinc-100 text-zinc-500 font-bold text-xs flex items-center justify-center sm:hidden"
              >
                ✕
              </button>
            </div>

            <div className="max-h-64 sm:max-h-56 overflow-y-auto py-2 space-y-1">
              {branches.map((branch) => {
                const isActive = branch.id === activeBranch.id;
                return (
                  <button
                    key={branch.id}
                    type="button"
                    disabled={switching}
                    onClick={() => handleBranchSelect(branch.id)}
                    className={`w-full min-h-[48px] rounded-xl px-4 py-2.5 text-left text-xs flex items-center justify-between transition-all active:scale-[0.98] ${
                      isActive
                        ? 'bg-zinc-950 font-bold text-white shadow-sm ring-1 ring-zinc-950'
                        : 'text-zinc-900 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200/60 font-medium'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-sm">{branch.name}</span>
                        {branch.isDefault && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${isActive ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-200 text-zinc-700'}`}>
                            Primary
                          </span>
                        )}
                      </div>
                      <p className={`text-[11px] ${isActive ? 'text-zinc-400' : 'text-zinc-500'}`}>
                        Code: {branch.code} • {branch.timezone}
                      </p>
                    </div>

                    {isActive ? (
                      <span className="h-6 w-6 rounded-full bg-white text-zinc-950 font-black text-xs flex items-center justify-center shadow-xs">
                        ✓
                      </span>
                    ) : (
                      <span className="text-zinc-400 font-bold text-xs">Select →</span>
                    )}
                  </button>
                );
              })}
            </div>

            {isOwner && (
              <div className="pt-3 border-t border-zinc-100 text-center mt-1">
                <a
                  href="/dashboard/branches"
                  className="inline-block w-full py-2.5 rounded-xl bg-zinc-100 text-zinc-950 font-extrabold text-xs hover:bg-zinc-200 transition-colors"
                >
                  ⚙️ Manage All Branches →
                </a>
              </div>
            )}
          </div>
        </>
      )}

      {/* Confirmation Modal when switching branch with active waiter draft */}
      {pendingBranchId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 border border-zinc-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2 text-amber-600 font-extrabold text-sm uppercase tracking-wide">
              ⚠️ Switch Branch?
            </div>
            <p className="text-xs text-zinc-700 leading-relaxed font-medium">
              Switching branches will clear the current waiter order draft.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingBranchId(null)}
                className="flex-1 py-2.5 rounded-xl border border-zinc-300 text-zinc-700 font-bold text-xs hover:bg-zinc-100 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeBranchSwitch(pendingBranchId)}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-extrabold text-xs hover:bg-red-700 shadow-sm min-h-[44px]"
              >
                Switch Branch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
