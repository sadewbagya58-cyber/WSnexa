'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface PublicNavbarProps {
  isAuthenticated: boolean;
  workspaceRoute: string;
  isSuperAdmin?: boolean;
}

export const PublicNavbar: React.FC<PublicNavbarProps> = ({
  isAuthenticated,
  workspaceRoute,
  isSuperAdmin = false,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2 tracking-tight group">
          <div className="w-8 h-8 bg-zinc-950 text-white font-black text-base flex items-center justify-center rounded-lg shadow-xs group-hover:bg-zinc-800 transition-colors">
            W
          </div>
          <span className="text-lg font-black tracking-wider uppercase text-zinc-950">WSNexa</span>
          <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-600 border border-zinc-200 uppercase">
            OS
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-zinc-600">
          <a href="#features" className="hover:text-zinc-950 transition-colors">
            Product
          </a>
          <a href="#how-it-works" className="hover:text-zinc-950 transition-colors">
            How It Works
          </a>
          <Link href="/explore" className="hover:text-zinc-950 transition-colors">
            Explore Venues
          </Link>
        </nav>

        {/* Desktop Auth Actions */}
        <div className="hidden md:flex items-center gap-3">
          {isSuperAdmin && (
            <Link
              href="/admin"
              className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-50 px-4 text-xs font-black text-amber-900 shadow-2xs hover:bg-amber-100 transition-all"
            >
              <span>🛡️</span>
              <span>Platform Admin</span>
            </Link>
          )}

          {isAuthenticated ? (
            <Link
              href={workspaceRoute}
              className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-zinc-950 px-5 text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-zinc-800 transition-all active:scale-95"
            >
              Go to Workspace →
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex min-h-[40px] items-center justify-center rounded-xl px-4 text-xs font-bold text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100 transition-all"
              >
                Log In
              </Link>
              <Link
                href="/register"
                className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-zinc-950 px-5 text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-zinc-800 transition-all active:scale-95"
              >
                Get Started
              </Link>
            </>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-zinc-200 p-2 text-zinc-700 hover:bg-zinc-100 md:hidden"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="border-b border-zinc-200 bg-white px-4 pt-2 pb-6 md:hidden space-y-4 shadow-lg animate-in slide-in-from-top-2">
          <nav className="flex flex-col space-y-3 text-sm font-semibold text-zinc-700">
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="flex min-h-[44px] items-center rounded-lg px-3 hover:bg-zinc-50"
            >
              Product & Features
            </a>
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="flex min-h-[44px] items-center rounded-lg px-3 hover:bg-zinc-50"
            >
              How It Works
            </a>
            <Link
              href="/explore"
              onClick={() => setMobileMenuOpen(false)}
              className="flex min-h-[44px] items-center rounded-lg px-3 hover:bg-zinc-50"
            >
              Explore Venues
            </Link>
          </nav>

          <div className="pt-2 border-t border-zinc-100 flex flex-col space-y-2">
            {isAuthenticated ? (
              <Link
                href={workspaceRoute}
                onClick={() => setMobileMenuOpen(false)}
                className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-zinc-950 text-center text-xs font-bold uppercase tracking-wider text-white shadow-xs"
              >
                Go to Workspace →
              </Link>
            ) : (
              <>
                <Link
                  href="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-zinc-950 text-center text-xs font-bold uppercase tracking-wider text-white shadow-xs"
                >
                  Get Started
                </Link>
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex min-h-[48px] w-full items-center justify-center rounded-xl border border-zinc-200 text-center text-xs font-bold uppercase tracking-wider text-zinc-900"
                >
                  Log In
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
