'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Badge } from '@/components/ui/badge';

export interface AdminNavbarProps {
  userEmail: string;
  userName: string;
  children?: React.ReactNode;
}

export const ADMIN_NAV_ITEMS = [
  { label: 'Overview', href: '/admin', icon: '📊', exact: true },
  { label: 'Venues', href: '/admin/venues', icon: '🏛️' },
  { label: 'Businesses', href: '/admin/businesses', icon: '🏢' },
  { label: 'Branches', href: '/admin/branches', icon: '📍' },
  { label: 'Users', href: '/admin/users', icon: '👥' },
  { label: 'Super Admins', href: '/admin/super-admins', icon: '🛡️' },
  { label: 'Pilot & Demos', href: '/admin/pilot', icon: '🧪' },
  { label: 'Audit Log', href: '/admin/audit', icon: '📋' },
  { label: 'System Health', href: '/admin/system', icon: '⚡' },
  { label: 'Launch Readiness', href: '/admin/launch-readiness', icon: '🚀' },
];

export function AdminNavbar({ userEmail, userName, children }: AdminNavbarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col antialiased">
      {/* 1. Full-Width Sticky Top Bar Header */}
      <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-zinc-200 bg-white/95 px-3 sm:px-6 backdrop-blur shrink-0 min-w-0">
        {/* Left: Brand + Platform Admin Badge */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link
            href="/admin"
            className="flex items-center gap-2 shrink-0 touch-manipulation active:scale-[0.97] transition-transform"
          >
            <span className="rounded-lg bg-zinc-950 px-2.5 py-1 text-xs font-extrabold text-white tracking-widest">
              WSNEXA
            </span>
          </Link>

          <span className="text-zinc-300 shrink-0">|</span>

          <div className="flex items-center gap-1.5 min-w-0">
            <span className="rounded-md bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[11px] font-black text-amber-700 uppercase tracking-wider shrink-0">
              Platform Admin
            </span>
          </div>
        </div>

        {/* Center: Desktop horizontal quick links for top primary sections */}
        <nav className="hidden xl:flex items-center gap-1">
          {ADMIN_NAV_ITEMS.slice(0, 6).map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-[0.97] ${
                  isActive
                    ? 'bg-zinc-950 text-white shadow-2xs'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right: User Profile Menu & Mobile Hamburger */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/dashboard"
            className="hidden sm:flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-100 active:scale-[0.97] transition-all"
          >
            <span>🏢</span>
            <span>B2B Dashboard</span>
          </Link>

          <Link
            href="/customer"
            className="hidden md:flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-100 active:scale-[0.97] transition-all"
          >
            <span>🍽️</span>
            <span>Customer Portal</span>
          </Link>

          {/* Desktop User Menu Dropdown */}
          <div className="relative hidden sm:block">
            <button
              type="button"
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex min-h-[44px] items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 py-1 px-3 text-xs font-medium text-zinc-800 hover:bg-zinc-100 active:scale-[0.97] touch-manipulation focus:outline-none transition-all cursor-pointer"
              aria-label="User Account Menu"
              aria-expanded={userDropdownOpen}
            >
              <span className="font-black text-zinc-950 max-w-[130px] truncate">{userName || userEmail}</span>
              <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-extrabold text-[9px] uppercase">
                SUPER ADMIN
              </Badge>
              <svg className="h-3.5 w-3.5 text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {userDropdownOpen && (
              <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-zinc-200 bg-white p-2 shadow-xl z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="border-b border-zinc-100 px-3 py-2">
                  <p className="text-xs font-black text-zinc-950">{userName || 'Platform Administrator'}</p>
                  <p className="text-[11px] text-zinc-500 truncate">{userEmail}</p>
                  <p className="mt-1 text-[10px] text-amber-600 font-extrabold">✓ Super Admin Authority Active</p>
                </div>
                <div className="py-1 space-y-1">
                  <Link
                    href="/dashboard"
                    onClick={() => setUserDropdownOpen(false)}
                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50 active:scale-[0.98] transition-all"
                  >
                    🏢 Switch to Business Dashboard
                  </Link>
                  <Link
                    href="/customer"
                    onClick={() => setUserDropdownOpen(false)}
                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50 active:scale-[0.98] transition-all"
                  >
                    🍽️ Switch to Customer Portal
                  </Link>
                  <form action="/api/auth/logout" method="POST">
                    <button
                      type="submit"
                      className="flex min-h-[44px] w-full items-center rounded-xl px-3 py-2 text-left text-xs font-bold text-red-600 hover:bg-red-50 active:scale-[0.98] focus:outline-none transition-all cursor-pointer"
                    >
                      🚪 Sign Out
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl p-2 text-zinc-700 hover:bg-zinc-100 active:scale-[0.95] lg:hidden focus:outline-none transition-all cursor-pointer"
            aria-label="Toggle Navigation Drawer"
            aria-expanded={mobileOpen}
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

      {/* 2. Main Flex Shell: Sidebar + Content (SIDEBAR OCCUPIES REAL LAYOUT SPACE) */}
      <div className="flex flex-1 w-full min-w-0">
        {/* Desktop Sidebar Navigation Column (64 width / 16rem real layout width) */}
        <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-zinc-200 bg-white p-4 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto z-10 select-none">
          <div className="space-y-6">
            <div className="space-y-1">
              <h3 className="px-3 text-[10px] font-black uppercase tracking-wider text-zinc-400">
                PLATFORM CONTROL
              </h3>
              <div className="space-y-0.5 pt-1">
                {ADMIN_NAV_ITEMS.map((item) => {
                  const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 text-xs font-bold transition-all touch-manipulation active:scale-[0.97] ${
                        isActive
                          ? 'bg-zinc-950 text-white shadow-xs'
                          : 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950'
                      }`}
                    >
                      <span className="text-base shrink-0">{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area: Takes Remaining Width & Centers */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>

      {/* 3. Mobile Slide-Over Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          {/* Backdrop Blur */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity duration-200"
            onClick={() => setMobileOpen(false)}
          />

          <aside className="relative z-50 w-72 sm:w-80 max-w-[85vw] bg-white p-5 flex flex-col justify-between shadow-2xl overflow-y-auto max-h-screen animate-in slide-in-from-left duration-200">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm text-zinc-950 uppercase tracking-wider">Super Admin</span>
                  <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-extrabold text-[9px]">
                    PLATFORM
                  </Badge>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center text-zinc-500 hover:text-zinc-950 active:scale-[0.95] text-xs font-extrabold cursor-pointer"
                  aria-label="Close navigation"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-1">
                {ADMIN_NAV_ITEMS.map((item) => {
                  const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 text-xs font-bold transition-all active:scale-[0.97] ${
                        isActive
                          ? 'bg-zinc-950 text-white shadow-xs'
                          : 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950'
                      }`}
                    >
                      <span className="text-base shrink-0">{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Account & Workspace Switcher Footer */}
            <div className="border-t border-zinc-200 pt-4 mt-6 space-y-3 shrink-0">
              <div className="rounded-xl bg-zinc-50 p-3 space-y-1 border border-zinc-200/60">
                <div className="font-extrabold text-xs text-zinc-950 truncate">{userName || userEmail}</div>
                <div className="text-[11px] font-bold text-amber-700">Platform Super Administrator</div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="flex min-h-[44px] items-center justify-center rounded-xl bg-zinc-100 hover:bg-zinc-200 active:scale-[0.97] text-zinc-900 font-extrabold text-xs text-center p-2 transition-all"
                >
                  🏢 B2B
                </Link>
                <Link
                  href="/customer"
                  onClick={() => setMobileOpen(false)}
                  className="flex min-h-[44px] items-center justify-center rounded-xl bg-zinc-100 hover:bg-zinc-200 active:scale-[0.97] text-zinc-900 font-extrabold text-xs text-center p-2 transition-all"
                >
                  🍽️ Customer
                </Link>
              </div>

              <form action="/api/auth/logout" method="POST">
                <button
                  type="submit"
                  className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white font-extrabold text-xs uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                >
                  🚪 Sign Out
                </button>
              </form>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
