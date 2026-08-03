import React from 'react';
import Link from 'next/link';

export const Header: React.FC = () => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center space-x-2">
          <span className="text-xl font-bold tracking-tight text-zinc-950">WSNexa</span>
          <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">OS</span>
        </Link>
        <nav className="flex items-center space-x-4">
          <Link
            href="/login"
            className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-950"
          >
            Sign In
          </Link>
          <Link
            href="/dashboard"
            className="rounded-md bg-zinc-950 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
          >
            Dashboard
          </Link>
        </nav>
      </div>
    </header>
  );
};
