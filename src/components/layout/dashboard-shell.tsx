'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { ActiveBranchSwitcher } from '@/components/layout/active-branch-switcher';
import { SidebarBranchPicker } from '@/components/layout/sidebar-branch-picker';
import {
  DashboardNavSectionDTO,
  CANONICAL_DASHBOARD_NAV_SECTIONS,
  isNavItemActive,
} from '@/lib/navigation/dashboard-navigation';
import { getRequiredPermissionForRoute } from '@/lib/security/route-permissions';
import { BranchInfo } from '@/types';

interface DashboardShellProps {
  children: React.ReactNode;
  userRole: string;
  userPermissions?: string[];
  navSections?: DashboardNavSectionDTO[];
  userName?: string;
  userEmail?: string;
  businessName: string;
  activeBranch: BranchInfo | null;
  branches: BranchInfo[];
}

function formatRoleLabel(role: string): string {
  switch (role) {
    case 'business_owner':   return 'Business Owner';
    case 'branch_manager':   return 'Branch Manager';
    case 'cashier':          return 'Cashier';
    case 'kitchen_staff':    return 'Kitchen';
    case 'waiter':           return 'Waiter';
    default:                 return role.replace(/_/g, ' ');
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export const DashboardShell: React.FC<DashboardShellProps> = ({
  children,
  userRole,
  userPermissions = [],
  navSections,
  userName,
  userEmail,
  businessName,
  activeBranch,
  branches,
}) => {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Close drawer on path change (runs at render time to avoid effect-based setState lint)
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setMobileOpen(false);
    setUserMenuOpen(false);
  }

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  // Derived or injected navigation sections (Single Source of Truth for Desktop & Mobile)
  const allowedNavSections: DashboardNavSectionDTO[] = navSections ||
    CANONICAL_DASHBOARD_NAV_SECTIONS
      .map((sec) => ({
        id: sec.id,
        title: sec.title,
        items: sec.items.filter((item) => {
          if (userRole === 'business_owner') return true;
          const requiredPerm = item.requiredPermission || getRequiredPermissionForRoute(item.href);
          if (!requiredPerm) return true;
          return userPermissions.includes(requiredPerm);
        }).map((item) => ({
          id: item.id,
          label: item.label,
          href: item.href,
          badge: item.badge,
          custom: item.custom,
        })),
      }))
      .filter((sec) => sec.items.length > 0);

  // ── Desktop nav: plain links for every item ──────────────────────────────

  const renderDesktopNavLinks = () => (
    <div className="space-y-6">
      {allowedNavSections.map((sec) => (
        <div key={sec.id} className="space-y-1">
          <h3 className="px-3 text-[10px] font-black uppercase tracking-wider text-zinc-400">
            {sec.title}
          </h3>
          <div className="space-y-0.5 pt-1">
            {sec.items.map((item) => {
              const isActive = isNavItemActive(item, pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex min-h-[44px] items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition-all touch-manipulation active:scale-[0.98] ${
                    isActive
                      ? 'bg-zinc-950 text-white shadow-xs'
                      : 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 active:bg-zinc-200'
                  }`}
                >
                  <span className="truncate">{item.label}</span>
                  {item.badge && <Badge variant="neutral">{item.badge}</Badge>}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  // ── Mobile nav: Branches item replaced by SidebarBranchPicker ────────────

  const renderMobileNavLinks = () => (
    <div className="space-y-6">
      {allowedNavSections.map((sec) => (
        <div key={sec.id} className="space-y-1">
          <h3 className="px-3 text-[10px] font-black uppercase tracking-wider text-zinc-400">
            {sec.title}
          </h3>
          <div className="space-y-0.5 pt-1">
            {sec.items.map((item) => {
              const isActive = isNavItemActive(item, pathname);

              // Branches: render expandable picker on mobile
              if (item.custom && item.href === '/dashboard/branches') {
                return (
                  <SidebarBranchPicker
                    key={item.href}
                    activeBranch={activeBranch}
                    branches={branches}
                    isOwner={userRole === 'business_owner'}
                    onClose={() => setMobileOpen(false)}
                  />
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex min-h-[44px] items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition-all touch-manipulation active:scale-[0.98] ${
                    isActive
                      ? 'bg-zinc-950 text-white shadow-xs'
                      : 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 active:bg-zinc-200'
                  }`}
                >
                  <span className="truncate">{item.label}</span>
                  {item.badge && <Badge variant="neutral">{item.badge}</Badge>}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  // ── JSX ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col antialiased">

      {/* ── Top Bar Header ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 flex min-h-[4rem] w-full items-center justify-between border-b border-zinc-200 bg-white/95 px-3 sm:px-6 backdrop-blur min-w-0 pt-[env(safe-area-inset-top,0px)] pb-1 sm:pb-0">

        {/* Left: Logo + (mobile) business badge | (desktop) business + branch switcher */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0 touch-manipulation active:scale-[0.98]">
            <span className="rounded-lg bg-zinc-950 px-2 py-1 sm:px-2.5 sm:py-1.5 text-[11px] sm:text-xs font-extrabold text-white tracking-widest">
              WSNEXA
            </span>
          </Link>

          <span className="text-zinc-300 shrink-0">|</span>

          {/* Mobile: compact business name only */}
          <span className="lg:hidden text-xs font-bold text-zinc-700 truncate max-w-[140px] xs:max-w-[180px]">
            🏢 {businessName}
          </span>

          {/* Desktop ≥ 1024px: full business + active branch switcher */}
          <div className="hidden lg:flex items-center gap-2 min-w-0">
            <Badge variant="neutral" className="font-semibold text-zinc-900 shrink-0">
              🏢 {businessName}
            </Badge>
            <ActiveBranchSwitcher
              activeBranch={activeBranch}
              branches={branches}
              isOwner={userRole === 'business_owner'}
            />
          </div>
        </div>

        {/* Right: Desktop profile dropdown + mobile hamburger */}
        <div className="flex items-center gap-2 shrink-0">

          {/* Desktop user profile dropdown */}
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

          {/* Mobile hamburger */}
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

      {/* ── Main Body ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-w-0">

        {/* Desktop Sidebar */}
        <aside className="hidden w-64 border-r border-zinc-200 bg-white p-4 lg:block shrink-0 overflow-y-auto max-h-[calc(100vh-4rem-env(safe-area-inset-top,0px))] sticky top-[calc(4rem+env(safe-area-inset-top,0px))]">
          {renderDesktopNavLinks()}
        </aside>

        {/* Mobile Drawer Overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
              onClick={() => setMobileOpen(false)}
            />

            {/* Drawer panel */}
            <aside className="relative z-50 w-72 sm:w-80 max-w-[85vw] bg-white p-5 pt-[calc(1.25rem+env(safe-area-inset-top,0px))] pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] flex flex-col justify-between shadow-2xl overflow-y-auto max-h-screen">
              <div className="space-y-6">
                {/* Drawer header */}
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                  <span className="font-black text-sm text-zinc-950 uppercase tracking-wider">Navigation</span>
                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center text-zinc-500 hover:text-zinc-950 text-xs font-extrabold touch-manipulation"
                  >
                    ✕
                  </button>
                </div>

                {/* Business card */}
                <div className="rounded-2xl bg-zinc-50 p-3.5 border border-zinc-200/80">
                  <p className="text-xs font-black text-zinc-950 truncate">🏢 {businessName}</p>
                </div>

                {/* Mobile nav links (with SidebarBranchPicker for Branches) */}
                {renderMobileNavLinks()}
              </div>

              {/* Account footer */}
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

        {/* Main content */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
};
