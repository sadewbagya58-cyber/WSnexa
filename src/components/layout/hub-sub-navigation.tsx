'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface HubNavItem {
  id: string;
  label: string;
  href: string;
  icon?: string;
  badge?: string;
  exact?: boolean;
}

interface HubSubNavigationProps {
  items: HubNavItem[];
  className?: string;
}

export function HubSubNavigation({ items, className = '' }: HubSubNavigationProps) {
  const pathname = usePathname();

  if (items.length <= 1) {
    return null;
  }

  return (
    <nav
      aria-label="Sub-workspace navigation"
      className={`flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 sm:mx-0 sm:px-0 text-xs scrollbar-none touch-manipulation ${className}`}
    >
      {items.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname === item.href || (item.href !== '/dashboard/settings' && item.href !== '/dashboard/inventory' && item.href !== '/dashboard/team' && item.href !== '/dashboard/customers' && pathname.startsWith(`${item.href}/`));

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-xl font-bold inline-flex items-center gap-1.5 whitespace-nowrap transition-all shrink-0 active:scale-[0.98] ${
              isActive
                ? 'bg-zinc-950 text-white shadow-2xs'
                : 'bg-white text-zinc-600 border border-zinc-200/80 hover:bg-zinc-50 hover:text-zinc-950 active:bg-zinc-100'
            }`}
          >
            {item.icon && <span className="text-sm select-none">{item.icon}</span>}
            <span>{item.label}</span>
            {item.badge && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono uppercase font-semibold ${
                  isActive ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-100 text-zinc-600'
                }`}
              >
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
