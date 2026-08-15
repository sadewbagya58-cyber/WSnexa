'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { BranchOrderSecuritySettings, SecurityPresetLevel } from '@/types/database.types';
import { updateBranchOrderSecuritySettingsAction, applySecurityPresetAction } from '@/server/actions/order-security';
import { ContextualHelpButton } from '@/components/help/contextual-help-button';

interface OrderSecuritySettingsProps {
  branchId: string;
  branchName: string;
  initialSettings: BranchOrderSecuritySettings;
}

export function OrderSecuritySettings({
  branchId,
  branchName,
  initialSettings,
}: OrderSecuritySettingsProps) {
  const [settings, setSettings] = useState<BranchOrderSecuritySettings>(initialSettings);
  const [activePreset, setActivePreset] = useState<SecurityPresetLevel>('custom');
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleToggle = (key: keyof BranchOrderSecuritySettings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
    setActivePreset('custom');
  };

  const handleApplyPreset = async (preset: SecurityPresetLevel) => {
    setIsSaving(true);
    setFeedbackMsg(null);
    setActivePreset(preset);

    const res = await applySecurityPresetAction(branchId, preset);
    setIsSaving(false);

    if (res.success) {
      setFeedbackMsg({ type: 'success', text: `Applied ${preset.toUpperCase()} security preset successfully!` });
      // Update local state to match preset values
      if (preset === 'low') {
        setSettings((prev) => ({
          ...prev,
          require_active_qr_session: true,
          require_table_session: true,
          require_customer_account: false,
          require_location_verification: false,
          require_waiter_approval: false,
        }));
      } else if (preset === 'balanced') {
        setSettings((prev) => ({
          ...prev,
          require_active_qr_session: true,
          require_table_session: true,
          require_customer_account: true,
          require_location_verification: false,
          require_waiter_approval: true,
        }));
      } else if (preset === 'high') {
        setSettings((prev) => ({
          ...prev,
          require_active_qr_session: true,
          require_table_session: true,
          require_customer_account: true,
          require_location_verification: true,
          require_waiter_approval: true,
        }));
      }
    } else {
      setFeedbackMsg({ type: 'error', text: res.message || 'Failed to apply security preset.' });
    }
  };

  const handleSaveCustom = async () => {
    setIsSaving(true);
    setFeedbackMsg(null);

    const res = await updateBranchOrderSecuritySettingsAction(branchId, settings);
    setIsSaving(false);

    if (res.success) {
      setFeedbackMsg({ type: 'success', text: 'Order Security settings saved successfully!' });
    } else {
      setFeedbackMsg({ type: 'error', text: res.message || 'Failed to save security settings.' });
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-zinc-950">Order Security Engine</h1>
          <p className="text-xs text-zinc-500 mt-1">
            Configure anti-fake-order controls for <strong className="text-zinc-800">{branchName}</strong>. Protect your venue from remote spam orders and fake checkouts.
          </p>
        </div>
        <div className="shrink-0">
          <ContextualHelpButton explicitSlug="understanding-order-security-levels" />
        </div>
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

      {/* Preset Level Selector */}
      <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-sm text-zinc-950">Security Presets</h3>
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Quick Preset Configuration</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => handleApplyPreset('low')}
            disabled={isSaving}
            className={`p-3 rounded-xl border text-left transition-all active:scale-[0.98] min-h-[44px] touch-manipulation flex flex-col justify-between ${
              activePreset === 'low'
                ? 'border-zinc-950 bg-zinc-950 text-white shadow-xs'
                : 'border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-900'
            }`}
          >
            <div className="font-extrabold text-xs">🟢 Low Security</div>
            <p className={`text-[10px] mt-1 ${activePreset === 'low' ? 'text-zinc-300' : 'text-zinc-500'}`}>
              QR session required. Immediate customer ordering.
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleApplyPreset('balanced')}
            disabled={isSaving}
            className={`p-3 rounded-xl border text-left transition-all active:scale-[0.98] min-h-[44px] touch-manipulation flex flex-col justify-between ${
              activePreset === 'balanced'
                ? 'border-zinc-950 bg-zinc-950 text-white shadow-xs'
                : 'border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-900'
            }`}
          >
            <div className="font-extrabold text-xs">🟡 Balanced</div>
            <p className={`text-[10px] mt-1 ${activePreset === 'balanced' ? 'text-zinc-300' : 'text-zinc-500'}`}>
              Account login + waiter approval for QR orders.
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleApplyPreset('high')}
            disabled={isSaving}
            className={`p-3 rounded-xl border text-left transition-all active:scale-[0.98] min-h-[44px] touch-manipulation flex flex-col justify-between ${
              activePreset === 'high'
                ? 'border-zinc-950 bg-zinc-950 text-white shadow-xs'
                : 'border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-900'
            }`}
          >
            <div className="font-extrabold text-xs">🔴 High Security</div>
            <p className={`text-[10px] mt-1 ${activePreset === 'high' ? 'text-zinc-300' : 'text-zinc-500'}`}>
              QR session + account + location + waiter approval.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setActivePreset('custom')}
            className={`p-3 rounded-xl border text-left transition-all min-h-[44px] touch-manipulation flex flex-col justify-between ${
              activePreset === 'custom'
                ? 'border-zinc-950 bg-zinc-950 text-white shadow-xs'
                : 'border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-900'
            }`}
          >
            <div className="font-extrabold text-xs">⚙️ Custom</div>
            <p className={`text-[10px] mt-1 ${activePreset === 'custom' ? 'text-zinc-300' : 'text-zinc-500'}`}>
              Configure individual controls below.
            </p>
          </button>
        </div>
      </div>

      {/* Security Control Toggles */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-2xs space-y-4">
        <h3 className="font-extrabold text-sm text-zinc-950 border-b border-zinc-100 pb-2">
          Granular Security Controls
        </h3>

        <div className="space-y-3">
          {/* Active QR Session */}
          <div
            onClick={() => handleToggle('require_active_qr_session')}
            className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer min-h-[48px] touch-manipulation ${
              settings.require_active_qr_session
                ? 'bg-zinc-50 border-zinc-300 ring-1 ring-zinc-950/10'
                : 'bg-white border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            <div>
              <h4 className="font-extrabold text-xs text-zinc-950">Require Active QR Visit Session</h4>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Ensures ordering is only allowed from recent valid QR scans. Prevents saved URLs from creating remote orders.
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-black shrink-0 ml-3 ${
                settings.require_active_qr_session ? 'bg-zinc-950 text-white' : 'bg-zinc-100 text-zinc-500'
              }`}
            >
              {settings.require_active_qr_session ? 'ON' : 'OFF'}
            </span>
          </div>

          {/* Customer Account Requirement */}
          <div
            onClick={() => handleToggle('require_customer_account')}
            className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer min-h-[48px] touch-manipulation ${
              settings.require_customer_account
                ? 'bg-zinc-50 border-zinc-300 ring-1 ring-zinc-950/10'
                : 'bg-white border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            <div>
              <h4 className="font-extrabold text-xs text-zinc-950">Require Customer Account Login</h4>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Guests may browse the menu freely, but must authenticate before submitting order checkout.
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-black shrink-0 ml-3 ${
                settings.require_customer_account ? 'bg-zinc-950 text-white' : 'bg-zinc-100 text-zinc-500'
              }`}
            >
              {settings.require_customer_account ? 'ON' : 'OFF'}
            </span>
          </div>

          {/* Geolocation Verification */}
          <div
            onClick={() => handleToggle('require_location_verification')}
            className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer min-h-[48px] touch-manipulation ${
              settings.require_location_verification
                ? 'bg-zinc-50 border-zinc-300 ring-1 ring-zinc-950/10'
                : 'bg-white border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            <div>
              <h4 className="font-extrabold text-xs text-zinc-950">Require Geolocation Verification</h4>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Verifies customer device GPS location is within the venue radius before accepting order.
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-black shrink-0 ml-3 ${
                settings.require_location_verification ? 'bg-zinc-950 text-white' : 'bg-zinc-100 text-zinc-500'
              }`}
            >
              {settings.require_location_verification ? 'ON' : 'OFF'}
            </span>
          </div>

          {/* Waiter Approval Workflow */}
          <div
            onClick={() => handleToggle('require_waiter_approval')}
            className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer min-h-[48px] touch-manipulation ${
              settings.require_waiter_approval
                ? 'bg-zinc-50 border-zinc-300 ring-1 ring-zinc-950/10'
                : 'bg-white border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            <div>
              <h4 className="font-extrabold text-xs text-zinc-950">Require Waiter Approval Before Kitchen</h4>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Submitted QR orders are routed to assigned Service Area waiters for review before reaching the kitchen.
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-black shrink-0 ml-3 ${
                settings.require_waiter_approval ? 'bg-zinc-950 text-white' : 'bg-zinc-100 text-zinc-500'
              }`}
            >
              {settings.require_waiter_approval ? 'ON' : 'OFF'}
            </span>
          </div>

          {/* Verified Online Payment Bypass */}
          <div
            onClick={() => handleToggle('allow_verified_online_payment_bypass')}
            className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer min-h-[48px] touch-manipulation ${
              settings.allow_verified_online_payment_bypass
                ? 'bg-zinc-50 border-zinc-300 ring-1 ring-zinc-950/10'
                : 'bg-white border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            <div>
              <h4 className="font-extrabold text-xs text-zinc-950">Allow Verified Online Payment Bypass</h4>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Orders with server-verified online payment bypass waiter approval and location gates.
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-black shrink-0 ml-3 ${
                settings.allow_verified_online_payment_bypass ? 'bg-zinc-950 text-white' : 'bg-zinc-100 text-zinc-500'
              }`}
            >
              {settings.allow_verified_online_payment_bypass ? 'ON' : 'OFF'}
            </span>
          </div>
        </div>

        {/* Radius & Duration Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-zinc-100">
          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1">
              Geolocation Max Radius (Meters)
            </label>
            <input
              type="number"
              min={10}
              max={10000}
              value={settings.location_radius_meters}
              onChange={(e) =>
                setSettings({ ...settings, location_radius_meters: parseInt(e.target.value) || 150 })
              }
              className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-xs font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-950 min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1">
              QR Session Expiry Duration (Minutes)
            </label>
            <input
              type="number"
              min={5}
              max={1440}
              value={settings.qr_session_duration_minutes}
              onChange={(e) =>
                setSettings({ ...settings, qr_session_duration_minutes: parseInt(e.target.value) || 120 })
              }
              className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-xs font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-950 min-h-[44px]"
            />
          </div>
        </div>

        {/* Submit */}
        <div className="pt-4 flex justify-end">
          <Button
            type="button"
            variant="primary"
            onClick={handleSaveCustom}
            disabled={isSaving}
            className="bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold px-6 min-h-[44px]"
          >
            {isSaving ? 'Saving...' : '💾 Save Security Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}
