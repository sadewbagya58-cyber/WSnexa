'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface CustomerShellProps {
  displayName: string;
  email: string;
  hasBusinessAccess: boolean;
  children: React.ReactNode;
}

export function CustomerShell({ displayName, email, hasBusinessAccess, children }: CustomerShellProps) {
  const pathname = usePathname();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const desktopNavItems = [
    { label: 'Home', href: '/customer' },
    { label: 'Explore', href: '/explore' },
    { label: 'Orders', href: '/customer/orders' },
    { label: 'Favorites', href: '/customer/favorites' },
    { label: 'Loyalty', href: '/customer/loyalty' },
    { label: 'Profile', href: '/customer/profile' },
  ];

  const mobileNavItems = [
    { label: 'Home', href: '/customer', icon: '🏠' },
    { label: 'Explore', href: '/explore', icon: '🔍' },
    { label: 'Orders', href: '/customer/orders', icon: '🧾' },
    { label: 'Loyalty', href: '/customer/loyalty', icon: '🎁' },
    { label: 'Profile', href: '/customer/profile', icon: '👤' },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950 flex flex-col font-sans antialiased pb-16 md:pb-0">
      {/* Customer Header Bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-zinc-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/customer" className="flex items-center gap-2 text-zinc-950 font-black text-lg uppercase tracking-wider">
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
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 bg-zinc-100 p-1.5 pl-3 rounded-full border border-zinc-200 hover:bg-zinc-200/80 transition-all touch-manipulation min-h-[40px]"
            >
              <span className="text-xs font-extrabold text-zinc-900">{displayName}</span>
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
                      <span>🏢</span> Business Workspace
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
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">{children}</main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-zinc-200 px-3 py-2 flex items-center justify-around shadow-lg safe-area-pb">
        {mobileNavItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 py-1 px-3 min-h-[44px] rounded-xl transition-all ${
                isActive ? 'text-zinc-950 font-black scale-105' : 'text-zinc-500 font-medium hover:text-zinc-800'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span className="text-[10px] uppercase tracking-wider font-extrabold">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
