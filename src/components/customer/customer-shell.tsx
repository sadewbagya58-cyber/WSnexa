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

  const navItems = [
    { label: 'Home', href: '/customer' },
    { label: 'My Orders', href: '/customer/orders' },
    { label: 'Venues', href: '/customer/venues' },
    { label: 'Favorites', href: '/customer/favorites' },
    { label: 'Profile', href: '/customer/profile' },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      {/* Customer Header Bar */}
      <header className="sticky top-0 z-40 bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/customer" className="flex items-center gap-2 text-white font-black text-lg uppercase tracking-wider">
              <span className="text-amber-500 text-2xl">🍽️</span> WSNexa Customer
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
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
              className="flex items-center gap-2 bg-zinc-950 p-1.5 pl-3 rounded-full border border-zinc-800 hover:border-zinc-700 transition-all"
            >
              <span className="text-xs font-semibold text-zinc-200">{displayName}</span>
              <div className="w-7 h-7 rounded-full bg-amber-500 text-black font-bold text-xs flex items-center justify-center">
                {displayName.charAt(0).toUpperCase()}
              </div>
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-2 z-50 space-y-1">
                <div className="px-3 py-2 border-b border-zinc-800">
                  <div className="text-xs font-bold text-white truncate">{displayName}</div>
                  <div className="text-[10px] text-zinc-500 truncate">{email}</div>
                </div>

                {hasBusinessAccess && (
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-amber-400 hover:bg-amber-500/10 transition-colors"
                  >
                    <span>🏢</span> Switch to Business Workspace
                  </Link>
                )}

                <Link
                  href="/customer/profile"
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-zinc-300 hover:bg-zinc-800 transition-colors"
                >
                  <span>👤</span> Account Settings
                </Link>

                <a
                  href="/api/auth/logout"
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-rose-400 hover:bg-rose-500/10 transition-colors"
                >
                  <span>🚪</span> Log Out
                </a>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">{children}</main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-900 border-t border-zinc-800 px-4 py-2 flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${
                isActive ? 'text-amber-400' : 'text-zinc-500'
              }`}
            >
              <span>{item.label === 'Home' ? '🏠' : item.label === 'My Orders' ? '🧾' : item.label === 'Favorites' ? '⭐' : '👤'}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
