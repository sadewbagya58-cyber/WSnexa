import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';

import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { resolveAuthorizationContext } from '@/server/auth/authorization-context';
import { resolveDashboardHomeModel } from '@/server/navigation/dashboard-home-model';
import { fetchDashboardTodayData } from '@/server/navigation/dashboard-today-data';
import { OwnerSubscriptionLifecycleBanner } from '@/components/subscription/owner-subscription-lifecycle-banner';
import { DashboardTodayMetrics } from '@/components/dashboard/dashboard-today-metrics';
import { DashboardNeedsAttention } from '@/components/dashboard/dashboard-needs-attention';
import { DashboardOperationsShortcuts } from '@/components/dashboard/dashboard-operations-shortcuts';
import { DashboardQuickActions } from '@/components/dashboard/dashboard-quick-actions';
import { DashboardSetupProgress } from '@/components/dashboard/dashboard-setup-progress';

export default async function DashboardOverviewPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role, context?.membership?.customRoleId)} />;
  }
  if (!context || !context.activeBranch) {
    redirect('/login');
  }

  const { business, activeBranch } = context;

  // 1. Resolve AuthorizationContext and Capability Model
  let authContext: Awaited<ReturnType<typeof resolveAuthorizationContext>>;
  try {
    authContext = await resolveAuthorizationContext();
  } catch {
    redirect('/login');
  }

  const model = await resolveDashboardHomeModel(authContext);

  // 2. Fetch Today Operational Metrics & Attention Signals in Single Server Pass
  const todayData = await fetchDashboardTodayData(
    business.id,
    activeBranch,
    model,
    business.defaultCurrency || 'USD'
  );

  // 3. Capability-Gated Header Actions
  let primaryAction: React.ReactNode = null;
  let secondaryActions: React.ReactNode = null;

  if (model.canCreateOrders) {
    primaryAction = (
      <Link
        href="/dashboard/cashier"
        className="flex min-h-[44px] items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-500 transition-colors shadow-xs touch-manipulation"
      >
        💳 Open Cashier POS
      </Link>
    );
  } else if (model.canManageTables || model.isBusinessOwner) {
    primaryAction = (
      <Link
        href="/dashboard/dining"
        className="flex min-h-[44px] items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-zinc-950 rounded-xl hover:bg-zinc-800 transition-colors shadow-xs touch-manipulation"
      >
        🍽️ Manage Dining
      </Link>
    );
  } else if (model.canViewKitchen) {
    primaryAction = (
      <Link
        href="/dashboard/kitchen"
        className="flex min-h-[44px] items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-amber-600 rounded-xl hover:bg-amber-500 transition-colors shadow-xs touch-manipulation"
      >
        👨‍🍳 Kitchen Queue
      </Link>
    );
  } else if (model.canManageWaiter) {
    primaryAction = (
      <Link
        href="/dashboard/waiter"
        className="flex min-h-[44px] items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-500 transition-colors shadow-xs touch-manipulation"
      >
        📋 Waiter Terminal
      </Link>
    );
  }

  if (model.canManageMenu || model.isBusinessOwner) {
    secondaryActions = (
      <Link
        href="/dashboard/menu/items"
        className="flex min-h-[44px] items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-zinc-700 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 active:bg-zinc-100 transition-colors touch-manipulation"
      >
        + Add Menu Item
      </Link>
    );
  } else if (model.canViewReports) {
    secondaryActions = (
      <Link
        href="/dashboard/reports"
        className="flex min-h-[44px] items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-zinc-700 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 active:bg-zinc-100 transition-colors touch-manipulation"
      >
        📈 View Analytics
      </Link>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Page Header (Concise — timezone de-emphasized) */}
      <PageHeader
        title={`Welcome to ${business.name}`}
        description={`Active Branch: ${activeBranch.name}`}
        breadcrumbs={[{ label: 'Dashboard Overview' }]}
        primaryAction={primaryAction}
        secondaryActions={secondaryActions}
      />

      {/* 2. Business Owner Subscription Lifecycle Banner */}
      <OwnerSubscriptionLifecycleBanner
        subscription={context.subscription}
        isBusinessOwner={model.isBusinessOwner}
      />

      {/* 3. Fallback Mode for Highly Restricted / Non-Operational Users */}
      {model.isFallbackMode ? (
        <Card className="p-8 text-center space-y-4 max-w-xl mx-auto border-dashed border-zinc-300">
          <div className="text-4xl">🛡️</div>
          <h2 className="text-lg font-bold text-zinc-950">Active Branch Workspace</h2>
          <p className="text-xs text-zinc-600 leading-relaxed">
            Welcome to <span className="font-semibold text-zinc-900">{business.name}</span> ({activeBranch.name}). You are logged in with effective role capability access. Select an authorized module from the sidebar navigation to begin.
          </p>
          <div className="pt-2">
            <Link
              href="/dashboard/help"
              className="inline-flex min-h-[44px] items-center gap-1.5 px-4 py-2 text-xs font-bold text-zinc-800 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-colors touch-manipulation"
            >
              📖 Open Help Center
            </Link>
          </div>
        </Card>
      ) : (
        <>
          {/* 4. Needs Attention Section (Conditional — disappears when nothing needs action) */}
          <DashboardNeedsAttention items={todayData.attentionItems} />

          {/* 5. Today's Key Metrics Overview (Permission-Gated) */}
          <DashboardTodayMetrics data={todayData} model={model} />

          {/* 6. Live Operational Terminals (Compact chip row — not oversized hero cards) */}
          <DashboardOperationsShortcuts model={model} />

          {/* 7. Quick Actions (High-frequency, permission-filtered) */}
          {model.quickActions.length > 0 && (
            <DashboardQuickActions actions={model.quickActions} />
          )}

          {/* 8. Setup Progress (Conditional — collapses/disappears when setup is complete) */}
          {model.showSetupChecklist && (
            <DashboardSetupProgress
              businessName={business.name}
              categoriesCount={todayData.categoriesCount}
              menuItemsCount={todayData.menuItemsCount}
              serviceAreasCount={todayData.serviceAreasCount}
              tablesCount={todayData.tablesCount}
              setupComplete={todayData.setupComplete}
            />
          )}
        </>
      )}
    </div>
  );
}
