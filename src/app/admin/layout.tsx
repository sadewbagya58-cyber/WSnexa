import React from 'react';
import { redirect } from 'next/navigation';
import { requireSuperAdmin } from '@/server/auth/super-admin';
import { AdminNavbar } from './admin-navbar';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'WSNexa Super Admin — Platform Control',
  description: 'Enterprise administration, venue management, security controls, and diagnostic operations.',
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let adminContext;
  try {
    adminContext = await requireSuperAdmin();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('Unauthorized')) {
      redirect('/login?redirectTo=/admin');
    }
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl border border-red-200 bg-white p-8 text-center space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-3xl mx-auto">
            ⛔
          </div>
          <h1 className="text-xl font-black text-zinc-950">Access Denied</h1>
          <p className="text-xs font-semibold text-zinc-600 leading-relaxed">
            Super Admin platform authority is required to access this area. Your account does not have permission.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <a
              href="/dashboard"
              className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-zinc-950 px-6 py-3 text-xs font-extrabold text-white hover:bg-zinc-800 transition-colors"
            >
              Go to Business Dashboard
            </a>
            <a
              href="/customer"
              className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 px-6 py-3 text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition-colors"
            >
              Go to Customer Portal
            </a>
          </div>
        </div>
      </div>
    );
  }

  const { user, profile } = adminContext;
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Platform Administrator';

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col antialiased">
      <AdminNavbar userEmail={user.email || ''} userName={fullName} />
      <div className="flex flex-1 min-w-0">
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
