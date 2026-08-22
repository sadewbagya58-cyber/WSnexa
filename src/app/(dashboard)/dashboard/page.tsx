import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/page-header';

import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { resolveAuthorizationContext } from '@/server/auth/authorization-context';
import { resolveDashboardHomeModel } from '@/server/navigation/dashboard-home-model';

export default async function DashboardOverviewPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
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
  const supabase = await createClient();

  // 2. Perform Conditional DB Data Fetching (Prevent N+1 & Skip Hidden Cards)
  const menuCategoriesPromise = model.showMenuStatsCard
    ? supabase
        .from('menu_categories')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', business.id)
        .eq('branch_id', activeBranch.id)
        .is('deleted_at', null)
    : Promise.resolve({ count: 0 });

  const menuItemsPromise = model.showMenuStatsCard
    ? supabase
        .from('menu_items')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', business.id)
        .eq('branch_id', activeBranch.id)
        .is('deleted_at', null)
    : Promise.resolve({ count: 0 });

  const serviceAreasPromise = model.showDiningStatsCard
    ? supabase
        .from('service_areas')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', business.id)
        .eq('branch_id', activeBranch.id)
        .is('deleted_at', null)
    : Promise.resolve({ count: 0 });

  const diningTablesPromise = model.showDiningStatsCard
    ? supabase
        .from('dining_tables')
        .select('id, status')
        .eq('business_id', business.id)
        .eq('branch_id', activeBranch.id)
        .is('deleted_at', null)
    : Promise.resolve({ data: [] });

  const auditLogsPromise = model.showAuditLogs
    ? supabase
        .from('audit_logs')
        .select('id, action, target_type, created_at')
        .eq('business_id', business.id)
        .order('created_at', { ascending: false })
        .limit(5)
    : Promise.resolve({ data: [] });

  const inventoryItemsPromise = model.showInventoryCard
    ? supabase
        .from('inventory_items')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', business.id)
        .is('deleted_at', null)
    : Promise.resolve({ count: 0 });

  const [
    { count: categoriesCount },
    { count: itemsCount },
    { count: areasCount },
    { data: tablesData },
    { data: auditLogs },
    { count: stockItemsCount },
  ] = await Promise.all([
    menuCategoriesPromise,
    menuItemsPromise,
    serviceAreasPromise,
    diningTablesPromise,
    auditLogsPromise,
    inventoryItemsPromise,
  ]);

  const tablesCount = tablesData?.length || 0;
  const availableTablesCount = tablesData?.filter((t) => t.status === 'available').length || 0;
  const occupiedTablesCount = tablesData?.filter((t) => t.status === 'occupied').length || 0;
  const reservedTablesCount = tablesData?.filter((t) => t.status === 'reserved').length || 0;

  const menuComplete = (categoriesCount || 0) > 0 && (itemsCount || 0) > 0;
  const tablesComplete = (areasCount || 0) > 0 && tablesCount > 0;

  // 3. Capability-Gated Header Actions
  let primaryAction: React.ReactNode = null;
  let secondaryActions: React.ReactNode = null;

  if (model.canManageTables || model.isBusinessOwner) {
    primaryAction = (
      <Link
        href="/dashboard/dining"
        className="flex min-h-[44px] items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-zinc-950 rounded-xl hover:bg-zinc-800 transition-colors shadow-xs"
      >
        🍽️ Dining Setup
      </Link>
    );
  } else if (model.canCreateOrders) {
    primaryAction = (
      <Link
        href="/dashboard/cashier"
        className="flex min-h-[44px] items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-500 transition-colors shadow-xs"
      >
        💳 Open Cashier POS
      </Link>
    );
  } else if (model.canViewKitchen) {
    primaryAction = (
      <Link
        href="/dashboard/kitchen"
        className="flex min-h-[44px] items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-amber-600 rounded-xl hover:bg-amber-500 transition-colors shadow-xs"
      >
        👨‍🍳 Open Kitchen Display
      </Link>
    );
  } else if (model.canManageWaiter) {
    primaryAction = (
      <Link
        href="/dashboard/waiter"
        className="flex min-h-[44px] items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-500 transition-colors shadow-xs"
      >
        📋 Waiter Terminal
      </Link>
    );
  }

  if (model.canManageMenu || model.isBusinessOwner) {
    secondaryActions = (
      <Link
        href="/dashboard/menu/items"
        className="flex min-h-[44px] items-center gap-1.5 px-3 py-2 text-xs font-bold text-zinc-700 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 active:bg-zinc-100 transition-colors"
      >
        + Add Menu Item
      </Link>
    );
  } else if (model.canViewReports) {
    secondaryActions = (
      <Link
        href="/dashboard/reports"
        className="flex min-h-[44px] items-center gap-1.5 px-3 py-2 text-xs font-bold text-zinc-700 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 active:bg-zinc-100 transition-colors"
      >
        📈 View Analytics
      </Link>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <PageHeader
        title={`Welcome to ${business.name}`}
        description={`Active Branch: ${activeBranch.name} • Timezone: ${activeBranch.timezone}`}
        breadcrumbs={[{ label: 'Dashboard Overview' }]}
        primaryAction={primaryAction}
        secondaryActions={secondaryActions}
      />

      {/* Fallback Mode for Highly Restricted Users */}
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
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-zinc-800 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-colors"
            >
              📖 Open Help Center
            </Link>
          </div>
        </Card>
      ) : (
        <>
          {/* Operational Terminal Quick Access Cards (Cashier / Kitchen / Waiter) */}
          {(model.showCashierShortcutCard || model.showKitchenQueueCard || model.showWaiterQueueCard) && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {model.showCashierShortcutCard && (
                <Card className="p-5 bg-gradient-to-br from-emerald-50 to-white border-emerald-200 hover:border-emerald-300 transition-all shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Cashier POS</span>
                    <Badge variant="success">Active Terminal</Badge>
                  </div>
                  <p className="text-xs text-zinc-600">Register orders, process guest checkouts, and print receipts.</p>
                  <Link href="/dashboard/cashier" className="inline-block pt-1 text-xs font-bold text-emerald-700 hover:text-emerald-900">
                    Open POS Terminal →
                  </Link>
                </Card>
              )}

              {model.showKitchenQueueCard && (
                <Card className="p-5 bg-gradient-to-br from-amber-50 to-white border-amber-200 hover:border-amber-300 transition-all shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-800">Kitchen Display</span>
                    <Badge variant="warning">Order Queue</Badge>
                  </div>
                  <p className="text-xs text-zinc-600">Live order tickets, preparation status, and kitchen bump bar.</p>
                  <Link href="/dashboard/kitchen" className="inline-block pt-1 text-xs font-bold text-amber-700 hover:text-amber-900">
                    Open Kitchen Queue →
                  </Link>
                </Card>
              )}

              {model.showWaiterQueueCard && (
                <Card className="p-5 bg-gradient-to-br from-blue-50 to-white border-blue-200 hover:border-blue-300 transition-all shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-800">Waiter Terminal</span>
                    <Badge variant="neutral">Service Floor</Badge>
                  </div>
                  <p className="text-xs text-zinc-600">Table requests, waiter calls, and quick menu reference.</p>
                  <Link href="/dashboard/waiter" className="inline-block pt-1 text-xs font-bold text-blue-700 hover:text-blue-900">
                    Open Waiter Terminal →
                  </Link>
                </Card>
              )}
            </div>
          )}

          {/* Quick Stats Row (Capability Filtered) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {model.showMenuStatsCard && (
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Categories</span>
                  <Badge variant="neutral">Catalog</Badge>
                </div>
                <p className="mt-2 text-3xl font-extrabold text-zinc-950">{categoriesCount || 0}</p>
                <Link href="/dashboard/menu/categories" className="mt-2 block text-xs font-semibold text-zinc-600 hover:text-zinc-950">
                  {model.canManageMenu || model.isBusinessOwner ? 'Manage Categories →' : 'View Categories →'}
                </Link>
              </Card>
            )}

            {model.showMenuStatsCard && (
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Menu Items</span>
                  <Badge variant="neutral">Active</Badge>
                </div>
                <p className="mt-2 text-3xl font-extrabold text-zinc-950">{itemsCount || 0}</p>
                <Link href="/dashboard/menu/items" className="mt-2 block text-xs font-semibold text-zinc-600 hover:text-zinc-950">
                  {model.canManageMenu || model.isBusinessOwner ? 'Manage Items →' : 'View Items →'}
                </Link>
              </Card>
            )}

            {model.showDiningStatsCard && (
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Service Areas</span>
                  <Badge variant="neutral">Floors</Badge>
                </div>
                <p className="mt-2 text-3xl font-extrabold text-zinc-950">{areasCount || 0}</p>
                <Link href="/dashboard/tables/areas" className="mt-2 block text-xs font-semibold text-zinc-600 hover:text-zinc-950">
                  {model.canManageTables || model.isBusinessOwner ? 'Manage Service Areas →' : 'View Service Areas →'}
                </Link>
              </Card>
            )}

            {model.showDiningStatsCard && (
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Dining Tables</span>
                  <Badge variant="success">{availableTablesCount} Free</Badge>
                </div>
                <p className="mt-2 text-3xl font-extrabold text-zinc-950">{tablesCount}</p>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500">
                  <span>🔴 {occupiedTablesCount} Occupied</span>
                  <span>🟡 {reservedTablesCount} Reserved</span>
                </div>
                <Link href="/dashboard/dining" className="mt-2 block text-xs font-semibold text-zinc-600 hover:text-zinc-950">
                  {model.canManageTables || model.isBusinessOwner ? 'Manage Tables →' : 'View Tables →'}
                </Link>
              </Card>
            )}

            {model.showInventoryCard && (
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Stock Items</span>
                  <Badge variant="neutral">Inventory</Badge>
                </div>
                <p className="mt-2 text-3xl font-extrabold text-zinc-950">{stockItemsCount || 0}</p>
                <Link href="/dashboard/inventory/items" className="mt-2 block text-xs font-semibold text-zinc-600 hover:text-zinc-950">
                  {model.canManageInventory || model.isBusinessOwner ? 'Manage Stock Catalog →' : 'View Stock Catalog →'}
                </Link>
              </Card>
            )}

            {model.showAccessGovernanceCard && (
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">RBAC & Scope V2</span>
                  <Badge variant="neutral">Security</Badge>
                </div>
                <p className="mt-2 text-xs font-extrabold text-zinc-950">Access Control Hub</p>
                <Link href="/dashboard/access" className="mt-2 block text-xs font-semibold text-zinc-600 hover:text-zinc-950">
                  {model.canManageAccess || model.isBusinessOwner ? 'Manage Roles & Scope Grants →' : 'View Access Control Hub →'}
                </Link>
              </Card>
            )}
          </div>

          {/* Setup Progress & Quick Actions Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Setup Progress Checklist (Shown for Owner / Managers) */}
            {model.showSetupChecklist && (
              <Card className="p-6 lg:col-span-2 space-y-4">
                <div>
                  <h2 className="text-base font-bold text-zinc-950">Hospitality Setup Progress</h2>
                  <p className="text-xs text-zinc-500">Complete these core modules to prepare your venue for service.</p>
                </div>

                <div className="space-y-3">
                  {/* Step 1: Business Profile */}
                  <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">✓</span>
                      <div>
                        <h3 className="text-xs font-bold text-zinc-950">Business Profile & Default Branch</h3>
                        <p className="text-[11px] text-zinc-500">{business.name} setup completed during onboarding.</p>
                      </div>
                    </div>
                    <Link href="/dashboard/business">
                      <Button variant="outline" size="sm">View Profile</Button>
                    </Link>
                  </div>

                  {/* Step 2: Menu Setup */}
                  <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-4">
                    <div className="flex items-center gap-3">
                      {menuComplete ? (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">✓</span>
                      ) : (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-800">!</span>
                      )}
                      <div>
                        <h3 className="text-xs font-bold text-zinc-950">Menu Catalog & Items</h3>
                        <p className="text-[11px] text-zinc-500">
                          {menuComplete ? `${categoriesCount} categories and ${itemsCount} items active.` : 'Create categories and menu items.'}
                        </p>
                      </div>
                    </div>
                    <Link href="/dashboard/menu">
                      <Button variant={menuComplete ? 'outline' : 'primary'} size="sm">
                        {menuComplete ? 'Manage Menu' : 'Setup Menu'}
                      </Button>
                    </Link>
                  </div>

                  {/* Step 3: Dining Tables */}
                  <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-4">
                    <div className="flex items-center gap-3">
                      {tablesComplete ? (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">✓</span>
                      ) : (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-800">!</span>
                      )}
                      <div>
                        <h3 className="text-xs font-bold text-zinc-950">Service Areas & Dining Tables</h3>
                        <p className="text-[11px] text-zinc-500">
                          {tablesComplete ? `${areasCount} areas and ${tablesCount} dining tables configured.` : 'Define service areas and generate dining tables.'}
                        </p>
                      </div>
                    </div>
                    <Link href="/dashboard/tables">
                      <Button variant={tablesComplete ? 'outline' : 'primary'} size="sm">
                        {tablesComplete ? 'Manage Tables' : 'Setup Tables'}
                      </Button>
                    </Link>
                  </div>

                  {/* Step 4: QR Codes & Customer Menu */}
                  <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">✓</span>
                      <div>
                        <h3 className="text-xs font-bold text-zinc-950">Table QR Codes & Digital Menu</h3>
                        <p className="text-[11px] text-zinc-500">Generate secure QR stickers for guest digital menu access.</p>
                      </div>
                    </div>
                    <Link href="/dashboard/tables/qr">
                      <Button variant="outline" size="sm">Manage QR Codes</Button>
                    </Link>
                  </div>
                </div>
              </Card>
            )}

            {/* Quick Actions & Recent Activity Column */}
            <div className={`space-y-6 ${!model.showSetupChecklist ? 'lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6 space-y-0' : ''}`}>
              {/* Quick Action Shortcuts (Capability Filtered) */}
              {model.quickActions.length > 0 && (
                <Card className="p-6 space-y-3">
                  <h2 className="text-base font-bold text-zinc-950">Quick Actions</h2>
                  <div className="flex flex-col gap-2">
                    {model.quickActions.map((qa) => (
                      <Link key={qa.id} href={qa.href}>
                        <Button variant="outline" size="sm" className="w-full justify-start">
                          {qa.label}
                        </Button>
                      </Link>
                    ))}
                  </div>
                </Card>
              )}

              {/* Audit Activity */}
              {model.showAuditLogs && (
                <Card className="p-6 space-y-3">
                  <h2 className="text-base font-bold text-zinc-950">Recent System Activity</h2>
                  <div className="space-y-2">
                    {auditLogs && auditLogs.length > 0 ? (
                      auditLogs.map((log) => (
                        <div key={log.id} className="flex items-center justify-between border-b border-zinc-100 pb-2 text-xs">
                          <span className="font-mono text-[11px] text-zinc-800">{log.action}</span>
                          <span className="text-[10px] text-zinc-400">
                            {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-zinc-500">No recent activity recorded.</p>
                    )}
                  </div>
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
