'use client';

import React, { useState } from 'react';
import { BranchInfo } from '@/types';
import { switchActiveBranchAction } from '@/server/actions/branch-switcher';

interface ActiveBranchSwitcherProps {
  activeBranch: BranchInfo | null;
  branches: BranchInfo[];
  isOwner: boolean;
}

export const ActiveBranchSwitcher: React.FC<ActiveBranchSwitcherProps> = ({
  activeBranch,
  branches,
  isOwner,
}) => {
  const [switching, setSwitching] = useState<boolean>(false);
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);

  if (!activeBranch || branches.length === 0) return null;

  const handleBranchSelect = async (branchId: string) => {
    if (branchId === activeBranch.id) {
      setDropdownOpen(false);
      return;
    }

    setSwitching(true);
    setDropdownOpen(false);

    const res = await switchActiveBranchAction(branchId);
    setSwitching(false);

    if (res.success) {
      // Instant reload to update dashboard context
      window.location.reload();
    } else {
      alert(res.message || 'Failed to switch branch');
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        disabled={switching}
        onClick={() => setDropdownOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-bold text-zinc-950 shadow-2xs hover:bg-zinc-50 active:scale-95 transition-all touch-manipulation"
      >
        <span className="text-zinc-500 font-medium">Branch:</span>
        <span className="font-extrabold text-zinc-950">
          {activeBranch.name} ({activeBranch.code})
        </span>
        {activeBranch.isDefault && (
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-zinc-600">
            Primary
          </span>
        )}
        <span className="text-[10px] text-zinc-400">▼</span>
      </button>

      {dropdownOpen && (
        <div
          className="absolute right-0 z-50 mt-1 w-64 rounded-2xl border border-zinc-200 bg-white p-2 shadow-2xl animate-in fade-in slide-in-from-top-1"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 border-b border-zinc-100 flex items-center justify-between text-[11px]">
            <span className="font-extrabold text-zinc-500 uppercase tracking-wider">Switch Branch</span>
            <span className="text-zinc-400 font-mono">{branches.length} Available</span>
          </div>

          <div className="max-h-56 overflow-y-auto py-1 space-y-0.5">
            {branches.map((branch) => {
              const isActive = branch.id === activeBranch.id;
              return (
                <button
                  key={branch.id}
                  type="button"
                  onClick={() => handleBranchSelect(branch.id)}
                  className={`w-full rounded-xl px-3 py-2 text-left text-xs flex items-center justify-between transition-all ${
                    isActive
                      ? 'bg-zinc-950 font-bold text-white'
                      : 'text-zinc-800 hover:bg-zinc-100 font-medium'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span>{branch.name}</span>
                      {branch.isDefault && (
                        <span className={`text-[9px] px-1 rounded ${isActive ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-600'}`}>
                          Primary
                        </span>
                      )}
                    </div>
                    <span className={`text-[10px] ${isActive ? 'text-zinc-400' : 'text-zinc-500'}`}>
                      Code: {branch.code} • {branch.timezone}
                    </span>
                  </div>

                  {isActive && <span className="text-sm">✓</span>}
                </button>
              );
            })}
          </div>

          {isOwner && (
            <div className="pt-2 border-t border-zinc-100 text-center">
              <a
                href="/dashboard/branches"
                className="block text-xs font-bold text-zinc-900 hover:text-zinc-950 hover:underline py-1"
              >
                ⚙️ Manage All Branches →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
