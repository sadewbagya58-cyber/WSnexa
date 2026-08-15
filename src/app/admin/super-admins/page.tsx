import React from 'react';
import { requireSuperAdmin } from '@/server/auth/super-admin';
import { SuperAdminService } from '@/server/services/super-admin.service';
import { AdminSuperAdminsClient } from './admin-super-admins-client';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Super Admins — Platform Governance | WSNexa',
  description: 'Manage platform Super Administrator accounts with strict server verification.',
};

export default async function AdminSuperAdminsPage() {
  const { user } = await requireSuperAdmin();
  const admins = await SuperAdminService.listSuperAdmins();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="neutral" className="bg-amber-100 text-amber-900 border-amber-300 font-extrabold text-[10px] uppercase">
              Platform Governance
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight mt-1">
            Super Administrator Authority
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-zinc-500 mt-0.5">
            Manage elevated platform administrator accounts, authority grants, and protections against lockout.
          </p>
        </div>
      </div>

      <AdminSuperAdminsClient admins={admins} currentUserEmail={user.email || ''} />
    </div>
  );
}
