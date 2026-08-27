import React from 'react';
import Link from 'next/link';
import { DashboardHomeModel } from '@/server/navigation/dashboard-home-model';

interface DashboardOperationsShortcutsProps {
  model: DashboardHomeModel;
}

export const DashboardOperationsShortcuts: React.FC<DashboardOperationsShortcutsProps> = ({ model }) => {
  if (!model.showOperationsShortcuts) {
    return null;
  }

  const shortcuts: { id: string; label: string; subLabel: string; href: string; icon: string; badge: string; color: string }[] = [];

  if (model.showCashierShortcut) {
    shortcuts.push({
      id: 'cashier-pos',
      label: 'Cashier POS',
      subLabel: 'Orders & Payments',
      href: '/dashboard/cashier',
      icon: '💳',
      badge: 'Terminal',
      color: 'hover:border-emerald-300 hover:bg-emerald-50/30 text-emerald-950',
    });
  }

  if (model.showKitchenShortcut) {
    shortcuts.push({
      id: 'kitchen-display',
      label: 'Kitchen Queue',
      subLabel: 'Live Order Prep',
      href: '/dashboard/kitchen',
      icon: '👨‍🍳',
      badge: 'KDS',
      color: 'hover:border-amber-300 hover:bg-amber-50/30 text-amber-950',
    });
  }

  if (model.showWaiterShortcut) {
    shortcuts.push({
      id: 'waiter-terminal',
      label: 'Waiter Service',
      subLabel: 'Floor Calls & Orders',
      href: '/dashboard/waiter',
      icon: '📋',
      badge: 'Floor',
      color: 'hover:border-blue-300 hover:bg-blue-50/30 text-blue-950',
    });
  }

  if (shortcuts.length === 0) {
    return null;
  }

  return (
    <section aria-label="Operational Terminals" className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
          Live Operational Terminals
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {shortcuts.map((sc) => (
          <Link
            key={sc.id}
            href={sc.href}
            className={`flex min-h-[48px] items-center justify-between p-3 rounded-xl border border-zinc-200 bg-white shadow-2xs transition-all ${sc.color} group`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-lg shrink-0">{sc.icon}</span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-zinc-950 group-hover:text-zinc-900 truncate">{sc.label}</p>
                <p className="text-[10px] text-zinc-500 truncate">{sc.subLabel}</p>
              </div>
            </div>
            <span className="text-xs font-bold text-zinc-400 group-hover:text-zinc-700 ml-2 shrink-0">
              Open →
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
};
