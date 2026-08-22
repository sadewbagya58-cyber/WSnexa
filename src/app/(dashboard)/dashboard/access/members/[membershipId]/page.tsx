import React from 'react';
import { requireRoutePermission } from '@/server/tenant/guard';
import {
  previewMemberEffectiveAccessAction,
  listPermissionCatalogAction,
  listRoleTemplatesAction,
  listCustomRolesAction,
} from '@/server/actions/permission';
import { MemberAccessDetailClient } from '@/components/access/member-access-detail-client';
import { BranchService } from '@/server/services/branch.service';
import { OrganizationService } from '@/server/services/organization.service';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const metadata = {
  title: 'Member Access Profile | WSNexa',
  description: 'Inspect effective member access, role capability, and explicit overrides.',
};

interface MemberAccessInspectorPageProps {
  params: Promise<{ membershipId: string }>;
}

import { PageHeader } from '@/components/layout/page-header';

export default async function MemberAccessInspectorPage({ params }: MemberAccessInspectorPageProps) {
  const { membershipId } = await params;
  const { allowed, context } = await requireRoutePermission('/dashboard/access/members');

  if (!allowed) {
    return (
      <div className="p-8 text-center bg-white border border-zinc-200 rounded-2xl max-w-lg mx-auto my-12 shadow-2xs">
        <h2 className="text-base font-bold text-zinc-900 mb-2">Access Restricted</h2>
        <p className="text-xs text-zinc-500">
          You do not have the <code className="font-mono bg-zinc-100 px-1 py-0.5 rounded text-zinc-800">roles.view</code> permission required to view member access profiles.
        </p>
      </div>
    );
  }

  const [previewRes, catalogRes, templatesRes, customRolesRes, branchesRes, deptsRes] = await Promise.all([
    previewMemberEffectiveAccessAction(membershipId),
    listPermissionCatalogAction(),
    listRoleTemplatesAction(),
    listCustomRolesAction({ includeArchived: false }),
    BranchService.getBusinessBranches(context.business.id),
    OrganizationService.getDepartments(context.business.id),
  ]);

  if (!previewRes.success || !previewRes.data) {
    notFound();
  }

  const preview = previewRes.data;
  const catalog = catalogRes.success && catalogRes.data ? catalogRes.data : [];
  const builtInTemplates = templatesRes.success && templatesRes.data ? templatesRes.data : [];
  const customRoles = customRolesRes.success && customRolesRes.data ? customRolesRes.data : [];
  const branches = branchesRes || [];
  const departments = deptsRes || [];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title={preview.memberName || 'Member Access Profile'}
        description={`Effective permission breakdown and scope grants for ${preview.userEmail || 'staff member'}.`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Access Control Hub', href: '/dashboard/access' },
          { label: 'Staff Members', href: '/dashboard/access/members' },
          { label: preview.memberName || 'Member Profile' },
        ]}
        secondaryActions={
          <Link
            href="/dashboard/access/members"
            className="flex min-h-[44px] items-center gap-1.5 px-3 py-2 text-xs font-bold text-zinc-700 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 active:bg-zinc-100 transition-colors"
          >
            ← Back to Members
          </Link>
        }
      />

      <MemberAccessDetailClient
        preview={preview}
        catalog={catalog}
        builtInTemplates={builtInTemplates}
        customRoles={customRoles}
        branches={branches}
        departments={departments}
      />
    </div>
  );
}
