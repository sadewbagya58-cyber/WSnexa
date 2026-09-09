'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { PublicBottomNav } from '@/components/discovery/public-bottom-nav';

interface CustomerShellProps {
  displayName: string;
  email: string;
  hasBusinessAccess: boolean;
  businessRole?: string | null;
  children: React.ReactNode;
}

export function CustomerShell({ displayName, email, hasBusinessAccess, businessRole, children }: CustomerShellProps) {
  const pathname = usePathname();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [originRole, setOriginRole] = useState<string | null>(businessRole || null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('wsnexa_origin_role');
      if (stored) {
        setOriginRole(stored);
      }
    }
  }, []);

  const isStaffRole = originRole ? ['waiter', 'kitchen_staff', 'cashier'].includes(originRole) : false;
  const backLabel = isStaffRole ? 'Back to Staff' : 'Back to Business';
  const backIcon = isStaffRole ? '↩' : '🏢';

  const desktopNavItems = [
    { label: 'Home', href: '/customer' },
    { label: 'Explore', href: '/explore' },
    { label: 'Reservations', href: '/customer/reservations' },
    { label: 'Orders', href: '/customer/orders' },
    { label: 'Favorites', href: '/customer/favorites' },
    { label: 'Loyalty', href: '/customer/loyalty' },
    { label: 'Profile', href: '/customer/profile' },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950 flex flex-col font-sans antialiased pb-20 md:pb-0">
      {/* Context Indicator Banner for Business/Staff Switchers */}
      {hasBusinessAccess && (
        <div className="bg-zinc-950 text-zinc-200 text-xs px-4 py-2 flex items-center justify-between border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2 text-[11px] font-medium truncate">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-zinc-400">Viewing customer mode as</span>
            <span className="text-white font-bold truncate max-w-[120px] sm:max-w-[200px]">{displayName}</span>
            <span className="text-zinc-400 font-mono text-[10px] hidden sm:inline">
              ({isStaffRole ? 'Staff Account' : 'Business Account'})
            </span>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-amber-400 font-bold text-[11px] transition-colors shrink-0 ml-2"
          >
            <span>{backIcon}</span>
            <span>{backLabel}</span>
            <span>&rarr;</span>
          </Link>
        </div>
      )}

      {/* Customer Header Bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-zinc-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-6 min-w-0">
            <Link href="/customer" className="flex items-center gap-2 text-zinc-950 font-black text-lg uppercase tracking-wider shrink-0">
              <span className="text-2xl">🍽️</span> WSNexa Customer
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {desktopNavItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                      isActive
                        ? 'bg-zinc-950 text-white shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right User Avatar Dropdown & Workspace Switcher */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {hasBusinessAccess && (
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900 text-white hover:bg-zinc-800 active:scale-95 text-xs font-black shadow-xs transition-all border border-zinc-700 touch-manipulation min-h-[38px]"
                title={isStaffRole ? 'Return to Staff Workspace' : 'Return to Business Dashboard'}
              >
                <span>{backIcon}</span>
                <span className="hidden sm:inline">{backLabel}</span>
                <span className="sm:hidden">{isStaffRole ? 'Staff' : 'Business'}</span>
              </Link>
            )}

            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 bg-zinc-100 p-1.5 pl-3 rounded-full border border-zinc-200 hover:bg-zinc-200/80 transition-all touch-manipulation min-h-[40px]"
              >
                <span className="text-xs font-extrabold text-zinc-900 max-w-[100px] sm:max-w-[140px] truncate">{displayName}</span>
                <div className="w-7 h-7 rounded-full bg-zinc-950 text-white font-black text-xs flex items-center justify-center shadow-xs">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-60 bg-white border border-zinc-200 rounded-2xl shadow-2xl p-2 z-50 space-y-1 animate-in fade-in slide-in-from-top-1">
                    <div className="px-3 py-2 border-b border-zinc-100">
                      <div className="text-xs font-black text-zinc-950 truncate">{displayName}</div>
                      <div className="text-[10px] text-zinc-500 truncate">{email}</div>
                    </div>

                    {hasBusinessAccess && (
                      <Link
                        href="/dashboard"
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-extrabold text-zinc-900 hover:bg-zinc-100 transition-colors"
                      >
                        <span>{backIcon}</span> {backLabel}
                      </Link>
                    )}

                    <Link
                      href="/customer/profile"
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition-colors"
                    >
                      <span>👤</span> Account Profile
                    </Link>

                    <form action="/api/auth/logout" method="POST">
                      <button
                        type="submit"
                        className="flex w-full items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition-colors min-h-[44px] touch-manipulation"
                      >
                        <span>🚪</span> Log Out
                      </button>
                    </form>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">{children}</main>

      {/* Mobile Bottom Navigation */}
      <PublicBottomNav mode="customer" isLoggedIn={true} />
    </div>
  );
}
