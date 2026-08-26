'use client';

import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';

interface OrdersWorkspaceClientProps {
  userRole: string;
  activeBranchName: string;
  canAccessCashier: boolean;
  canAccessKitchen: boolean;
  canAccessWaiter: boolean;
}

export function OrdersWorkspaceClient({
  activeBranchName,
  canAccessCashier,
  canAccessKitchen,
  canAccessWaiter,
}: OrdersWorkspaceClientProps) {
  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
      <PageHeader
        title="Orders & Live Operations"
        description={`Operational POS, Kitchen queue, and Waiter workflow management for ${activeBranchName}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Orders' },
        ]}
      />

      {/* Operational Workspaces Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Cashier POS Card */}
        {canAccessCashier && (
          <Card className="p-6 space-y-4 hover:shadow-md transition-shadow border-zinc-200 bg-white">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl font-black">
              💳
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-zinc-950">Cashier POS</h3>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                Direct point-of-sale checkout, cash register control, split payments, and guest order settlement.
              </p>
            </div>
            <Link
              href="/dashboard/cashier"
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-zinc-950 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800 transition-colors shadow-xs"
            >
              Open Cashier POS ⚡
            </Link>
          </Card>
        )}

        {/* Kitchen Queue Card */}
        {canAccessKitchen && (
          <Card className="p-6 space-y-4 hover:shadow-md transition-shadow border-zinc-200 bg-white">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl font-black">
              👨‍🍳
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-zinc-950">Kitchen Display</h3>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                Live ticket queue, preparation status updates, bump screens, and course management for kitchen staff.
              </p>
            </div>
            <Link
              href="/dashboard/kitchen"
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-zinc-950 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800 transition-colors shadow-xs"
            >
              Open Kitchen Queue ⚡
            </Link>
          </Card>
        )}

        {/* Waiter Service Card */}
        {canAccessWaiter && (
          <Card className="p-6 space-y-4 hover:shadow-md transition-shadow border-zinc-200 bg-white">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl font-black">
              🛎️
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-zinc-950">Waiter Assistance</h3>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                Floor requests, table assistance notifications, handheld ordering, and service calls.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Link
                href="/dashboard/waiter"
                className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-zinc-950 px-3 py-2 text-xs font-bold text-white hover:bg-zinc-800 transition-colors shadow-xs"
              >
                Requests ⚡
              </Link>
              <Link
                href="/dashboard/waiter/menu"
                className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-zinc-100 text-zinc-900 border border-zinc-200 px-3 py-2 text-xs font-extrabold hover:bg-zinc-200 transition-colors"
              >
                Take Order
              </Link>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
