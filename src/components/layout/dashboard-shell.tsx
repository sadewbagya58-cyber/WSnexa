'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { RouteProgress } from '@/components/ui/route-progress';
import { RoutePrefetcher } from '@/components/layout/route-prefetcher';

import { ActiveBranchSwitcher } from './active-branch-switcher';
import { BranchInfo } from '@/types';

import { getRequiredPermissionForRoute } from '@/lib/security/route-permissions';

interface DashboardShellProps {
  businessName: string;
  activeBranch: BranchInfo | null;
  branches: BranchInfo[];
  userEmail: string;
  userName: string;
  userRole: string;
  userPermissions?: string[];
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
  activeBranch,
  branches,
  userEmail,
  userName,
  userRole,
  userPermissions,
  children,
}) => {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const rawNavSections: NavSection[] = [
    {
      sectionTitle: 'OVERVIEW',
      items: [
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Reports & Analytics', href: '/dashboard/reports' },
      ],
    },
    {
      sectionTitle: 'VENUE SETUP',
      items: [
        { label: 'Business Profile', href: '/dashboard/business' },
        { label: 'Public Venue Profile', href: '/dashboard/venue-profile' },
        { label: 'Branches', href: '/dashboard/branches' },
        { label: 'Dining Setup', href: '/dashboard/dining' },
        { label: 'Team & Members', href: '/dashboard/team' },
        { label: 'Staff Invitations', href: '/dashboard/team/invites' },
      ],
    },
    {
      sectionTitle: 'MENU',
      items: [
        { label: 'Menu Overview', href: '/dashboard/menu' },
        { label: 'Categories', href: '/dashboard/menu/categories' },
        { label: 'Menu Items', href: '/dashboard/menu/items' },
      ],
    },
    {
      sectionTitle: 'OPERATIONS',
      items: [
        { label: 'Cashier POS', href: '/dashboard/cashier' },
        { label: 'Kitchen Queue', href: '/dashboard/kitchen' },
        { label: 'Waiter Assistance', href: '/dashboard/waiter' },
        { label: 'Waiter Menu', href: '/dashboard/waiter/menu' },
      ],
    },
    {
      sectionTitle: 'GROWTH & GUESTS',
      items: [
        { label: 'Customer Reviews', href: '/dashboard/reviews' },
        { label: 'Reputation & Rankings', href: '/dashboard/reputation' },
        { label: 'Loyalty & Rewards', href: '/dashboard/loyalty' },
      ],
    },
    {
      sectionTitle: 'SETTINGS',
      items: [
        { label: 'Order Security', href: '/dashboard/settings/order-security' },
        { label: 'Payment Methods', href: '/dashboard/settings/payments' },
      ],
    },
  ];

  // Filter sections by granted user permissions
  const navSections: NavSection[] =
    userRole === 'business_owner'
      ? rawNavSections
      : rawNavSections
          .map((sec) => {
            const filteredItems = sec.items.filter((item) => {
              const reqKey = getRequiredPermissionForRoute(item.href);
              if (!reqKey) return true;
              return userPermissions ? userPermissions.includes(reqKey) : true;
            });
            return { ...sec, items: filteredItems };
          })
          .filter((sec) => sec.items.length > 0);

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
          <h3 className="px-3 text-[11px] font-extrabold uppercase tracking-wider text-zinc-400">
            {section.sectionTitle}
          </h3>
          <div className="space-y-1">
            {section.items.map((item, idx) => {
              const active = isActive(item.href);

              if (item.disabled) {
                return (
                  <div
                    key={idx}
                    className="flex min-h-[44px] items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-zinc-400 cursor-not-allowed opacity-60"
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
                  className={`flex min-h-[44px] items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold touch-manipulation transition-all duration-100 active:scale-[0.98] ${
                    active
                      ? 'bg-zinc-950 text-white font-bold shadow-sm'
                      : 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 active:bg-zinc-200'
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
      <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-zinc-200 bg-white/90 px-3 sm:px-6 backdrop-blur min-w-0">
        {/* Left Side: Logo & Active Branch Switcher */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0 touch-manipulation active:scale-[0.98]">
            <span className="rounded-lg bg-zinc-950 px-2 py-1 sm:px-2.5 sm:py-1.5 text-[11px] sm:text-xs font-extrabold text-white tracking-widest">
              WSNEXA
            </span>
          </Link>

          <span className="text-zinc-300 shrink-0">|</span>

          {/* Active Business & Branch Switcher */}
          <div className="flex items-center gap-2 min-w-0 flex-1 max-w-[210px] xs:max-w-[280px] sm:max-w-none">
            <Badge variant="neutral" className="hidden font-semibold text-zinc-900 md:inline-flex shrink-0">
              🏢 {businessName}
            </Badge>

            <ActiveBranchSwitcher
              activeBranch={activeBranch}
              branches={branches}
              isOwner={userRole === 'business_owner'}
            />
          </div>
        </div>

        {/* Right Side: Desktop Profile Trigger & Mobile Navigation Hamburger */}
        <div className="flex items-center gap-2 shrink-0">
          {/* User Profile Dropdown Trigger (Desktop >= 1024px) */}
          <div className="relative hidden lg:block">
            <button
              type="button"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex min-h-[44px] items-center gap-1.5 sm:gap-2 rounded-full border border-zinc-200 bg-zinc-50 py-1 px-2.5 sm:px-3 text-xs font-medium text-zinc-800 hover:bg-zinc-100 active:bg-zinc-200 touch-manipulation active:scale-[0.98] focus:outline-none"
            >
              <span className="font-bold text-zinc-950 max-w-[140px] truncate">{userName || userEmail}</span>
              <Badge variant="neutral" className="text-[10px] uppercase">
                {formatRoleLabel(userRole)}
              </Badge>
              <svg className="h-3.5 w-3.5 text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-zinc-200 bg-white p-2 shadow-xl z-50">
                <div className="border-b border-zinc-100 px-3 py-2">
                  <p className="text-xs font-bold text-zinc-950">{userName || 'User Profile'}</p>
                  <p className="text-[11px] text-zinc-500 truncate">{userEmail}</p>
                  <p className="mt-1 text-[10px] text-zinc-400 font-medium">Role: {formatRoleLabel(userRole)}</p>
                </div>

                <div className="py-1">
                  <form action="/api/auth/logout" method="POST">
                    <button
                      type="submit"
                      className="flex min-h-[44px] w-full items-center rounded-xl px-3 py-2 text-left text-xs font-bold text-red-600 hover:bg-red-50 active:bg-red-100 touch-manipulation focus:outline-none"
                    >
                      🚪 Sign Out
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Drawer Hamburger (< 1024px) */}
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl p-2 text-zinc-700 hover:bg-zinc-100 active:bg-zinc-200 touch-manipulation active:scale-[0.95] lg:hidden focus:outline-none"
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
        </div>
      </header>

      {/* Main Body with Sidebar + Content */}
      <div className="flex flex-1 min-w-0">
        {/* Desktop Sidebar */}
        <aside className="hidden w-64 border-r border-zinc-200 bg-white p-4 lg:block shrink-0 overflow-y-auto max-h-[calc(100vh-4rem)] sticky top-16">
          {renderNavLinks()}
        </aside>

        {/* Mobile Drawer Overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="relative z-50 w-72 sm:w-80 max-w-[85vw] bg-white p-5 flex flex-col justify-between shadow-2xl overflow-y-auto max-h-screen">
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                  <span className="font-black text-sm text-zinc-950 uppercase tracking-wider">Navigation Menu</span>
                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center text-zinc-500 hover:text-zinc-950 text-xs font-extrabold touch-manipulation"
                  >
                    ✕ Close
                  </button>
                </div>

                {/* Mobile Business & Branch Header */}
                <div className="rounded-2xl bg-zinc-50 p-3.5 space-y-1 border border-zinc-200/80">
                  <p className="text-xs font-black text-zinc-950 truncate">🏢 {businessName}</p>
                  <p className="text-xs font-semibold text-zinc-700 truncate">📍 {activeBranch?.name || 'Primary Branch'}</p>
                </div>

                {renderNavLinks()}
              </div>

              {/* Persistent Mobile Account Footer */}
              <div className="border-t border-zinc-200 pt-4 mt-6 space-y-3 shrink-0">
                <div className="rounded-xl bg-zinc-50 p-3 space-y-1 border border-zinc-200/60">
                  <div className="font-extrabold text-xs text-zinc-950 truncate">{userName || userEmail}</div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-zinc-700">{formatRoleLabel(userRole)}</span>
                    <span className="text-zinc-500 truncate max-w-[120px]">📍 {activeBranch?.name || 'Branch'}</span>
                  </div>
                </div>

                <form action="/api/auth/logout" method="POST">
                  <button
                    type="submit"
                    className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-extrabold text-xs uppercase tracking-wider transition-all shadow-sm touch-manipulation"
                  >
                    🚪 Sign Out
                  </button>
                </form>
              </div>
            </aside>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
};
