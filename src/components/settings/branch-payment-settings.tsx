'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { BranchPaymentMethod, ConfiguredPaymentMethodType } from '@/types/database.types';
import { updateBranchPaymentMethodAction } from '@/server/actions/branch-payment';

interface BranchPaymentSettingsProps {
  branchId: string;
  branchName: string;
  initialMethods: BranchPaymentMethod[];
}

export function BranchPaymentSettings({
  branchId,
  branchName,
  initialMethods,
}: BranchPaymentSettingsProps) {
  const [methods, setMethods] = useState<BranchPaymentMethod[]>(initialMethods);
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleToggle = async (m: BranchPaymentMethod) => {
    const newStatus = !m.is_enabled;
    setMethods((prev) =>
      prev.map((item) => (item.id === m.id ? { ...item, is_enabled: newStatus } : item))
    );

    setIsSaving(true);
    setFeedbackMsg(null);

    const res = await updateBranchPaymentMethodAction(branchId, m.method, {
      is_enabled: newStatus,
    });
    setIsSaving(false);

    if (res.success) {
      setFeedbackMsg({
        type: 'success',
        text: `${m.display_name || m.method} ${newStatus ? 'enabled' : 'disabled'} for ${branchName}.`,
      });
    } else {
      setFeedbackMsg({ type: 'error', text: res.message || 'Failed to update payment method.' });
      // Revert state
      setMethods((prev) =>
        prev.map((item) => (item.id === m.id ? { ...item, is_enabled: !newStatus } : item))
      );
    }
  };

  const handleUpdateText = (
    methodType: ConfiguredPaymentMethodType,
    field: 'display_name' | 'instructions',
    val: string
  ) => {
    setMethods((prev) =>
      prev.map((item) => (item.method === methodType ? { ...item, [field]: val } : item))
    );
  };

  const handleSaveDetails = async (m: BranchPaymentMethod) => {
    setIsSaving(true);
    setFeedbackMsg(null);

    const res = await updateBranchPaymentMethodAction(branchId, m.method, {
      display_name: m.display_name || undefined,
      instructions: m.instructions || undefined,
    });
    setIsSaving(false);

    if (res.success) {
      setFeedbackMsg({ type: 'success', text: `Saved custom details for ${m.display_name || m.method}.` });
    } else {
      setFeedbackMsg({ type: 'error', text: res.message || 'Failed to save payment method details.' });
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-zinc-200 pb-4">
        <h1 className="text-xl sm:text-2xl font-extrabold text-zinc-950">Branch Payment Methods</h1>
        <p className="text-xs text-zinc-500 mt-1">
          Configure payment options accepted at <strong className="text-zinc-800">{branchName}</strong>. Only enabled payment methods will be displayed during customer QR checkout.
        </p>
      </div>

      {feedbackMsg && (
        <div
          className={`p-4 rounded-xl text-xs font-bold border ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          {feedbackMsg.type === 'success' ? '✅ ' : '⚠️ '}
          {feedbackMsg.text}
        </div>
      )}

      {/* Methods List */}
      <div className="space-y-4">
        {methods.map((m) => (
          <div
            key={m.id}
            className={`bg-white border rounded-2xl p-5 shadow-2xs space-y-3 transition-all ${
              m.is_enabled ? 'border-zinc-300 ring-1 ring-zinc-950/5' : 'border-zinc-200 bg-zinc-50/50 opacity-75'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                    m.is_enabled ? 'bg-zinc-950 text-white' : 'bg-zinc-200 text-zinc-500'
                  }`}
                >
                  💳
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-zinc-950">
                    {m.display_name || m.method}
                  </h3>
                  <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                    Method Key: {m.method}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleToggle(m)}
                disabled={isSaving}
                className={`px-4 py-1.5 rounded-full text-xs font-black transition-all min-h-[44px] touch-manipulation border ${
                  m.is_enabled
                    ? 'bg-zinc-950 text-white border-zinc-950 shadow-xs'
                    : 'bg-zinc-100 text-zinc-500 border-zinc-200 hover:bg-zinc-200'
                }`}
              >
                {m.is_enabled ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>

            {m.is_enabled && (
              <div className="pt-3 border-t border-zinc-100 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                      Display Title (Shown to Customer)
                    </label>
                    <input
                      type="text"
                      value={m.display_name || ''}
                      onChange={(e) => handleUpdateText(m.method, 'display_name', e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-950 min-h-[44px]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                      Customer Instructions
                    </label>
                    <input
                      type="text"
                      value={m.instructions || ''}
                      onChange={(e) => handleUpdateText(m.method, 'instructions', e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-950 min-h-[44px]"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleSaveDetails(m)}
                    disabled={isSaving}
                    className="text-xs font-bold min-h-[44px]"
                  >
                    Save Method Labels
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
