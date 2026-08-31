'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface AddTableChooserModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchName: string;
}

export const AddTableChooserModal: React.FC<AddTableChooserModalProps> = ({
  isOpen,
  onClose,
  branchName,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-5 sm:p-6 shadow-2xl space-y-5 border border-zinc-200 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-100 pb-3">
          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-black text-zinc-950 flex items-center gap-2">
              <span>🪑</span>
              <span>Add Dining Tables</span>
            </h2>
            <p className="text-xs text-zinc-500">
              Choose how you want to set up tables for <span className="font-semibold text-zinc-800">{branchName}</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Option Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Option 1: Single Table */}
          <Link
            href="/dashboard/tables/new"
            onClick={onClose}
            className="group flex flex-col justify-between p-4 rounded-xl border border-zinc-200 hover:border-zinc-950 hover:bg-zinc-50 transition-all space-y-3"
          >
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-base">
                  🪑
                </span>
                <span className="font-extrabold text-sm text-zinc-950">Add Single Table</span>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Create one table manually with custom code, capacity, and seating shape.
              </p>
            </div>
            <div className="pt-2">
              <span className="inline-flex items-center text-xs font-bold text-zinc-900 group-hover:underline">
                Single Table Form →
              </span>
            </div>
          </Link>

          {/* Option 2: Bulk Add Tables */}
          <Link
            href="/dashboard/tables/bulk"
            onClick={onClose}
            className="group flex flex-col justify-between p-4 rounded-xl border-2 border-emerald-600/30 bg-emerald-50/20 hover:border-emerald-600 hover:bg-emerald-50/50 transition-all space-y-3"
          >
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 text-base">
                  ⚡
                </span>
                <span className="font-extrabold text-sm text-emerald-950">Bulk Add Tables</span>
              </div>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Generate multiple sequential tables (e.g. Tables 1–20) for your service area at once.
              </p>
            </div>
            <div className="pt-2">
              <span className="inline-flex items-center text-xs font-bold text-emerald-800 group-hover:underline">
                ⚡ Bulk Generator →
              </span>
            </div>
          </Link>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-100 text-xs">
          <Link
            href="/dashboard/tables"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-900 font-medium"
          >
            View Table Layout →
          </Link>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};
