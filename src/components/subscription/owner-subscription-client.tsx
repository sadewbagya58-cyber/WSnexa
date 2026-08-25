'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { SUBSCRIPTION_PLANS, SubscriptionPlanCode } from '@/lib/config/subscription-plans';

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
  const { subscription, plan, effectiveStatus, effectiveLimits, daysRemaining } = subContext;
  const [selectedPlanForNotice, setSelectedPlanForNotice] = useState<string | null>(null);

  const renderStatusBadge = () => {
    switch (effectiveStatus) {
      case 'ACTIVE':
        return <Badge className="bg-emerald-600 text-white font-black">ACTIVE</Badge>;
      case 'TRIALING':
        return <Badge className="bg-blue-600 text-white font-black">14-DAY TRIAL</Badge>;
      case 'GRACE_PERIOD':
        return <Badge className="bg-amber-600 text-white font-black">GRACE PERIOD ({daysRemaining} DAYS LEFT)</Badge>;
      case 'SUSPENDED':
        return <Badge className="bg-red-600 text-white font-black">SUSPENDED</Badge>;
      case 'CANCELLED':
        return <Badge className="bg-zinc-700 text-white font-black">CANCELLED</Badge>;
      default:
        return <Badge className="bg-zinc-500 text-white font-black">{effectiveStatus}</Badge>;
    }
  };

  const limitsList = [
    { label: 'Active Branches', usage: usage.branches, limit: effectiveLimits.maxBranches },
    { label: 'Active Staff Members', usage: usage.staff, limit: effectiveLimits.maxActiveStaff },
    { label: 'Dining Tables', usage: usage.tables, limit: effectiveLimits.maxTables },
    { label: 'Menu Items', usage: usage.menuItems, limit: effectiveLimits.maxMenuItems },
    { label: 'Custom Roles', usage: usage.customRoles, limit: effectiveLimits.maxCustomRoles },
  ];

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

      {/* Payment Notice Modal */}
      {selectedPlanForNotice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl text-center">
            <div className="w-14 h-14 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center text-2xl mx-auto shadow-xs">
              💳
            </div>
            <h3 className="text-lg font-black text-zinc-950 uppercase tracking-wider">
              Manual Activation Required
            </h3>
            <p className="text-xs text-zinc-600 leading-relaxed font-medium">
              Online subscription payments are coming soon. To upgrade or renew your plan to{' '}
              <span className="font-extrabold text-zinc-950">{selectedPlanForNotice}</span>, please contact WSNexa support or sales for bank transfer / manual activation.
            </p>
            <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-left text-xs space-y-1 font-mono text-zinc-700">
              <div className="font-extrabold uppercase text-[10px] text-zinc-500">Billing Contact</div>
              <div>Email: billing@wsnexa.internal</div>
              <div>Sales: +94 (11) 234-5678</div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedPlanForNotice(null)}
              className="w-full py-2.5 bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm"
            >
              Close Notice
            </button>
          </div>
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
                <span className="text-sm font-bold text-zinc-600">Custom Pricing</span>
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
                    {isCurrent && <Badge className="bg-zinc-950 text-white font-extrabold text-[10px]">CURRENT</Badge>}
                  </div>
                  <div className="text-2xl font-black text-zinc-900">
                    {item.priceLkrMonthly !== null ? (
                      <>
                        LKR {item.priceLkrMonthly.toLocaleString()} <span className="text-xs font-normal text-zinc-500">/ mo</span>
                      </>
                    ) : (
                      'Contact Sales'
                    )}
                  </div>
                  <ul className="text-xs font-medium text-zinc-700 space-y-2 border-t border-zinc-100 pt-4">
                    <li>• {item.limits.maxBranches === null ? 'Unlimited' : item.limits.maxBranches} Branch(es)</li>
                    <li>• {item.limits.maxActiveStaff === null ? 'Unlimited' : item.limits.maxActiveStaff} Active Staff</li>
                    <li>• {item.limits.maxTables === null ? 'Unlimited' : item.limits.maxTables} Dining Tables</li>
                    <li>• {item.limits.maxMenuItems === null ? 'Unlimited' : item.limits.maxMenuItems} Menu Items</li>
                    <li>• {item.limits.maxCustomRoles === null ? 'Unlimited' : item.limits.maxCustomRoles} Custom Roles</li>
                  </ul>
                </div>

                <div>
                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full py-2.5 rounded-xl bg-zinc-100 text-zinc-500 font-bold text-xs cursor-default"
                    >
                      Active Plan
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSelectedPlanForNotice(item.name)}
                      className="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-extrabold text-xs transition-colors shadow-sm"
                    >
                      Select {item.name}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
