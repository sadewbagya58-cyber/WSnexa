import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { resolveAuthorizationContext } from '@/server/auth';
import { SettingsSubNav } from '@/components/settings/settings-subnav';
import { resolveSettingsSubNavPermissions } from '@/server/navigation/settings-nav-permissions';

export const metadata: Metadata = {
  title: 'Settings & Configuration | WSNexa',
  description: 'Manage business identity, location branches, ordering parameters, payment methods, and account configuration',
};

export default async function SettingsHubPage() {
  const { allowed, context: tenantContext } = await requireRoutePermission('/dashboard/settings');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(tenantContext?.membership?.role)} />;
  }

  if (!tenantContext || !tenantContext.business) {
    redirect('/login');
  }

  let authContext: Awaited<ReturnType<typeof resolveAuthorizationContext>>;
  try {
    authContext = await resolveAuthorizationContext();
  } catch {
    redirect('/login');
  }

  // Compute authoritative capability permissions for all settings destinations
  const navPermissions = await resolveSettingsSubNavPermissions(
    authContext,
    tenantContext.activeBranch?.id,
    tenantContext.business.id
  );

  const {
    canViewBusiness,
    canViewVenueProfile,
    canViewBranches,
    canManageBranches,
    canViewOrderSecurity,
    canViewPayments,
    canManageInventorySettings,
    canViewSubscription,
  } = navPermissions;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Settings Hub"
        description={`Central configuration hub for ${tenantContext.business.name}. Manage locations, security, branding, and billing.`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Settings Hub' },
        ]}
        helpSlug="settings-overview"
      />

      {/* Secondary Hub Sub-Navigation Bar */}
      <SettingsSubNav {...navPermissions} />

      {/* Main Settings Sections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
        {/* 1. Business Profile */}
        {canViewBusiness && (
          <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-xs flex flex-col justify-between hover:border-zinc-950 transition-all group">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl p-2.5 rounded-xl bg-zinc-50 border border-zinc-100 group-hover:bg-zinc-100 transition-colors">
                  🏢
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-md">
                  Profile
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-950">Business Profile</h3>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  Manage legal company identity, default operating currency ({tenantContext.business.defaultCurrency}), and primary timezone ({tenantContext.business.timezone}).
                </p>
              </div>
            </div>
            <div className="pt-4 border-t border-zinc-100 mt-4 flex items-center justify-between">
              <Link
                href="/dashboard/business"
                className="text-xs font-bold text-zinc-950 hover:underline inline-flex items-center gap-1"
              >
                Configure Profile →
              </Link>
            </div>
          </div>
        )}

        {/* 2. Public Venue Discovery Profile */}
        {canViewVenueProfile && (
          <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-xs flex flex-col justify-between hover:border-zinc-950 transition-all group">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl p-2.5 rounded-xl bg-zinc-50 border border-zinc-100 group-hover:bg-zinc-100 transition-colors">
                  🏬
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-md">
                  Discovery
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-950">Public Venue Profile</h3>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  Customize public customer-facing venue page, food photos, cuisine tags, and storefront discovery branding.
                </p>
              </div>
            </div>
            <div className="pt-4 border-t border-zinc-100 mt-4 flex items-center justify-between">
              <Link
                href="/dashboard/venue-profile"
                className="text-xs font-bold text-zinc-950 hover:underline inline-flex items-center gap-1"
              >
                Edit Venue Profile →
              </Link>
            </div>
          </div>
        )}

        {/* 3. Branch Locations */}
        {canViewBranches && (
          <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-xs flex flex-col justify-between hover:border-zinc-950 transition-all group">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl p-2.5 rounded-xl bg-zinc-50 border border-zinc-100 group-hover:bg-zinc-100 transition-colors">
                  📍
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-md">
                  Outlets
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-950">Branch Management</h3>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  Configure branch outlets, GPS coordinates, table ordering requirements, and operating schedules.
                </p>
              </div>
            </div>
            <div className="pt-4 border-t border-zinc-100 mt-4 flex items-center justify-between gap-2">
              <Link
                href="/dashboard/branches"
                className="text-xs font-bold text-zinc-950 hover:underline inline-flex items-center gap-1"
              >
                Manage Branches →
              </Link>
              {canManageBranches && (
                <Link
                  href="/dashboard/branches?action=new"
                  className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-zinc-100 text-zinc-700 hover:bg-zinc-200 transition-colors"
                >
                  + Add Branch
                </Link>
              )}
            </div>
          </div>
        )}

        {/* 4. Order Security & Anti-Fraud */}
        {canViewOrderSecurity && (
          <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-xs flex flex-col justify-between hover:border-zinc-950 transition-all group">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl p-2.5 rounded-xl bg-zinc-50 border border-zinc-100 group-hover:bg-zinc-100 transition-colors">
                  🛡️
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-md">
                  Security
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-950">Order Security & Anti-Fraud</h3>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  Manage physical GPS geofencing radius, dine-in table security PIN validation, and checkout fraud prevention.
                </p>
              </div>
            </div>
            <div className="pt-4 border-t border-zinc-100 mt-4 flex items-center justify-between">
              <Link
                href="/dashboard/settings/order-security"
                className="text-xs font-bold text-zinc-950 hover:underline inline-flex items-center gap-1"
              >
                Configure Security →
              </Link>
            </div>
          </div>
        )}

        {/* 5. Branch Payment Gateways */}
        {canViewPayments && (
          <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-xs flex flex-col justify-between hover:border-zinc-950 transition-all group">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl p-2.5 rounded-xl bg-zinc-50 border border-zinc-100 group-hover:bg-zinc-100 transition-colors">
                  💳
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-md">
                  Payments
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-950">Payment Settings</h3>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  Enable and customize branch accepted payment options (Cash, Card, QR, and Online payment gateways).
                </p>
              </div>
            </div>
            <div className="pt-4 border-t border-zinc-100 mt-4 flex items-center justify-between">
              <Link
                href="/dashboard/settings/payments"
                className="text-xs font-bold text-zinc-950 hover:underline inline-flex items-center gap-1"
              >
                Payment Methods →
              </Link>
            </div>
          </div>
        )}

        {/* 6. Inventory Settings */}
        {canManageInventorySettings && (
          <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-xs flex flex-col justify-between hover:border-zinc-950 transition-all group">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl p-2.5 rounded-xl bg-zinc-50 border border-zinc-100 group-hover:bg-zinc-100 transition-colors">
                  📦
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-md">
                  Inventory
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-950">Inventory Policies & Costing</h3>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  Configure automatic stock deduction timing, negative inventory rules, and default replenishment thresholds.
                </p>
              </div>
            </div>
            <div className="pt-4 border-t border-zinc-100 mt-4 flex items-center justify-between">
              <Link
                href="/dashboard/inventory/settings"
                className="text-xs font-bold text-zinc-950 hover:underline inline-flex items-center gap-1"
              >
                Inventory Settings →
              </Link>
            </div>
          </div>
        )}

        {/* 7. SaaS Subscription & Billing (Owner Only) */}
        {canViewSubscription && (
          <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-xs flex flex-col justify-between hover:border-zinc-950 transition-all group bg-gradient-to-b from-white to-zinc-50/50">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl p-2.5 rounded-xl bg-amber-50 border border-amber-100 group-hover:bg-amber-100 transition-colors text-amber-900">
                  💎
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                  Account Owner
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-950">Billing & Subscription</h3>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  Manage your WSNexa SaaS tier, plan upgrades, automated renewals, and past billing transaction history.
                </p>
              </div>
            </div>
            <div className="pt-4 border-t border-zinc-100 mt-4 flex items-center justify-between">
              <Link
                href="/dashboard/settings/subscription"
                className="text-xs font-bold text-zinc-950 hover:underline inline-flex items-center gap-1"
              >
                Manage Billing →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
