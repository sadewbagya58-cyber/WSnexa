import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';

import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { resolveAuthorizationContext } from '@/server/auth/authorization-context';
import { resolveDashboardHomeModel } from '@/server/navigation/dashboard-home-model';
import { resolveDashboardNavigation } from '@/server/navigation/navigation-engine';
import { fetchDashboardTodayData } from '@/server/navigation/dashboard-today-data';
import { OwnerSubscriptionLifecycleBanner } from '@/components/subscription/owner-subscription-lifecycle-banner';
import { DashboardTodayMetrics } from '@/components/dashboard/dashboard-today-metrics';
import { DashboardNeedsAttention } from '@/components/dashboard/dashboard-needs-attention';
import { DashboardOperationsShortcuts } from '@/components/dashboard/dashboard-operations-shortcuts';
import { DashboardQuickActions } from '@/components/dashboard/dashboard-quick-actions';
import { DashboardSetupProgress } from '@/components/dashboard/dashboard-setup-progress';
import { DashboardFallbackWorkspace } from '@/components/dashboard/dashboard-fallback-workspace';
import { SetupJourneyService } from '@/server/setup/setup-journey.service';

export default async function DashboardOverviewPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard');
  if (!allowed) {
    return (
      <AccessDenied
        workspaceRoute={resolveDefaultWorkspaceRoute(
          context?.membership?.role,
          context?.membership?.customRoleId
        )}
      />
    );
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
  const navSections = resolveDashboardNavigation(authContext);

  // 2. Fetch Today Operational Metrics & Attention Signals in Single Server Pass
  const [todayData, setupReport] = await Promise.all([
    fetchDashboardTodayData(
      business.id,
      activeBranch,
      model,
      business.defaultCurrency || 'USD'
    ),
    (model.showSetupChecklist || model.isBusinessOwner)
      ? SetupJourneyService.resolveSetupJourney(business.id, activeBranch, authContext)
      : Promise.resolve(undefined),
  ]);

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

      {/* 3. Setup Assistant (Prominently placed at top for new/incomplete venues; disappears on completion/dismissal) */}
      {(model.showSetupChecklist || model.isBusinessOwner) && (
        <DashboardSetupProgress
          businessName={business.name}
          report={setupReport}
          categoriesCount={todayData.categoriesCount}
          menuItemsCount={todayData.menuItemsCount}
          serviceAreasCount={todayData.serviceAreasCount}
          tablesCount={todayData.tablesCount}
          setupComplete={todayData.setupComplete}
        />
      )}

      {/* 4. Fallback Mode for Restricted / Non-Operational Roles */}
      {model.isFallbackMode ? (
        <DashboardFallbackWorkspace
          businessName={business.name}
          activeBranchName={activeBranch.name}
          accessibleSections={navSections}
        />
      ) : (
        <>
          {/* 5. Needs Attention Section (Conditional — disappears when nothing needs action) */}
          <DashboardNeedsAttention items={todayData.attentionItems} />

          {/* 6. Today's Key Metrics Overview (Permission-Gated) */}
          <DashboardTodayMetrics data={todayData} model={model} />

          {/* 7. Live Operational Terminals (Compact chip row — not oversized hero cards) */}
          <DashboardOperationsShortcuts model={model} />

          {/* 8. Quick Actions (High-frequency, permission-filtered) */}
          {model.quickActions.length > 0 && (
            <DashboardQuickActions actions={model.quickActions} />
          )}
        </>
      )}
    </div>
  );
}
