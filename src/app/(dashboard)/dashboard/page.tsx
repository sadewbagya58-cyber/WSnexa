import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';

import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';

export default async function DashboardOverviewPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }
  if (!context || !context.activeBranch) {
    redirect('/login');
  }

  const { business, activeBranch } = context;
  const supabase = await createClient();

  // 1. Fetch Stats & Audit Logs Concurrently with Promise.all
  const [
    { count: categoriesCount },
    { count: itemsCount },
    { count: areasCount },
    { data: tablesData },
    { data: auditLogs },
  ] = await Promise.all([
    supabase
      .from('menu_categories')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', business.id)
      .eq('branch_id', activeBranch.id)
      .is('deleted_at', null),

    supabase
      .from('menu_items')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', business.id)
      .eq('branch_id', activeBranch.id)
      .is('deleted_at', null),

    supabase
      .from('service_areas')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', business.id)
      .eq('branch_id', activeBranch.id)
      .is('deleted_at', null),

    supabase
      .from('dining_tables')
      .select('id, status')
      .eq('business_id', business.id)
      .eq('branch_id', activeBranch.id)
      .is('deleted_at', null),

    supabase
      .from('audit_logs')
      .select('id, action, target_type, created_at')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const tablesCount = tablesData?.length || 0;
  const availableTablesCount = tablesData?.filter((t) => t.status === 'available').length || 0;
  const occupiedTablesCount = tablesData?.filter((t) => t.status === 'occupied').length || 0;
  const reservedTablesCount = tablesData?.filter((t) => t.status === 'reserved').length || 0;

  // 3. Dynamic Checklist Completion Logic
  const menuComplete = (categoriesCount || 0) > 0 && (itemsCount || 0) > 0;
  const tablesComplete = (areasCount || 0) > 0 && tablesCount > 0;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <PageHeader
        title={`Welcome to ${business.name}`}
        description={`Active Branch: ${activeBranch.name} • Timezone: ${activeBranch.timezone}`}
        primaryAction={{
          label: '🍽️ Dining Setup',
          href: '/dashboard/dining',
        }}
        secondaryAction={{
          label: '+ Add Menu Item',
          href: '/dashboard/menu/items',
        }}
      />

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Categories</span>
            <Badge variant="neutral">Catalog</Badge>
          </div>
          <p className="mt-2 text-3xl font-extrabold text-zinc-950">{categoriesCount || 0}</p>
          <Link href="/dashboard/menu/categories" className="mt-2 block text-xs font-semibold text-zinc-600 hover:text-zinc-950">
            Manage Categories →
          </Link>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Menu Items</span>
            <Badge variant="neutral">Active</Badge>
          </div>
          <p className="mt-2 text-3xl font-extrabold text-zinc-950">{itemsCount || 0}</p>
          <Link href="/dashboard/menu/items" className="mt-2 block text-xs font-semibold text-zinc-600 hover:text-zinc-950">
            Manage Items →
          </Link>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Service Areas</span>
            <Badge variant="neutral">Floors</Badge>
          </div>
          <p className="mt-2 text-3xl font-extrabold text-zinc-950">{areasCount || 0}</p>
          <Link href="/dashboard/tables/areas" className="mt-2 block text-xs font-semibold text-zinc-600 hover:text-zinc-950">
            Manage Service Areas →
          </Link>
        </Card>

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
        </Card>
      </div>

      {/* Setup Progress & Quick Actions Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Setup Progress Checklist (2 Columns) */}
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

        {/* Quick Actions & Recent Activity Column */}
        <div className="space-y-6">
          {/* Quick Action Shortcuts */}
          <Card className="p-6 space-y-3">
            <h2 className="text-base font-bold text-zinc-950">Quick Actions</h2>
            <div className="flex flex-col gap-2">
              <Link href="/dashboard/tables/qr">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  📱 Manage & Export Table QRs
                </Button>
              </Link>
              <Link href="/dashboard/tables/bulk">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  ⚡ Bulk Generate Tables
                </Button>
              </Link>
              <Link href="/dashboard/tables/areas">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  📁 Create Service Area
                </Button>
              </Link>
              <Link href="/dashboard/menu/categories">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  🏷️ Add Category
                </Button>
              </Link>
              <Link href="/dashboard/menu/items">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  🍔 Add Menu Item
                </Button>
              </Link>
            </div>
          </Card>

          {/* Audit Activity */}
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
        </div>
      </div>
    </div>
  );
}
