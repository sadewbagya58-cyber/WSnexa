'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface PublicBottomNavProps {
  isLoggedIn?: boolean;
}

export function PublicBottomNav({ isLoggedIn = false }: PublicBottomNavProps) {
  const pathname = usePathname();

  const navItems = [
    {
      label: 'Home',
      href: isLoggedIn ? '/customer' : '/',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      active: pathname === '/' || pathname === '/customer',
    },
    {
      label: 'Explore',
      href: '/explore',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
      active: pathname.startsWith('/explore') || pathname.startsWith('/venues'),
    },
    {
      label: 'Favorites',
      href: '/customer/favorites',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      ),
      active: pathname === '/customer/favorites',
    },
    {
      label: 'Bookings',
      href: '/customer/reservations',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      active: pathname === '/customer/reservations',
    },
    {
      label: 'Account',
      href: isLoggedIn ? '/customer/profile' : '/login',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      active: pathname === '/customer/profile' || pathname === '/login',
    },
  ];

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-zinc-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-2 py-1.5 flex items-center justify-around pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]"
    >
      {navItems.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          aria-current={item.active ? 'page' : undefined}
          className={`flex flex-col items-center justify-center gap-1 py-1 px-3 min-h-[48px] min-w-[56px] rounded-2xl transition-all duration-150 touch-manipulation active:scale-[0.94] ${
            item.active
              ? 'text-zinc-950 font-black'
              : 'text-zinc-400 hover:text-zinc-700 font-bold'
          }`}
        >
          <div
            className={`p-1 rounded-xl transition-colors ${
              item.active ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-400'
            }`}
          >
            {item.icon}
          </div>
          <span className="text-[10px] tracking-tight leading-none">
            {item.label}
          </span>
        </Link>
      ))}
    </nav>
  );
}
