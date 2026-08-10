import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950 flex flex-col justify-between p-6 sm:p-12 antialiased selection:bg-amber-500 selection:text-black">
      {/* Header Brand */}
      <header className="flex items-center justify-between max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-zinc-950 text-white font-black text-xl flex items-center justify-center rounded-xl tracking-tighter shadow-md">
            W
          </div>
          <span className="text-xl font-black tracking-wider uppercase text-zinc-950">WSNexa</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/explore"
            className="text-xs font-semibold text-zinc-600 hover:text-zinc-950 transition-colors"
          >
            Explore Venues
          </Link>
          <Link
            href="/login"
            className="text-xs font-bold px-4 py-2 bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-900 rounded-xl transition-all shadow-xs"
          >
            Log In
          </Link>
        </div>
      </header>

      {/* Mobile-First Hero Section */}
      <main className="max-w-3xl mx-auto w-full text-center space-y-8 py-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-zinc-200 shadow-xs rounded-full text-[11px] font-semibold text-zinc-700">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Next-Generation Hospitality Operating System</span>
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl sm:text-6xl font-black text-zinc-950 tracking-tight uppercase">
            Smart Hospitality.<br />
            <span className="text-zinc-500">Simplified.</span>
          </h1>
          <p className="text-base sm:text-lg text-zinc-600 max-w-xl mx-auto leading-relaxed">
            Manage orders, staff, payments, and guest experiences from one unified, mobile-first platform.
          </p>
        </div>

        {/* Primary Call to Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto pt-4">
          <Link
            href="/register"
            className="w-full sm:w-auto flex-1 min-h-[48px] px-8 py-3.5 bg-zinc-950 text-white font-extrabold text-sm uppercase tracking-wider rounded-xl hover:bg-zinc-800 transition-all flex items-center justify-center shadow-lg active:scale-95"
          >
            Create Account
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto flex-1 min-h-[48px] px-8 py-3.5 bg-white border border-zinc-200 text-zinc-900 font-extrabold text-sm uppercase tracking-wider rounded-xl hover:bg-zinc-100 transition-all flex items-center justify-center shadow-sm active:scale-95"
          >
            Log In
          </Link>
        </div>

        <div className="pt-6">
          <Link
            href="/explore"
            className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-600 hover:text-zinc-950 transition-colors"
          >
            <span>Discover public venues & digital menus</span>
            <span>→</span>
          </Link>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="max-w-5xl mx-auto w-full border-t border-zinc-200 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-500 gap-4">
        <div>© 2026 WSNexa. All rights reserved.</div>
        <div className="flex items-center gap-6">
          <span>Speed & Simplicity First</span>
          <span>•</span>
          <span>Multi-Tenant Architecture</span>
        </div>
      </footer>
    </div>
  );
}
