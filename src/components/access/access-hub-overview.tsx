import React from 'react';
import Link from 'next/link';
import { BuiltInRoleTemplate, CustomRoleDetail, ScopeGrantDetail } from '@/types/authorization.types';
import { FormattedMemberDetail } from '@/server/services/permission.service';
import {
  IconShieldCheck,
  IconUsers,
  IconShieldAlert,
  IconSparkles,
  IconBuildingSkyscraper,
  IconBuildingStore,
  IconArrowRight,
  IconZap,
} from './access-icons';

interface AccessHubOverviewProps {
  builtInTemplates: BuiltInRoleTemplate[];
  customRoles: CustomRoleDetail[];
  scopeGrants: ScopeGrantDetail[];
  teamMembers: FormattedMemberDetail[];
}

export const AccessHubOverview: React.FC<AccessHubOverviewProps> = ({
  builtInTemplates,
  customRoles,
  scopeGrants,
  teamMembers,
}) => {
  const activeCustomRolesCount = customRoles.filter((r) => !r.isArchived).length;
  const activeMembersCount = teamMembers.filter((m) => m.membershipStatus === 'active').length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-800 to-emerald-950 text-white rounded-2xl p-6 shadow-md border border-zinc-800 space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
            <IconShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">RBAC & Scope V2 Access Control Hub</h1>
            <p className="text-xs text-zinc-300">Central management layer for tenant roles, scope grants, member permission overrides, and access diagnostics.</p>
          </div>
        </div>

        {/* Security Precedence Summary */}
        <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono text-zinc-300 border-t border-zinc-700/60">
          <div className="flex items-center gap-1.5 bg-black/20 p-2 rounded-lg">
            <IconShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span>Precedence: DENY &gt; ALLOW &gt; Role</span>
          </div>
          <div className="flex items-center gap-1.5 bg-black/20 p-2 rounded-lg">
            <IconShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Model: WHAT (Role) / WHERE (Scope)</span>
          </div>
          <div className="flex items-center gap-1.5 bg-black/20 p-2 rounded-lg">
            <IconZap className="w-3.5 h-3.5 text-blue-400" />
            <span>RLS Defense: Enforced Server-Side</span>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-2xs">
          <span className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Built-In Templates</span>
          <span className="text-2xl font-bold font-mono text-zinc-900">{builtInTemplates.length}</span>
          <span className="block text-[11px] text-zinc-500 mt-1">System Protected</span>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-2xs">
          <span className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Active Custom Roles</span>
          <span className="text-2xl font-bold font-mono text-emerald-700">{activeCustomRolesCount}</span>
          <span className="block text-[11px] text-zinc-500 mt-1">Tenant Defined</span>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-2xs">
          <span className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Scope Grants</span>
          <span className="text-2xl font-bold font-mono text-blue-700">{scopeGrants.length}</span>
          <span className="block text-[11px] text-zinc-500 mt-1">Target Rules</span>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-2xs">
          <span className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Active Staff Members</span>
          <span className="text-2xl font-bold font-mono text-purple-700">{activeMembersCount}</span>
          <span className="block text-[11px] text-zinc-500 mt-1">Evaluated Members</span>
        </div>
      </div>

      {/* Navigation Subsections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* 1. ROLES MANAGEMENT */}
        <Link
          href="/dashboard/access/roles"
          className="group bg-white border border-zinc-200 hover:border-emerald-500/50 rounded-2xl p-5 shadow-2xs hover:shadow-md transition-all space-y-3 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <IconShieldCheck className="w-5 h-5" />
              </div>
              <IconArrowRight className="w-5 h-5 text-zinc-400 group-hover:text-emerald-600 transition-colors" />
            </div>

            <h3 className="text-base font-bold text-zinc-900 mt-3 group-hover:text-emerald-700 transition-colors">
              Built-In & Custom Roles
            </h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Inspect built-in role templates or create, edit, clone, and archive custom role permission bundles.
            </p>
          </div>

          <div className="flex items-center justify-between text-xs text-zinc-600 border-t border-zinc-100 pt-3">
            <span>Built-in: {builtInTemplates.length}</span>
            <span className="font-semibold text-emerald-700">Manage Roles &rarr;</span>
          </div>
        </Link>

        {/* 2. MEMBER ACCESS MANAGEMENT */}
        <Link
          href="/dashboard/access/members"
          className="group bg-white border border-zinc-200 hover:border-emerald-500/50 rounded-2xl p-5 shadow-2xs hover:shadow-md transition-all space-y-3 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-blue-100 text-blue-800 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <IconUsers className="w-5 h-5" />
              </div>
              <IconArrowRight className="w-5 h-5 text-zinc-400 group-hover:text-emerald-600 transition-colors" />
            </div>

            <h3 className="text-base font-bold text-zinc-900 mt-3 group-hover:text-emerald-700 transition-colors">
              Member Access & Overrides
            </h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Inspect staff profiles, reassign roles, configure explicit member permission overrides, and view active temporary authority.
            </p>
          </div>

          <div className="flex items-center justify-between text-xs text-zinc-600 border-t border-zinc-100 pt-3">
            <span>Staff Directory: {teamMembers.length} members</span>
            <span className="font-semibold text-emerald-700">Inspect Members &rarr;</span>
          </div>
        </Link>

        {/* 3. SCOPE GRANTS */}
        <Link
          href="/dashboard/access/scope-grants"
          className="group bg-white border border-zinc-200 hover:border-emerald-500/50 rounded-2xl p-5 shadow-2xs hover:shadow-md transition-all space-y-3 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl group-hover:bg-amber-600 group-hover:text-white transition-colors">
                <IconShieldAlert className="w-5 h-5" />
              </div>
              <IconArrowRight className="w-5 h-5 text-zinc-400 group-hover:text-emerald-600 transition-colors" />
            </div>

            <h3 className="text-base font-bold text-zinc-900 mt-3 group-hover:text-emerald-700 transition-colors">
              Scoped Permission Grants
            </h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Manage fine-grained ALLOW / DENY permission grants targeted at specific branches, properties, or departments.
            </p>
          </div>

          <div className="flex items-center justify-between text-xs text-zinc-600 border-t border-zinc-100 pt-3">
            <span>Active Grants: {scopeGrants.length}</span>
            <span className="font-semibold text-emerald-700">Manage Grants &rarr;</span>
          </div>
        </Link>

        {/* 4. ACCESS DIAGNOSTICS */}
        <Link
          href="/dashboard/access/diagnostics"
          className="group bg-white border border-zinc-200 hover:border-emerald-500/50 rounded-2xl p-5 shadow-2xs hover:shadow-md transition-all space-y-3 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-purple-100 text-purple-800 rounded-xl group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <IconSparkles className="w-5 h-5" />
              </div>
              <IconArrowRight className="w-5 h-5 text-zinc-400 group-hover:text-emerald-600 transition-colors" />
            </div>

            <h3 className="text-base font-bold text-zinc-900 mt-3 group-hover:text-emerald-700 transition-colors">
              Policy Engine Access Diagnostics
            </h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Interactive &quot;Why Can / Can&apos;t This User?&quot; evaluator that tests real Policy Engine evaluation and displays exact decision provenance.
            </p>
          </div>

          <div className="flex items-center justify-between text-xs text-zinc-600 border-t border-zinc-100 pt-3">
            <span>Interactive Tool</span>
            <span className="font-semibold text-emerald-700">Run Diagnostics &rarr;</span>
          </div>
        </Link>
      </div>
    </div>
  );
};
