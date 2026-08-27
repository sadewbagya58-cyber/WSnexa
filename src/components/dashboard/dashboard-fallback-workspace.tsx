import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DashboardNavSectionDTO } from '@/lib/navigation/dashboard-navigation';

interface DashboardFallbackWorkspaceProps {
  businessName: string;
  activeBranchName: string;
  accessibleSections: DashboardNavSectionDTO[];
}

function getDestinationIcon(id: string): string {
  switch (id) {
    case 'orders':
      return '📋';
    case 'menu':
      return '🍽️';
    case 'dining':
      return '🪑';
    case 'reservations':
      return '📅';
    case 'customers':
      return '👥';
    case 'operations':
      return '📦';
    case 'team':
      return '🛡️';
    case 'reports':
      return '📈';
    case 'settings':
      return '⚙️';
    default:
      return '📁';
  }
}

function getDestinationDescription(id: string): string {
  switch (id) {
    case 'orders':
      return 'View orders, active kitchen tickets, and payment settlement statuses.';
    case 'menu':
      return 'Browse food and beverage menu items, categories, and item availability.';
    case 'dining':
      return 'View service areas, dining floor tables, and branch QR codes.';
    case 'reservations':
      return 'View upcoming guest bookings and table reservations.';
    case 'customers':
      return 'View guest profiles, loyalty tiers, and customer feedback reviews.';
    case 'operations':
      return 'Track inventory stock levels, ingredients, recipes, and purchase orders.';
    case 'team':
      return 'View team staff members, organization hierarchy, and access roles.';
    case 'reports':
      return 'Access operational performance metrics and business reporting.';
    case 'settings':
      return 'View business profile, branch locations, and venue settings.';
    default:
      return 'Access authorized workspace tools and modules.';
  }
}

export function DashboardFallbackWorkspace({
  businessName,
  activeBranchName,
  accessibleSections,
}: DashboardFallbackWorkspaceProps) {
  // Extract all permitted destination items excluding the current root dashboard itself
  const accessibleItems = accessibleSections
    .flatMap((section) => section.items)
    .filter((item) => item.id !== 'dashboard');

  // Case A: User has zero accessible workspaces
  if (accessibleItems.length === 0) {
    return (
      <Card className="p-8 sm:p-12 text-center space-y-4 max-w-xl mx-auto border-dashed border-zinc-300">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-zinc-100 flex items-center justify-center text-3xl text-zinc-600 shadow-2xs">
          🔒
        </div>
        <div className="space-y-1.5">
          <h2 className="text-base sm:text-lg font-bold text-zinc-950">No Workspace Access</h2>
          <p className="text-xs text-zinc-600 leading-relaxed max-w-md mx-auto">
            Your account at <span className="font-semibold text-zinc-900">{businessName}</span> ({activeBranchName}) does not currently have permissions assigned for any operational workspaces or management tools.
          </p>
          <p className="text-xs text-zinc-500 max-w-md mx-auto">
            Please contact your business owner or manager to request role permissions.
          </p>
        </div>
        <div className="pt-3">
          <Link
            href="/dashboard/help"
            className="inline-flex min-h-[44px] items-center gap-1.5 px-4 py-2 text-xs font-bold text-zinc-800 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-colors touch-manipulation"
          >
            📖 Open Help Center
          </Link>
        </div>
      </Card>
    );
  }

  // Case B: Exactly one accessible destination exists — make it prominent
  if (accessibleItems.length === 1) {
    const destination = accessibleItems[0];
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-800 border border-zinc-200">
            📍 {activeBranchName}
          </div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-950">Your Workspace</h2>
          <p className="text-xs text-zinc-600">
            You are logged in to <span className="font-semibold text-zinc-900">{businessName}</span> with role capability access to the following workspace:
          </p>
        </div>

        <Card className="p-6 border border-zinc-200 shadow-xs hover:border-zinc-300 transition-colors bg-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{getDestinationIcon(destination.id)}</span>
                <h3 className="text-base font-bold text-zinc-950">{destination.label}</h3>
                {destination.badge && (
                  <Badge variant="neutral" className="text-[10px]">
                    {destination.badge}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-zinc-600 leading-relaxed">
                {getDestinationDescription(destination.id)}
              </p>
            </div>
            <Link
              href={destination.href}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-zinc-950 hover:bg-zinc-800 rounded-xl transition-colors shadow-xs touch-manipulation shrink-0"
            >
              Open {destination.label} →
            </Link>
          </div>
        </Card>

        <div className="text-center pt-2">
          <Link
            href="/dashboard/help"
            className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-800 transition-colors touch-manipulation"
          >
            Need help? Visit the Help Center
          </Link>
        </div>
      </div>
    );
  }

  // Case C: Multiple accessible destinations
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-bold tracking-tight text-zinc-950">Your Workspaces</h2>
        <p className="text-xs text-zinc-600">
          Workspaces and management modules available to your role at <span className="font-semibold text-zinc-900">{businessName}</span> ({activeBranchName}):
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {accessibleItems.map((item) => (
          <Card
            key={item.id}
            className="p-5 border border-zinc-200 shadow-xs flex flex-col justify-between hover:border-zinc-300 transition-colors bg-white"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl">{getDestinationIcon(item.id)}</span>
                {item.badge && (
                  <Badge variant="neutral" className="text-[10px]">
                    {item.badge}
                  </Badge>
                )}
              </div>
              <h3 className="text-sm font-bold text-zinc-950">{item.label}</h3>
              <p className="text-xs text-zinc-600 leading-relaxed line-clamp-2">
                {getDestinationDescription(item.id)}
              </p>
            </div>
            <div className="pt-4 mt-3 border-t border-zinc-100">
              <Link
                href={item.href}
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-colors touch-manipulation"
              >
                Open {item.label} →
              </Link>
            </div>
          </Card>
        ))}
      </div>

      <div className="text-center pt-2">
        <Link
          href="/dashboard/help"
          className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-800 transition-colors touch-manipulation"
        >
          Need help? Visit the Help Center
        </Link>
      </div>
    </div>
  );
}
