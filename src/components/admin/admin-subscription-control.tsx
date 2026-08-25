'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SubscriptionPlanCode, SUBSCRIPTION_PLANS } from '@/lib/config/subscription-plans';
import {
  manualActivateSubscriptionAction,
  extendTrialAction,
  extendGracePeriodAction,
  changeSubscriptionPlanAction,
  setEnterpriseOverridesAction,
  suspendSubscriptionAction,
  reactivateSubscriptionAction,
  cancelSubscriptionAction,
} from '@/server/actions/super-admin-subscription';

interface AdminSubscriptionControlProps {
  businessId: string;
  initialSubContext: {
    subscription: {
      id: string;
      business_id: string;
      plan_code: SubscriptionPlanCode;
      status: string;
      trial_starts_at: string;
      trial_ends_at: string;
      current_period_starts_at: string | null;
      current_period_ends_at: string | null;
      grace_ends_at: string | null;
      suspended_at: string | null;
      cancelled_at: string | null;
      max_branches_override: number | null;
      max_staff_override: number | null;
      max_tables_override: number | null;
      max_menu_items_override: number | null;
      max_custom_roles_override: number | null;
      activation_source: string;
      notes: string | null;
    };
    effectiveStatus: string;
    effectiveLimits: {
      maxBranches: number | null;
      maxActiveStaff: number | null;
      maxTables: number | null;
      maxMenuItems: number | null;
      maxCustomRoles: number | null;
    };
    daysRemaining: number;
  };
  initialUsage: {
    branches: number;
    staff: number;
    tables: number;
    menuItems: number;
    customRoles: number;
  };
  initialHistory: Array<{
    id: string;
    event_type: string;
    previous_status: string;
    new_status: string;
    previous_plan: string;
    new_plan: string;
    reason: string;
    created_at: string;
    actor_type: string;
  }>;
}

export function AdminSubscriptionControl({
  businessId,
  initialSubContext,
  initialUsage,
  initialHistory,
}: AdminSubscriptionControlProps) {
  const subContext = initialSubContext;
  const history = initialHistory;
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<{ success: boolean; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [planCode, setPlanCode] = useState<SubscriptionPlanCode>(subContext.subscription.plan_code);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [periodEndDays, setPeriodEndDays] = useState('30');
  const [dateInput, setDateInput] = useState('');

  // Enterprise overrides form state
  const [overrideBranches, setOverrideBranches] = useState<string>(
    subContext.subscription.max_branches_override !== null ? String(subContext.subscription.max_branches_override) : ''
  );
  const [overrideStaff, setOverrideStaff] = useState<string>(
    subContext.subscription.max_staff_override !== null ? String(subContext.subscription.max_staff_override) : ''
  );
  const [overrideTables, setOverrideTables] = useState<string>(
    subContext.subscription.max_tables_override !== null ? String(subContext.subscription.max_tables_override) : ''
  );
  const [overrideMenuItems, setOverrideMenuItems] = useState<string>(
    subContext.subscription.max_menu_items_override !== null ? String(subContext.subscription.max_menu_items_override) : ''
  );
  const [overrideCustomRoles, setOverrideCustomRoles] = useState<string>(
    subContext.subscription.max_custom_roles_override !== null ? String(subContext.subscription.max_custom_roles_override) : ''
  );

  const closeModal = () => {
    setActiveModal(null);
    setReason('');
    setNotes('');
  };

  const handleManualActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    const days = parseInt(periodEndDays, 10) || 30;
    const periodEnd = new Date(Date.now() + days * 86400000).toISOString();

    const res = await manualActivateSubscriptionAction({
      businessId,
      planCode,
      periodEnd,
      reason: reason as 'bank_transfer' | 'pilot_account' | 'complimentary' | 'gateway_issue' | 'other',
      notes,
    });

    setIsSubmitting(false);
    if (res.success) {
      setFeedback({ success: true, text: res.message || 'Subscription activated successfully.' });
      closeModal();
      window.location.reload();
    } else {
      setFeedback({ success: false, text: res.message || 'Activation failed.' });
    }
  };

  const handleExtendTrial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateInput) return;
    setIsSubmitting(true);
    setFeedback(null);

    const res = await extendTrialAction({
      businessId,
      newTrialEnd: new Date(dateInput).toISOString(),
      reason,
    });

    setIsSubmitting(false);
    if (res.success) {
      setFeedback({ success: true, text: res.message || 'Trial extended successfully.' });
      closeModal();
      window.location.reload();
    } else {
      setFeedback({ success: false, text: res.message || 'Trial extension failed.' });
    }
  };

  const handleExtendGrace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateInput) return;
    setIsSubmitting(true);
    setFeedback(null);

    const res = await extendGracePeriodAction({
      businessId,
      newGraceEnd: new Date(dateInput).toISOString(),
      reason,
    });

    setIsSubmitting(false);
    if (res.success) {
      setFeedback({ success: true, text: res.message || 'Grace period extended successfully.' });
      closeModal();
      window.location.reload();
    } else {
      setFeedback({ success: false, text: res.message || 'Grace extension failed.' });
    }
  };

  const handleChangePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    const res = await changeSubscriptionPlanAction({
      businessId,
      newPlanCode: planCode,
      reason,
    });

    setIsSubmitting(false);
    if (res.success) {
      setFeedback({ success: true, text: res.message || 'Plan changed successfully.' });
      closeModal();
      window.location.reload();
    } else {
      setFeedback({ success: false, text: res.message || 'Plan change failed.' });
    }
  };

  const handleSetEnterpriseOverrides = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    const parseVal = (str: string) => (str.trim() === '' ? null : parseInt(str, 10));

    const res = await setEnterpriseOverridesAction({
      businessId,
      overrides: {
        maxBranches: parseVal(overrideBranches),
        maxActiveStaff: parseVal(overrideStaff),
        maxTables: parseVal(overrideTables),
        maxMenuItems: parseVal(overrideMenuItems),
        maxCustomRoles: parseVal(overrideCustomRoles),
      },
      reason,
    });

    setIsSubmitting(false);
    if (res.success) {
      setFeedback({ success: true, text: res.message || 'Enterprise overrides updated successfully.' });
      closeModal();
      window.location.reload();
    } else {
      setFeedback({ success: false, text: res.message || 'Failed to update overrides.' });
    }
  };

  const handleSuspend = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    const res = await suspendSubscriptionAction({
      businessId,
      reason,
    });

    setIsSubmitting(false);
    if (res.success) {
      setFeedback({ success: true, text: res.message || 'Subscription commercially suspended.' });
      closeModal();
      window.location.reload();
    } else {
      setFeedback({ success: false, text: res.message || 'Suspension failed.' });
    }
  };

  const handleReactivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    const days = parseInt(periodEndDays, 10) || 30;
    const periodEnd = new Date(Date.now() + days * 86400000).toISOString();

    const res = await reactivateSubscriptionAction({
      businessId,
      planCode,
      periodEnd,
      reason,
    });

    setIsSubmitting(false);
    if (res.success) {
      setFeedback({ success: true, text: res.message || 'Subscription reactivated.' });
      closeModal();
      window.location.reload();
    } else {
      setFeedback({ success: false, text: res.message || 'Reactivation failed.' });
    }
  };

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    const res = await cancelSubscriptionAction({
      businessId,
      reason,
    });

    setIsSubmitting(false);
    if (res.success) {
      setFeedback({ success: true, text: res.message || 'Subscription explicitly cancelled.' });
      closeModal();
      window.location.reload();
    } else {
      setFeedback({ success: false, text: res.message || 'Cancellation failed.' });
    }
  };

  const { subscription, effectiveStatus, effectiveLimits } = subContext;

  const renderStatusBadge = (statusStr: string) => {
    switch (statusStr.toUpperCase()) {
      case 'ACTIVE':
        return <Badge className="bg-emerald-600 text-white font-black text-[10px]">ACTIVE</Badge>;
      case 'TRIALING':
        return <Badge className="bg-blue-600 text-white font-black text-[10px]">TRIALING</Badge>;
      case 'GRACE_PERIOD':
        return <Badge className="bg-amber-600 text-white font-black text-[10px]">GRACE PERIOD</Badge>;
      case 'SUSPENDED':
        return <Badge className="bg-red-600 text-white font-black text-[10px]">SUSPENDED</Badge>;
      case 'CANCELLED':
        return <Badge className="bg-zinc-700 text-white font-black text-[10px]">CANCELLED</Badge>;
      default:
        return <Badge className="bg-zinc-500 text-white font-black text-[10px]">{statusStr}</Badge>;
    }
  };

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
        <div>
          <h2 className="text-base font-black text-zinc-950 uppercase tracking-wider">
            Commercial SaaS Subscription Control
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5 font-medium">
            Super Admin manual activation, trial/grace extensions, plan changes, and quota overrides.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-zinc-500 uppercase">Effective:</span>
          {renderStatusBadge(effectiveStatus)}
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs font-bold ${
            feedback.success
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Subscription Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-zinc-50/70 p-4 rounded-2xl border border-zinc-200/80 text-xs">
        <div>
          <span className="text-zinc-500 font-bold uppercase text-[10px] block">Current Plan</span>
          <span className="font-extrabold text-zinc-950 text-sm">
            {SUBSCRIPTION_PLANS[subscription.plan_code]?.name || subscription.plan_code}
          </span>
        </div>
        <div>
          <span className="text-zinc-500 font-bold uppercase text-[10px] block">Stored Status</span>
          <span className="font-extrabold text-zinc-900 capitalize">{subscription.status}</span>
        </div>
        <div>
          <span className="text-zinc-500 font-bold uppercase text-[10px] block">Activation Source</span>
          <span className="font-mono text-zinc-800">{subscription.activation_source || 'system'}</span>
        </div>
        <div>
          <span className="text-zinc-500 font-bold uppercase text-[10px] block">Period / Expiration</span>
          <span className="font-bold text-zinc-800">
            {subscription.current_period_ends_at
              ? new Date(subscription.current_period_ends_at).toLocaleDateString()
              : subscription.trial_ends_at
              ? `Trial: ${new Date(subscription.trial_ends_at).toLocaleDateString()}`
              : 'N/A'}
          </span>
        </div>
      </div>

      {/* Usage Progress Overview */}
      <div className="space-y-2">
        <h3 className="text-xs font-black uppercase tracking-wider text-zinc-700">Live Quotas & Resource Usage</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: 'Branches', usage: initialUsage.branches, limit: effectiveLimits.maxBranches },
            { label: 'Active Staff', usage: initialUsage.staff, limit: effectiveLimits.maxActiveStaff },
            { label: 'Tables', usage: initialUsage.tables, limit: effectiveLimits.maxTables },
            { label: 'Menu Items', usage: initialUsage.menuItems, limit: effectiveLimits.maxMenuItems },
            { label: 'Custom Roles', usage: initialUsage.customRoles, limit: effectiveLimits.maxCustomRoles },
          ].map((item, idx) => (
            <div key={idx} className="p-3 bg-white rounded-xl border border-zinc-200/80 space-y-1">
              <span className="text-[11px] font-bold text-zinc-600 block">{item.label}</span>
              <span className="text-xs font-mono font-extrabold text-zinc-950">
                {item.usage} / {item.limit === null ? '∞' : item.limit}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Super Admin Action Controls */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-100">
        <Button size="sm" onClick={() => setActiveModal('manual_activate')} className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs">
          ⚡ Manual Activate
        </Button>
        <Button size="sm" variant="outline" onClick={() => setActiveModal('extend_trial')} className="font-bold text-xs">
          ⏳ Extend Trial
        </Button>
        <Button size="sm" variant="outline" onClick={() => setActiveModal('extend_grace')} className="font-bold text-xs">
          🛡️ Extend Grace
        </Button>
        <Button size="sm" variant="outline" onClick={() => setActiveModal('change_plan')} className="font-bold text-xs">
          🔄 Change Plan
        </Button>
        <Button size="sm" variant="outline" onClick={() => setActiveModal('enterprise_overrides')} className="font-bold text-xs">
          ⚙️ Custom Limits
        </Button>
        {effectiveStatus !== 'SUSPENDED' ? (
          <Button size="sm" variant="destructive" onClick={() => setActiveModal('suspend')} className="font-bold text-xs">
            🚫 Suspend
          </Button>
        ) : (
          <Button size="sm" onClick={() => setActiveModal('reactivate')} className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs">
            ✅ Reactivate
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => setActiveModal('cancel')} className="text-zinc-600 font-bold text-xs">
          ❌ Cancel
        </Button>
      </div>

      {/* Subscription Event History */}
      <div className="space-y-3 pt-4 border-t border-zinc-100">
        <h3 className="text-xs font-black uppercase tracking-wider text-zinc-700">Subscription History Log</h3>
        {history.length === 0 ? (
          <div className="text-xs text-zinc-500 font-medium">No subscription events recorded yet.</div>
        ) : (
          <div className="max-h-48 overflow-y-auto space-y-2 border rounded-2xl p-3 bg-zinc-50/50">
            {history.map((evt) => (
              <div key={evt.id} className="text-xs p-2.5 bg-white rounded-xl border border-zinc-200/80 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="font-extrabold text-zinc-900 uppercase text-[10px] bg-zinc-100 px-2 py-0.5 rounded-md mr-2">
                    {evt.event_type}
                  </span>
                  <span className="text-zinc-700 font-medium">{evt.reason}</span>
                </div>
                <div className="text-right text-[11px] font-mono text-zinc-500">
                  {new Date(evt.created_at).toLocaleDateString()} {new Date(evt.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── MODALS ───────────────────────────────────────────────────────────── */}

      {/* Manual Activation Modal */}
      {activeModal === 'manual_activate' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleManualActivate} className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-zinc-950 uppercase tracking-wider">Manual Subscription Activation</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-zinc-700 mb-1">Plan Tier</label>
                <select
                  value={planCode}
                  onChange={(e) => setPlanCode(e.target.value as SubscriptionPlanCode)}
                  className="w-full border rounded-xl p-2.5 font-bold"
                >
                  <option value="starter">Starter (LKR 4,499/mo)</option>
                  <option value="growth">Growth (LKR 8,999/mo)</option>
                  <option value="enterprise">Enterprise (Custom)</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-zinc-700 mb-1">Period Duration</label>
                <select
                  value={periodEndDays}
                  onChange={(e) => setPeriodEndDays(e.target.value)}
                  className="w-full border rounded-xl p-2.5 font-bold"
                >
                  <option value="30">1 Month (+30 Days)</option>
                  <option value="90">3 Months (+90 Days)</option>
                  <option value="365">1 Year (+365 Days)</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-zinc-700 mb-1">Activation Reason</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full border rounded-xl p-2.5 font-bold"
                  required
                >
                  <option value="">Select Reason...</option>
                  <option value="bank_transfer">Bank Transfer Received</option>
                  <option value="pilot_account">Pilot Partner Business</option>
                  <option value="complimentary">Complimentary Access</option>
                  <option value="gateway_issue">Online Payment Gateway Fallback</option>
                  <option value="other">Other (Requires Notes)</option>
                </select>
              </div>
              {reason === 'other' && (
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Audit Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Provide context for manual activation..."
                    className="w-full border rounded-xl p-2.5 font-medium"
                    required
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={closeModal} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !reason} className="bg-emerald-600 text-white font-extrabold">
                {isSubmitting ? 'Activating...' : 'Activate Subscription'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Extend Trial Modal */}
      {activeModal === 'extend_trial' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleExtendTrial} className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-zinc-950 uppercase tracking-wider">Extend Trial Period</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-zinc-700 mb-1">New Trial End Date</label>
                <input
                  type="date"
                  value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)}
                  className="w-full border rounded-xl p-2.5 font-mono"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-zinc-700 mb-1">Reason for Extension</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Provide reason..."
                  className="w-full border rounded-xl p-2.5 font-medium"
                  required
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={closeModal} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !dateInput || !reason} className="bg-zinc-950 text-white font-bold">
                {isSubmitting ? 'Extending...' : 'Extend Trial'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Extend Grace Modal */}
      {activeModal === 'extend_grace' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleExtendGrace} className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-zinc-950 uppercase tracking-wider">Extend Grace Period</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-zinc-700 mb-1">New Grace End Date</label>
                <input
                  type="date"
                  value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)}
                  className="w-full border rounded-xl p-2.5 font-mono"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-zinc-700 mb-1">Reason for Extension</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Provide reason..."
                  className="w-full border rounded-xl p-2.5 font-medium"
                  required
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={closeModal} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !dateInput || !reason} className="bg-zinc-950 text-white font-bold">
                {isSubmitting ? 'Extending...' : 'Extend Grace'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Change Plan Modal */}
      {activeModal === 'change_plan' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleChangePlan} className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-zinc-950 uppercase tracking-wider">Change Subscription Plan</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-zinc-700 mb-1">New Plan</label>
                <select
                  value={planCode}
                  onChange={(e) => setPlanCode(e.target.value as SubscriptionPlanCode)}
                  className="w-full border rounded-xl p-2.5 font-bold"
                >
                  <option value="starter">Starter (1 branch, 10 staff, 50 tables)</option>
                  <option value="growth">Growth (3 branches, 40 staff, 150 tables)</option>
                  <option value="enterprise">Enterprise (Custom / Unlimited)</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-zinc-700 mb-1">Reason for Change</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Provide reason..."
                  className="w-full border rounded-xl p-2.5 font-medium"
                  required
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={closeModal} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !reason} className="bg-zinc-950 text-white font-bold">
                {isSubmitting ? 'Updating...' : 'Update Plan'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Enterprise Overrides Modal */}
      {activeModal === 'enterprise_overrides' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleSetEnterpriseOverrides} className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-zinc-950 uppercase tracking-wider">Set Custom Quota Overrides</h3>
            <p className="text-xs text-zinc-500 font-medium">Leave blank for plan defaults / unlimited.</p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold text-zinc-700 mb-1">Max Branches</label>
                <input
                  type="number"
                  placeholder="Unlimited (blank)"
                  value={overrideBranches}
                  onChange={(e) => setOverrideBranches(e.target.value)}
                  className="w-full border rounded-xl p-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-zinc-700 mb-1">Max Active Staff</label>
                <input
                  type="number"
                  placeholder="Unlimited (blank)"
                  value={overrideStaff}
                  onChange={(e) => setOverrideStaff(e.target.value)}
                  className="w-full border rounded-xl p-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-zinc-700 mb-1">Max Tables</label>
                <input
                  type="number"
                  placeholder="Unlimited (blank)"
                  value={overrideTables}
                  onChange={(e) => setOverrideTables(e.target.value)}
                  className="w-full border rounded-xl p-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-zinc-700 mb-1">Max Menu Items</label>
                <input
                  type="number"
                  placeholder="Unlimited (blank)"
                  value={overrideMenuItems}
                  onChange={(e) => setOverrideMenuItems(e.target.value)}
                  className="w-full border rounded-xl p-2 font-mono"
                />
              </div>
              <div className="col-span-2">
                <label className="block font-bold text-zinc-700 mb-1">Max Custom Roles</label>
                <input
                  type="number"
                  placeholder="Unlimited (blank)"
                  value={overrideCustomRoles}
                  onChange={(e) => setOverrideCustomRoles(e.target.value)}
                  className="w-full border rounded-xl p-2 font-mono"
                />
              </div>
              <div className="col-span-2">
                <label className="block font-bold text-zinc-700 mb-1">Reason for Override</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Provide reason..."
                  className="w-full border rounded-xl p-2.5 font-medium"
                  required
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={closeModal} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !reason} className="bg-zinc-950 text-white font-bold">
                {isSubmitting ? 'Saving...' : 'Save Overrides'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Suspend Modal */}
      {activeModal === 'suspend' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleSuspend} className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-red-600 uppercase tracking-wider">Suspend Subscription</h3>
            <p className="text-xs text-zinc-600 leading-relaxed font-medium">
              This will commercially suspend operational modules for this business. It does NOT touch platform business status.
            </p>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-zinc-700 mb-1">Reason for Suspension</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Non-payment, policy violation, customer request..."
                  className="w-full border rounded-xl p-2.5 font-medium"
                  required
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={closeModal} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !reason} variant="destructive" className="font-extrabold">
                {isSubmitting ? 'Suspending...' : 'Confirm Suspension'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Reactivate Modal */}
      {activeModal === 'reactivate' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleReactivate} className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-zinc-950 uppercase tracking-wider">Reactivate Subscription</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-zinc-700 mb-1">Plan Tier</label>
                <select
                  value={planCode}
                  onChange={(e) => setPlanCode(e.target.value as SubscriptionPlanCode)}
                  className="w-full border rounded-xl p-2.5 font-bold"
                >
                  <option value="starter">Starter</option>
                  <option value="growth">Growth</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-zinc-700 mb-1">Period Duration</label>
                <select
                  value={periodEndDays}
                  onChange={(e) => setPeriodEndDays(e.target.value)}
                  className="w-full border rounded-xl p-2.5 font-bold"
                >
                  <option value="30">1 Month (+30 Days)</option>
                  <option value="90">3 Months (+90 Days)</option>
                  <option value="365">1 Year (+365 Days)</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-zinc-700 mb-1">Reactivation Reason</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Payment resolved, manual agreement..."
                  className="w-full border rounded-xl p-2.5 font-medium"
                  required
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={closeModal} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !reason} className="bg-blue-600 text-white font-extrabold">
                {isSubmitting ? 'Reactivating...' : 'Reactivate'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Cancel Modal */}
      {activeModal === 'cancel' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleCancel} className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-red-600 uppercase tracking-wider">Cancel Subscription</h3>
            <p className="text-xs text-zinc-600 leading-relaxed font-medium">
              This explicitly cancels the subscription. Tenant data (branches, staff, orders, menu) will remain 100% intact.
            </p>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-zinc-700 mb-1">Reason for Cancellation</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Business closed, switched software..."
                  className="w-full border rounded-xl p-2.5 font-medium"
                  required
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={closeModal} disabled={isSubmitting}>
                Back
              </Button>
              <Button type="submit" disabled={isSubmitting || !reason} variant="destructive" className="font-extrabold">
                {isSubmitting ? 'Cancelling...' : 'Confirm Cancellation'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
