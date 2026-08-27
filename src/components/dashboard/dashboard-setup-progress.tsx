import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface DashboardSetupProgressProps {
  businessName: string;
  categoriesCount: number;
  menuItemsCount: number;
  serviceAreasCount: number;
  tablesCount: number;
  setupComplete: boolean;
}

export const DashboardSetupProgress: React.FC<DashboardSetupProgressProps> = ({
  businessName,
  categoriesCount,
  menuItemsCount,
  serviceAreasCount,
  tablesCount,
  setupComplete,
}) => {
  // Disappear from primary dashboard once critical venue setup is complete
  if (setupComplete) {
    return null;
  }

  const menuComplete = categoriesCount > 0 && menuItemsCount > 0;
  const tablesComplete = serviceAreasCount > 0 && tablesCount > 0;

  return (
    <Card className="p-5 space-y-4 border-amber-200/80 bg-amber-50/20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-zinc-950">Hospitality Setup Progress</h2>
          <p className="text-xs text-zinc-500">Complete these core modules to start taking live orders.</p>
        </div>
        <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full">
          Setup in progress
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Step 1: Business Profile */}
        <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800 shrink-0">
              ✓
            </span>
            <div className="min-w-0">
              <h3 className="text-xs font-bold text-zinc-950 truncate">Business Profile</h3>
              <p className="text-[11px] text-zinc-500 truncate">{businessName}</p>
            </div>
          </div>
          <Link href="/dashboard/business" className="shrink-0 ml-2">
            <Button variant="outline" size="sm" className="text-xs h-8">Profile</Button>
          </Link>
        </div>

        {/* Step 2: Menu Setup */}
        <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            {menuComplete ? (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800 shrink-0">
                ✓
              </span>
            ) : (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-800 shrink-0">
                !
              </span>
            )}
            <div className="min-w-0">
              <h3 className="text-xs font-bold text-zinc-950 truncate">Menu & Items</h3>
              <p className="text-[11px] text-zinc-500 truncate">
                {menuComplete ? `${categoriesCount} categories, ${menuItemsCount} items` : 'Add menu items'}
              </p>
            </div>
          </div>
          <Link href="/dashboard/menu" className="shrink-0 ml-2">
            <Button variant={menuComplete ? 'outline' : 'primary'} size="sm" className="text-xs h-8">
              {menuComplete ? 'Manage' : 'Setup'}
            </Button>
          </Link>
        </div>

        {/* Step 3: Dining Tables */}
        <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            {tablesComplete ? (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800 shrink-0">
                ✓
              </span>
            ) : (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-800 shrink-0">
                !
              </span>
            )}
            <div className="min-w-0">
              <h3 className="text-xs font-bold text-zinc-950 truncate">Dining Tables</h3>
              <p className="text-[11px] text-zinc-500 truncate">
                {tablesComplete ? `${tablesCount} tables configured` : 'Configure tables'}
              </p>
            </div>
          </div>
          <Link href="/dashboard/tables" className="shrink-0 ml-2">
            <Button variant={tablesComplete ? 'outline' : 'primary'} size="sm" className="text-xs h-8">
              {tablesComplete ? 'Manage' : 'Setup'}
            </Button>
          </Link>
        </div>

        {/* Step 4: QR Codes */}
        <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800 shrink-0">
              ✓
            </span>
            <div className="min-w-0">
              <h3 className="text-xs font-bold text-zinc-950 truncate">Table QR Codes</h3>
              <p className="text-[11px] text-zinc-500 truncate">Digital guest ordering</p>
            </div>
          </div>
          <Link href="/dashboard/tables/qr" className="shrink-0 ml-2">
            <Button variant="outline" size="sm" className="text-xs h-8">QR Codes</Button>
          </Link>
        </div>
      </div>
    </Card>
  );
};
