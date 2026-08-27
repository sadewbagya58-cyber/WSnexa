import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { DashboardQuickAction } from '@/server/navigation/dashboard-home-model';

interface DashboardQuickActionsProps {
  actions: DashboardQuickAction[];
}

export const DashboardQuickActions: React.FC<DashboardQuickActionsProps> = ({ actions }) => {
  if (!actions || actions.length === 0) {
    return null;
  }

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Quick Actions</h2>
        <span className="text-[11px] text-zinc-400 font-medium">Frequent Tasks</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {actions.map((action) => (
          <Link
            key={action.id}
            href={action.href}
            className="flex min-h-[44px] items-center justify-between px-3.5 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50/50 hover:bg-zinc-100/80 active:bg-zinc-200/60 transition-colors text-xs font-bold text-zinc-800 touch-manipulation group shadow-2xs"
          >
            <span className="truncate">{action.label}</span>
            <span className="text-zinc-400 group-hover:text-zinc-700 text-xs ml-2 shrink-0">→</span>
          </Link>
        ))}
      </div>
    </Card>
  );
};
