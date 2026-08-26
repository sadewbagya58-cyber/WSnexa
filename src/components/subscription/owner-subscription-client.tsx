'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { SUBSCRIPTION_PLANS, SubscriptionPlanCode } from '@/lib/config/subscription-plans';
import { EnterpriseConfigurator } from '@/components/subscription/enterprise-configurator';

interface OwnerSubscriptionClientProps {
  businessName: string;
  subContext: {
    subscription: {
      plan_code: SubscriptionPlanCode;
    };
    plan: {
      name: string;
      priceLkrMonthly: number | null;
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
  usage: {
    branches: number;
    staff: number;
    tables: number;
    menuItems: number;
    customRoles: number;
  };
}

export function OwnerSubscriptionClient({
  businessName,
  subContext,
  usage,
}: OwnerSubscriptionClientProps) {
  const router = useRouter();
  const { subscription, plan, effectiveStatus, effectiveLimits, daysRemaining } = subContext;
  const [showEnterpriseConfig, setShowEnterpriseConfig] = useState(false);
  const [loadingPlanCode, setLoadingPlanCode] = useState<SubscriptionPlanCode | null>(null);

  const renderStatusBadge = () => {
    switch (effectiveStatus) {
      case 'ACTIVE':
        return <Badge variant="solid" className="bg-emerald-600 text-white font-extrabold px-2.5 py-0.5">ACTIVE</Badge>;
      case 'TRIALING':
        return <Badge variant="solid" className="bg-blue-600 text-white font-extrabold px-2.5 py-0.5">14-DAY TRIAL</Badge>;
      case 'GRACE_PERIOD':
        return <Badge variant="solid" className="bg-amber-600 text-white font-extrabold px-2.5 py-0.5">GRACE PERIOD ({daysRemaining} DAYS LEFT)</Badge>;
      case 'SUSPENDED':
        return <Badge variant="solid" className="bg-rose-600 text-white font-extrabold px-2.5 py-0.5">SUSPENDED</Badge>;
      case 'CANCELLED':
        return <Badge variant="solid" className="bg-zinc-900 text-white font-extrabold border border-zinc-700 px-2.5 py-0.5">CANCELLED</Badge>;
      default:
        return <Badge variant="solid" className="bg-zinc-700 text-white font-extrabold px-2.5 py-0.5">{effectiveStatus}</Badge>;
    }
  };

  const limitsList = [
    { label: 'Active Branches', usage: usage.branches, limit: effectiveLimits.maxBranches },
    { label: 'Active Staff Members', usage: usage.staff, limit: effectiveLimits.maxActiveStaff },
    { label: 'Dining Tables', usage: usage.tables, limit: effectiveLimits.maxTables },
    { label: 'Menu Items', usage: usage.menuItems, limit: effectiveLimits.maxMenuItems },
    { label: 'Custom Roles', usage: usage.customRoles, limit: effectiveLimits.maxCustomRoles },
  ];

  const handleSelectPlan = (code: SubscriptionPlanCode) => {
    if (loadingPlanCode !== null) return;

    if (code === 'enterprise') {
      setShowEnterpriseConfig(true);
    } else {
      setLoadingPlanCode(code);
      router.push(`/dashboard/settings/subscription/checkout?plan=${code}`);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-950">Subscription & Billing</h1>
          <p className="text-sm font-medium text-zinc-600 mt-1">
            Manage your commercial plan, monitor resource usage, and review plan tiers for {businessName}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase text-zinc-500">Status:</span>
          {renderStatusBadge()}
        </div>
      </div>

      {/* Enterprise Configurator Modal */}
      {showEnterpriseConfig && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <EnterpriseConfigurator
            initialBranches={usage.branches || 5}
            initialStaff={usage.staff || 75}
            onCancel={() => setShowEnterpriseConfig(false)}
          />
        </div>
      )}

      {/* Current Plan Overview Banner */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
          <div>
            <div className="text-xs font-black uppercase text-zinc-500">Current Plan</div>
            <div className="text-xl font-black text-zinc-950 flex items-center gap-3 mt-0.5">
              <span>{plan.name}</span>
              {plan.priceLkrMonthly !== null ? (
                <span className="text-sm font-bold text-zinc-600">LKR {plan.priceLkrMonthly.toLocaleString()} / mo</span>
              ) : (
                <span className="text-sm font-bold text-zinc-600">Custom Enterprise Pricing</span>
              )}
            </div>
          </div>
          <div className="text-left sm:text-right">
            <div className="text-xs font-black uppercase text-zinc-500">Period / Expiration</div>
            <div className="text-sm font-bold text-zinc-800 mt-0.5">
              {daysRemaining > 0 ? `${daysRemaining} days remaining` : 'Expired'}
            </div>
          </div>
        </div>

        {/* Usage Progress Meters */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-zinc-700">Resource Usage & Quotas</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {limitsList.map((item, idx) => {
              const isUnlimited = item.limit === null;
              const numericLimit = item.limit ?? 1;
              const percent = isUnlimited ? 0 : Math.min(100, Math.round((item.usage / numericLimit) * 100));
              const isOver = !isUnlimited && item.limit !== null && item.usage >= item.limit;

              return (
                <div key={idx} className="rounded-xl bg-zinc-50 border border-zinc-200/80 p-3.5 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-extrabold text-zinc-800">{item.label}</span>
                    <span className="font-mono text-zinc-600">
                      {item.usage} / {isUnlimited ? '∞' : item.limit}
                    </span>
                  </div>
                  {!isUnlimited ? (
                    <div className="w-full bg-zinc-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full transition-all ${isOver ? 'bg-red-600' : percent > 80 ? 'bg-amber-500' : 'bg-zinc-900'}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  ) : (
                    <div className="text-[11px] font-bold text-emerald-700">Unlimited Capacity</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Plan Tier Selector */}
      <div className="space-y-4">
        <h2 className="text-lg font-black tracking-tight text-zinc-950">Available WSNexa Commercial Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(Object.keys(SUBSCRIPTION_PLANS) as SubscriptionPlanCode[]).map((code) => {
            const item = SUBSCRIPTION_PLANS[code];
            const isCurrent = subscription.plan_code === code;
            const isLoadingThis = loadingPlanCode === code;
            const isDisabled = loadingPlanCode !== null || isCurrent;

            return (
              <div
                key={code}
                className={`rounded-2xl border bg-white p-6 shadow-sm flex flex-col justify-between space-y-6 ${
                  isCurrent ? 'border-zinc-950 ring-2 ring-zinc-950' : 'border-zinc-200'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black text-zinc-950">{item.name}</h3>
                    {isCurrent && (
                      <Badge variant="solid" className="bg-zinc-950 text-white font-extrabold text-[10px] border border-zinc-700 px-2.5 py-0.5">
                        CURRENT
                      </Badge>
                    )}
                  </div>
                  <div className="text-2xl font-black text-zinc-900">
                    {item.priceLkrMonthly !== null ? (
                      <>
                        LKR {item.priceLkrMonthly.toLocaleString()} <span className="text-xs font-normal text-zinc-500">/ mo</span>
                      </>
                    ) : (
                      'From LKR 24,999 / mo'
                    )}
                  </div>
                  <ul className="text-xs font-medium text-zinc-700 space-y-2 border-t border-zinc-100 pt-4">
                    <li>• {item.limits.maxBranches === null ? '5 Included (Customable)' : `${item.limits.maxBranches} Branch(es)`}</li>
                    <li>• {item.limits.maxActiveStaff === null ? '75 Included (Customable)' : `${item.limits.maxActiveStaff} Active Staff`}</li>
                    <li>• {item.limits.maxTables === null ? 'Unlimited' : item.limits.maxTables} Dining Tables</li>
                    <li>• {item.limits.maxMenuItems === null ? 'Unlimited' : item.limits.maxMenuItems} Menu Items</li>
                    <li>• {item.limits.maxCustomRoles === null ? 'Unlimited' : item.limits.maxCustomRoles} Custom Roles</li>
                  </ul>
                </div>

                <div>
                  {isCurrent ? (
                    <button
                      disabled
                      aria-disabled="true"
                      className="w-full h-11 rounded-xl bg-zinc-100/90 text-zinc-500 font-extrabold text-xs border border-zinc-200 cursor-default select-none flex items-center justify-center gap-1.5"
                    >
                      ✓ Active Plan
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isDisabled}
                      onClick={() => handleSelectPlan(code)}
                      className="w-full h-11 rounded-xl bg-zinc-950 hover:bg-zinc-800 active:bg-zinc-900 active:scale-[0.98] text-white font-extrabold text-xs transition-all duration-150 shadow-xs hover:shadow-md cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2"
                    >
                      {isLoadingThis ? (
                        <>
                          <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Opening Checkout...</span>
                        </>
                      ) : (
                        <span>{code === 'enterprise' ? 'Configure Enterprise ⚡' : `Select ${item.name} ⚡`}</span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Manual Activation Notice */}
      <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-4 text-xs text-zinc-600 space-y-1">
        <h4 className="font-bold text-zinc-950">Manual Activation Required</h4>
        <p>
          For enterprise customization, high-volume venues, or custom branch billing, contact WSNexa Support. All activations are handled via server-authoritative entitlement rules.
        </p>
      </div>
    </div>
  );
}
