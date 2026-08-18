import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { OrganizationService } from '@/server/services/organization.service';
import { VisualOrgChartClient, OrgTreeNode } from '@/components/organization/visual-org-chart-client';

export const metadata: Metadata = {
  title: 'Visual Organization Chart | WSNexa',
  description: 'Interactive hierarchical workforce reporting structure with acting coverage overlays',
};

function formatNode(node: unknown): OrgTreeNode {
  const n = node as Record<string, unknown>;
  const membership = n.membership as Record<string, unknown> | undefined;
  const p = membership?.user_profiles;
  const prof = Array.isArray(p) ? p[0] : (p as { first_name?: string; last_name?: string } | undefined);
  const holderName = `${prof?.first_name || ''} ${prof?.last_name || ''}`.trim() || 'Staff Member';
  const jobTitle = n.job_title as { name?: string; hierarchy_level?: { rank?: number } } | undefined;
  const branch = n.branch as { name?: string } | undefined;
  const department = n.department as { name?: string } | undefined;
  const children = Array.isArray(n.children) ? n.children : [];

  return {
    id: String(n.id || ''),
    business_membership_id: String(n.business_membership_id || ''),
    holderName,
    jobTitleName: jobTitle?.name || 'Position',
    rank: jobTitle?.hierarchy_level?.rank,
    branchName: branch?.name,
    departmentName: department?.name,
    isActing: Boolean(n.isActing || n.assignment_type === 'acting'),
    actingCoverName: n.acting_for ? 'Covering' : undefined,
    children: children.map(formatNode),
  };
}

export default async function VisualOrgChartPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard/organization/chart');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }
  if (!context || !context.business) {
    redirect('/login');
  }

  const { business, branches } = context;

  const [substantiveTrees, effectiveTrees] = await Promise.all([
    OrganizationService.getReportingTree(undefined, business.id),
    OrganizationService.getEffectiveReportingTree(undefined, business.id),
  ]);

  const formattedSubstantive = substantiveTrees.map(formatNode);
  const formattedEffective = effectiveTrees.map(formatNode);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <VisualOrgChartClient
        tree={formattedSubstantive}
        effectiveTree={formattedEffective}
        branches={branches}
      />
    </div>
  );
}
