'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { ActiveBranchSwitcher } from '@/components/layout/active-branch-switcher';
import { SidebarBranchPicker } from '@/components/layout/sidebar-branch-picker';
import {
  DashboardNavSectionDTO,
  CANONICAL_DASHBOARD_NAV_SECTIONS,
  isNavItemActive,
  getParentNavPath,
} from '@/lib/navigation/dashboard-navigation';
import { NavSearchTrigger, NavSearchModal } from '@/components/layout/nav-search';
import { getPageMetadata } from '@/lib/navigation/dashboard-page-metadata';
import { getRequiredPermissionForRoute } from '@/lib/security/route-permissions';
import { BranchInfo, TenantSubscriptionInfo } from '@/types';

import { NotificationBell } from '@/components/notifications/notification-bell';
import { SubscriptionRealtimeListener } from '@/components/subscription/subscription-realtime-listener';
import { RoutePrefetcher } from '@/components/layout/route-prefetcher';
import { HelpLanguageProvider } from '@/components/help/help-language-context';


interface DashboardShellProps {
  children: React.ReactNode;
  userId?: string;
  businessId?: string;
  userRole: string;
  userCustomRoleId?: string | null;
  userCustomRoleName?: string | null;
  userPermissions?: string[];
  navSections?: DashboardNavSectionDTO[];
  userName?: string;
  userEmail?: string;
  businessName: string;
  activeBranch: BranchInfo | null;
  branches: BranchInfo[];
  subscription?: TenantSubscriptionInfo;
}

function formatRoleLabel(role: string, customRoleName?: string | null): string {
  // If member has a custom role, display the custom role name, not the internal base role key
  if (customRoleName) return customRoleName;
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
  userId,
  businessId,
  userRole,
  userCustomRoleId: _userCustomRoleId,
  userCustomRoleName,
  userPermissions = [],
  navSections,
  userName,
  userEmail,
  businessName,
  activeBranch,
  branches,
  subscription,
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Suspended Business Owner redirection to subscription settings
  useEffect(() => {
    const isSuspended = subscription?.effectiveStatus === 'SUSPENDED' || subscription?.effectiveStatus === 'CANCELLED';
    if (isSuspended && userRole === 'business_owner' && pathname !== '/dashboard/settings/subscription') {
      router.replace('/dashboard/settings/subscription');
    }
  }, [subscription?.effectiveStatus, userRole, pathname, router]);

  // Close drawer on path change (runs at render time to avoid effect-based setState lint)
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setMobileOpen(false);
    setUserMenuOpen(false);
  }

  // Close drawer & menu on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileOpen(false);
        setUserMenuOpen(false);
      }
    };
    if (mobileOpen || userMenuOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, userMenuOpen]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [isSearchOpen, setIsSearchOpen] = useState(false);

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
          const candidatePerms = Array.isArray(requiredPerm) ? requiredPerm : [requiredPerm];
          return candidatePerms.some((p) => userPermissions.includes(p));
        }).map((item) => ({
          id: item.id,
          label: item.label,
          href: item.href,
          icon: item.icon,
          badge: item.badge,
          aliases: item.aliases,
          custom: item.custom,
          children: item.children?.filter((child) => {
            if (userRole === 'business_owner') return true;
            const requiredPerm = child.requiredPermission || getRequiredPermissionForRoute(child.href);
            if (!requiredPerm) return true;
            const candidatePerms = Array.isArray(requiredPerm) ? requiredPerm : [requiredPerm];
            return candidatePerms.some((p) => userPermissions.includes(p));
          }).map((child) => ({
            id: child.id,
            label: child.label,
            href: child.href,
            icon: child.icon,
            badge: child.badge,
            aliases: child.aliases,
            custom: child.custom,
          })),
        })),
      }))
      .filter((sec) => sec.items.length > 0);

  // Auto-expand active group containing current route on mount / route transition
  useEffect(() => {
    const activeParent = getParentNavPath(pathname);
    allowedNavSections.forEach((sec) => {
      sec.items.forEach((item) => {
        if (item.children && item.children.length > 0) {
          if (
            item.href === activeParent ||
            item.children.some((c) => isNavItemActive(c, pathname))
          ) {
            setExpandedGroups((prev) => (prev[item.id] ? prev : { ...prev, [item.id]: true }));
          }
        }
      });
    });
  }, [pathname, allowedNavSections]);

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const renderNavSection = (sec: DashboardNavSectionDTO, isMobile: boolean) => (
    <div key={sec.id} className="space-y-1">
      <h3 className="px-3 text-[10px] font-black uppercase tracking-wider text-zinc-400">
        {sec.title}
      </h3>
      <div className="space-y-1 pt-1">
        {sec.items.map((item) => {
          const hasChildren = Boolean(item.children && item.children.length > 0);
          const isExpanded = Boolean(expandedGroups[item.id]);
          const isGroupActive = isNavItemActive(item, pathname);
          const hasActiveChild = Boolean(item.children?.some((c) => isNavItemActive(c, pathname)));

          // Single direct destination (Dashboard, Reservations, Reports)
          if (!hasChildren) {
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                onClick={() => {
                  if (isMobile) setMobileOpen(false);
                }}
                aria-current={isGroupActive ? 'page' : undefined}
                className={`flex min-h-[42px] items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition-all touch-manipulation active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 ${
                  isGroupActive
                    ? 'bg-zinc-950 text-white shadow-xs'
                    : 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 active:bg-zinc-200'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 truncate">
                  {item.icon && <span className="text-base select-none shrink-0">{item.icon}</span>}
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && <Badge variant="neutral">{item.badge}</Badge>}
              </Link>
            );
          }

          // Collapsible Group
          return (
            <div key={item.id} className="space-y-0.5">
              {/* Group Header Button */}
              <button
                type="button"
                onClick={() => toggleGroup(item.id)}
                aria-expanded={isExpanded}
                className={`w-full flex min-h-[42px] items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition-all touch-manipulation active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 ${
                  hasActiveChild || isGroupActive
                    ? 'bg-zinc-100/90 text-zinc-950 font-black'
                    : 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 active:bg-zinc-200'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 truncate">
                  {item.icon && <span className="text-base select-none shrink-0">{item.icon}</span>}
                  <span className="truncate">{item.label}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {item.badge && <Badge variant="neutral">{item.badge}</Badge>}
                  <svg
                    className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${
                      isExpanded ? 'rotate-90 text-zinc-800' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>

              {/* Collapsible Children */}
              {isExpanded && item.children && (
                <div className="ml-4 pl-2.5 border-l-2 border-zinc-200 space-y-0.5 py-0.5">
                  {item.children.map((child) => {
                    const isChildActive = isNavItemActive(child, pathname);

                    // Mobile custom branch picker
                    if (child.custom && child.href === '/dashboard/branches' && isMobile) {
                      return (
                        <SidebarBranchPicker
                          key={child.href}
                          activeBranch={activeBranch}
                          branches={branches}
                          isOwner={userRole === 'business_owner'}
                          onClose={() => setMobileOpen(false)}
                        />
                      );
                    }

                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        prefetch={true}
                        onClick={() => {
                          if (isMobile) setMobileOpen(false);
                        }}
                        aria-current={isChildActive ? 'page' : undefined}
                        className={`flex min-h-[38px] items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-all touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 ${
                          isChildActive
                            ? 'bg-zinc-950 text-white shadow-xs font-bold'
                            : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 font-medium'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 truncate">
                          {child.icon && (
                            <span className="text-xs select-none shrink-0 opacity-80">{child.icon}</span>
                          )}
                          <span className="truncate">{child.label}</span>
                        </div>
                        {child.badge && (
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono uppercase font-semibold ${
                              isChildActive ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-100 text-zinc-600'
                            }`}
                          >
                            {child.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderDesktopNavLinks = () => (
    <nav aria-label="Desktop Navigation" className="space-y-6">
      {allowedNavSections.map((sec) => renderNavSection(sec, false))}
    </nav>
  );

  const renderMobileNavLinks = () => (
    <nav aria-label="Mobile Navigation" className="space-y-6">
      {allowedNavSections.map((sec) => renderNavSection(sec, true))}
    </nav>
  );

  // ── JSX ──────────────────────────────────────────────────────────────────

  return (
    <HelpLanguageProvider>
      <div className="min-h-screen bg-zinc-50 flex flex-col antialiased">

      <RoutePrefetcher />
      {businessId && (
        <SubscriptionRealtimeListener
          businessId={businessId}
          userRole={userRole}
          subscription={subscription}
        />
      )}

      {/* ── Top Bar Header ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 flex min-h-[4rem] w-full items-center justify-between border-b border-zinc-200 bg-white/95 px-3 sm:px-6 backdrop-blur min-w-0 pt-[env(safe-area-inset-top,0px)] pb-1 sm:pb-0">

        {/* Left: Logo + (mobile) business badge | (desktop) business + branch switcher */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0 touch-manipulation active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 rounded-lg">
            <span className="rounded-lg bg-zinc-950 px-2 py-1 sm:px-2.5 sm:py-1.5 text-[11px] sm:text-xs font-extrabold text-white tracking-widest">
              WSNEXA
            </span>
          </Link>

          <span className="text-zinc-300 shrink-0 select-none">|</span>

          {/* Mobile: compact business name only */}
          <span className="lg:hidden text-xs font-bold text-zinc-700 truncate max-w-[120px] xs:max-w-[160px]">
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

        {/* Right: Help & Guides + Notification Bell + Desktop profile dropdown + mobile hamburger */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <Link
            href="/dashboard/help"
            title="Help & Guides"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl p-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
            aria-label="Help and Documentation"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </Link>

          {userId && businessId && (
            <NotificationBell userId={userId} businessId={businessId} />
          )}

          {/* Desktop user profile dropdown */}
          <div className="relative hidden lg:block">
            <button
              type="button"
              aria-expanded={userMenuOpen}
              aria-haspopup="true"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex min-h-[44px] items-center gap-1.5 sm:gap-2 rounded-full border border-zinc-200 bg-zinc-50 py-1 px-2.5 sm:px-3 text-xs font-medium text-zinc-800 hover:bg-zinc-100 active:bg-zinc-200 touch-manipulation active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
            >
              <span className="font-bold text-zinc-950 max-w-[140px] truncate">{userName || userEmail}</span>
              <Badge variant="neutral" className="text-[10px] uppercase">
                {formatRoleLabel(userRole, userCustomRoleName)}
              </Badge>
              <svg className="h-3.5 w-3.5 text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {userMenuOpen && (
              <div role="menu" className="absolute right-0 mt-2 w-56 rounded-2xl border border-zinc-200 bg-white p-2 shadow-xl z-50">
                <div className="border-b border-zinc-100 px-3 py-2">
                  <p className="text-xs font-bold text-zinc-950">{userName || 'User Profile'}</p>
                  <p className="text-[11px] text-zinc-500 truncate">{userEmail}</p>
                  <p className="mt-1 text-[10px] text-zinc-400 font-medium">Role: {formatRoleLabel(userRole, userCustomRoleName)}</p>
                </div>
                <div className="py-1 border-b border-zinc-100">
                  <Link
                    href="/dashboard/help"
                    role="menuitem"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
                  >
                    ❓ Help & Guides
                  </Link>
                  {userRole === 'business_owner' && (
                    <Link
                      href="/dashboard/settings/subscription"
                      role="menuitem"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
                    >
                      💳 Subscription & Billing
                    </Link>
                  )}
                </div>
                <div className="py-1">
                  <form action="/api/auth/logout" method="POST">
                    <button
                      type="submit"
                      role="menuitem"
                      className="flex min-h-[44px] w-full items-center rounded-xl px-3 py-2 text-left text-xs font-bold text-red-600 hover:bg-red-50 active:bg-red-100 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
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
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl p-2 text-zinc-700 hover:bg-zinc-100 active:bg-zinc-200 touch-manipulation active:scale-[0.95] lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
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
          <NavSearchTrigger onClick={() => setIsSearchOpen(true)} className="mb-4" />
          {renderDesktopNavLinks()}
        </aside>

        {/* Mobile Drawer Overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            {/* Backdrop */}
            <div
              role="button"
              tabIndex={0}
              aria-label="Close navigation drawer"
              className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
              onClick={() => setMobileOpen(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
                  setMobileOpen(false);
                }
              }}
            />

            {/* Drawer panel */}
            <aside
              role="dialog"
              aria-modal="true"
              aria-label="Navigation drawer"
              className="relative z-50 w-72 sm:w-80 max-w-[85vw] bg-white p-5 pt-[calc(1.25rem+env(safe-area-inset-top,0px))] pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] flex flex-col justify-between shadow-2xl overflow-y-auto max-h-screen"
            >
              <div className="space-y-4">
                {/* Drawer header */}
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                  <span className="font-black text-sm text-zinc-950 uppercase tracking-wider">Navigation</span>
                  <button
                    type="button"
                    aria-label="Close navigation drawer"
                    onClick={() => setMobileOpen(false)}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center text-zinc-500 hover:text-zinc-950 text-xs font-extrabold touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 rounded-lg"
                  >
                    ✕
                  </button>
                </div>

                {/* Business card */}
                <div className="rounded-2xl bg-zinc-50 p-3.5 border border-zinc-200/80">
                  <p className="text-xs font-black text-zinc-950 truncate">🏢 {businessName}</p>
                </div>

                {/* Mobile Navigation Search Trigger */}
                <NavSearchTrigger
                  onClick={() => setIsSearchOpen(true)}
                  isMobile={true}
                  className="mb-1"
                />

                {/* Mobile Branch Switcher */}
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                    Active Branch
                  </span>
                  <ActiveBranchSwitcher
                    activeBranch={activeBranch}
                    branches={branches}
                    isOwner={userRole === 'business_owner'}
                  />
                </div>

                {/* Mobile nav links (with SidebarBranchPicker for Branches) */}
                {renderMobileNavLinks()}
              </div>

              {/* Account footer */}
              <div className="border-t border-zinc-200 pt-4 mt-6 space-y-3 shrink-0">
                <div className="rounded-xl bg-zinc-50 p-3 space-y-1 border border-zinc-200/60">
                  <div className="font-extrabold text-xs text-zinc-950 truncate">{userName || userEmail}</div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-zinc-700">{formatRoleLabel(userRole, userCustomRoleName)}</span>
                    <span className="text-zinc-500 truncate max-w-[120px]">📍 {activeBranch?.name || 'Branch'}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <Link
                    href="/dashboard/help"
                    onClick={() => setMobileOpen(false)}
                    className="flex min-h-[44px] items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 transition-colors"
                  >
                    ❓ Help & Guides
                  </Link>
                  {userRole === 'business_owner' && (
                    <Link
                      href="/dashboard/settings/subscription"
                      onClick={() => setMobileOpen(false)}
                      className="flex min-h-[44px] items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 transition-colors"
                    >
                      💳 Subscription & Billing
                    </Link>
                  )}
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
        {(() => {
          const meta = getPageMetadata(pathname);
          const layoutVariant = meta.layoutVariant || 'standard';
          let mainClasses = 'flex-1 min-w-0 w-full';
          if (layoutVariant === 'workspace') {
            mainClasses += ' p-2 sm:p-4 lg:p-6 max-w-full';
          } else if (layoutVariant === 'wide') {
            mainClasses += ' p-4 sm:p-6 lg:p-8 max-w-full';
          } else {
            mainClasses += ' p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto';
          }
          return (
            <main className={mainClasses}>
              {subscription?.effectiveStatus === 'GRACE_PERIOD' && (
                <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">⚠️</span>
                    <div>
                      <p className="font-extrabold text-xs uppercase tracking-wider text-amber-900">Subscription Grace Period Active</p>
                      <p className="text-xs text-amber-800 font-medium">
                        Your subscription has expired. You have {subscription.daysRemaining} {subscription.daysRemaining === 1 ? 'day' : 'days'} remaining before service suspension.
                      </p>
                    </div>
                  </div>
                  {userRole === 'business_owner' && (
                    <Link
                      href="/dashboard/settings/subscription"
                      className="shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition-colors shadow-sm"
                    >
                      Renew Plan
                    </Link>
                  )}
                </div>
              )}
              {subscription?.effectiveStatus === 'TRIALING' && subscription.daysRemaining <= 3 && (
                <div className="mb-4 rounded-xl border border-blue-300 bg-blue-50 p-4 text-blue-950 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">ℹ️</span>
                    <div>
                      <p className="font-extrabold text-xs uppercase tracking-wider text-blue-900">Free Trial Ending Soon</p>
                      <p className="text-xs text-blue-800 font-medium">
                        Your free trial ends in {subscription.daysRemaining} {subscription.daysRemaining === 1 ? 'day' : 'days'}. Upgrade your plan to maintain uninterrupted service.
                      </p>
                    </div>
                  </div>
                  {userRole === 'business_owner' && (
                    <Link
                      href="/dashboard/settings/subscription"
                      className="shrink-0 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors shadow-sm"
                    >
                      Upgrade Plan
                    </Link>
                  )}
                </div>
              )}
              {children}
            </main>
          );
        })()}
      </div>

      {/* Singleton Global Navigation Search Modal */}
      <NavSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onOpen={() => setIsSearchOpen(true)}
        navSections={allowedNavSections}
        onSelectDestination={() => {
          setIsSearchOpen(false);
          setMobileOpen(false);
        }}
      />
      </div>
    </HelpLanguageProvider>
  );
};

