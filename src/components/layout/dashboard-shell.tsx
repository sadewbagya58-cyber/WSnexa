'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { RouteProgress } from '@/components/ui/route-progress';
import { RoutePrefetcher } from '@/components/layout/route-prefetcher';

interface DashboardShellProps {
  businessName: string;
  branchName: string;
  userEmail: string;
  userName: string;
  userRole: string;
  children: React.ReactNode;
}

interface NavItem {
  label: string;
  href: string;
  badge?: string;
  disabled?: boolean;
}

interface NavSection {
  sectionTitle: string;
  items: NavItem[];
}

export const DashboardShell: React.FC<DashboardShellProps> = ({
  businessName,
  branchName,
  userEmail,
  userName,
  userRole,
  children,
}) => {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const navSections: NavSection[] = [
    {
      sectionTitle: 'Overview',
      items: [{ label: 'Dashboard', href: '/dashboard' }],
    },
    {
      sectionTitle: 'Business',
      items: [
        { label: 'Business Profile', href: '/dashboard/business' },
        { label: 'Branches', href: '/dashboard/branches' },
        { label: 'Team & Members', href: '/dashboard/team' },
      ],
    },
    {
      sectionTitle: 'Menu Catalog',
      items: [
        { label: 'Menu Overview', href: '/dashboard/menu' },
        { label: 'Categories', href: '/dashboard/menu/categories' },
        { label: 'Menu Items', href: '/dashboard/menu/items' },
      ],
    },
    {
      sectionTitle: 'Dining & Tables',
      items: [
        { label: 'Tables Overview', href: '/dashboard/tables' },
        { label: 'Service Areas', href: '/dashboard/tables/areas' },
        { label: 'Add Table', href: '/dashboard/tables/new' },
        { label: 'Bulk Generator', href: '/dashboard/tables/bulk' },
      ],
    },
    {
      sectionTitle: 'Upcoming Features',
      items: [
        { label: 'QR Codes', href: '#', badge: 'Soon', disabled: true },
        { label: 'Orders & POS', href: '#', badge: 'Soon', disabled: true },
        { label: 'Kitchen Display', href: '#', badge: 'Soon', disabled: true },
        { label: 'Reports & Analytics', href: '#', badge: 'Soon', disabled: true },
      ],
    },
  ];

  const formatRoleLabel = (role: string) => {
    switch (role) {
      case 'business_owner':
        return 'Business Owner';
      case 'branch_manager':
        return 'Branch Manager';
      case 'cashier':
        return 'Cashier';
      case 'kitchen_staff':
        return 'Kitchen Staff';
      case 'waiter':
        return 'Waiter';
      default:
        return role;
    }
  };

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    if (href === '#') return false;
    return pathname.startsWith(href);
  };

  const renderNavLinks = () => (
    <div className="space-y-6">
      {navSections.map((section, sIdx) => (
        <div key={sIdx} className="space-y-2">
          <h3 className="px-3 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            {section.sectionTitle}
          </h3>
          <div className="space-y-1">
            {section.items.map((item, idx) => {
              const active = isActive(item.href);

              if (item.disabled) {
                return (
                  <div
                    key={idx}
                    className="flex min-h-[44px] items-center justify-between rounded-md px-3 py-2 text-xs font-medium text-zinc-400 cursor-not-allowed opacity-60"
                  >
                    <span>{item.label}</span>
                    {item.badge && <Badge variant="neutral">{item.badge}</Badge>}
                  </div>
                );
              }

              return (
                <Link
                  key={idx}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex min-h-[44px] items-center justify-between rounded-md px-3 py-2 text-xs font-medium touch-manipulation transition-all duration-100 active:scale-[0.98] ${
                    active
                      ? 'bg-zinc-900 text-white font-semibold shadow-sm'
                      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 active:bg-zinc-200'
                  }`}
                >
                  <span>{item.label}</span>
                  {item.badge && <Badge variant="neutral">{item.badge}</Badge>}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col antialiased">
      <RouteProgress />
      <RoutePrefetcher />

      {/* Top Bar Header */}
      <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-zinc-200 bg-white/90 px-4 backdrop-blur sm:px-6">
        <div className="flex items-center gap-3">
          {/* Mobile Drawer Hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-2 text-zinc-600 hover:bg-zinc-100 active:bg-zinc-200 touch-manipulation active:scale-[0.95] lg:hidden focus:outline-none"
            aria-label="Toggle Navigation Drawer"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

          {/* Logo & Context Badges */}
          <Link href="/dashboard" className="flex items-center gap-2 touch-manipulation active:scale-[0.98]">
            <span className="rounded bg-zinc-950 px-2.5 py-1.5 text-xs font-extrabold text-white tracking-widest">
              WSNEXA
            </span>
          </Link>

          <span className="hidden text-zinc-300 sm:inline">|</span>

          {/* Active Business & Branch context */}
          <div className="hidden items-center gap-2 sm:flex">
            <Badge variant="neutral" className="font-semibold text-zinc-900">
              🏢 {businessName}
            </Badge>
            <Badge variant="neutral" className="text-zinc-600">
              📍 {branchName}
            </Badge>
          </div>
        </div>

        {/* User Profile Dropdown Trigger */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex min-h-[44px] items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 py-1 px-3 text-xs font-medium text-zinc-800 hover:bg-zinc-100 active:bg-zinc-200 touch-manipulation active:scale-[0.98] focus:outline-none"
          >
            <span className="font-bold text-zinc-950 max-w-[120px] sm:max-w-none truncate">{userName || userEmail}</span>
            <Badge variant="neutral" className="hidden sm:inline-block text-[10px] uppercase">
              {formatRoleLabel(userRole)}
            </Badge>
            <svg className="h-3.5 w-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-md border border-zinc-200 bg-white p-2 shadow-lg z-50">
              <div className="border-b border-zinc-100 px-3 py-2">
                <p className="text-xs font-semibold text-zinc-950">{userName || 'User Profile'}</p>
                <p className="text-[11px] text-zinc-500 truncate">{userEmail}</p>
                <p className="mt-1 text-[10px] text-zinc-400 font-medium">Role: {formatRoleLabel(userRole)}</p>
              </div>

              <div className="py-1">
                <form action="/api/auth/logout" method="POST">
                  <button
                    type="submit"
                    className="flex min-h-[44px] w-full items-center rounded-md px-3 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50 active:bg-red-100 touch-manipulation focus:outline-none"
                  >
                    🚪 Sign Out
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Body with Sidebar + Content */}
      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <aside className="hidden w-64 border-r border-zinc-200 bg-white p-4 lg:block">
          {renderNavLinks()}
        </aside>

        {/* Mobile Drawer Overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="relative z-50 w-72 max-w-[80vw] bg-white p-6 shadow-xl space-y-6 overflow-y-auto max-h-screen">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <span className="font-bold text-zinc-950">Navigation Menu</span>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center text-zinc-500 hover:text-zinc-950 text-xs font-semibold touch-manipulation"
                >
                  ✕ Close
                </button>
              </div>

              {/* Mobile Business & Branch Header */}
              <div className="rounded-md bg-zinc-50 p-3 space-y-1">
                <p className="text-xs font-bold text-zinc-950">🏢 {businessName}</p>
                <p className="text-xs text-zinc-500">📍 {branchName}</p>
              </div>

              {renderNavLinks()}
            </aside>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
};
