import React from 'react';
import { requireRoutePermission } from '@/server/tenant/guard';
import { listTeamMembersAction } from '@/server/actions/permission';
import Link from 'next/link';
import { IconArrowRight, IconEye, IconUsers } from '@/components/access/access-icons';

export const metadata = {
  title: 'Member Access Management | WSNexa',
  description: 'Inspect staff access profiles, roles, and permission overrides.',
};

export default async function MemberAccessDirectoryPage() {
  const { allowed } = await requireRoutePermission('/dashboard/access/members');

  if (!allowed) {
    return (
      <div className="p-8 text-center bg-white border border-zinc-200 rounded-2xl max-w-lg mx-auto my-12 shadow-2xs">
        <h2 className="text-base font-bold text-zinc-900 mb-2">Access Restricted</h2>
        <p className="text-xs text-zinc-500">
          You do not have the <code className="font-mono bg-zinc-100 px-1 py-0.5 rounded text-zinc-800">roles.view</code> permission required to access Member Access Management.
        </p>
      </div>
    );
  }

  const res = await listTeamMembersAction();
  const members = res.success && res.data ? res.data : [];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/access"
          className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 flex items-center gap-1.5 transition-colors"
        >
          <IconArrowRight className="w-4 h-4" /> Back to Access Control Hub
        </Link>
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-2xs space-y-1">
        <h1 className="text-lg font-bold text-zinc-900">Member Access Profiles & Overrides</h1>
        <p className="text-xs text-zinc-500">
          Inspect authorization capability profiles for staff members, reassign roles, configure explicit permission overrides, and inspect temporary authority.
        </p>
      </div>

      {/* Staff Members List */}
      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-2xs">
        {members.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 text-xs">
            No team members found in current business tenant.
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {members.map((m) => {
              const isOwner = m.role === 'business_owner';
              const name = m.userName || m.userEmail;

              return (
                <div
                  key={m.id}
                  className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-zinc-50/80 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm shrink-0">
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-zinc-900">
                          {name}
                        </span>
                        {isOwner && (
                          <span className="text-[10px] font-bold font-mono bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                            Owner
                          </span>
                        )}
                      </div>
                      <span className="block text-xs text-zinc-500 font-mono">
                        {m.userEmail}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs w-full sm:w-auto justify-between sm:justify-end">
                    <div className="text-right">
                      <span className="block font-bold text-zinc-900 capitalize">
                        {m.customRoleName || m.role}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500">
                        Status: {m.membershipStatus}
                      </span>
                    </div>

                    <Link
                      href={`/dashboard/access/members/${m.id}`}
                      className="px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors flex items-center gap-1.5 shrink-0"
                    >
                      <IconEye className="w-3.5 h-3.5" /> Inspect Access Profile
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
