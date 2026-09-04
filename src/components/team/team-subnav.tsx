'use client';

import React from 'react';
import { HubSubNavigation, HubNavItem } from '@/components/layout/hub-sub-navigation';

interface TeamSubNavProps {
  canViewStaff?: boolean;
  canInviteStaff?: boolean;
  canViewRoles?: boolean;
  canViewAccess?: boolean;
  canViewDiagnostics?: boolean;
  canViewOrganization?: boolean;
  canViewAudit?: boolean;
  className?: string;
}

export function TeamSubNav({
  canViewStaff = true,
  canInviteStaff = true,
  canViewRoles = true,
  canViewAccess = true,
  canViewDiagnostics = true,
  canViewOrganization = true,
  canViewAudit = true,
  className = '',
}: TeamSubNavProps) {
  const items: HubNavItem[] = [];

  if (canViewStaff) {
    items.push({ id: 'staff', label: 'Staff Directory', href: '/dashboard/people', icon: '👥', exact: true });
  }
  if (canInviteStaff) {
    items.push({ id: 'invites', label: 'Staff Invitations', href: '/dashboard/team/invites', icon: '🔑' });
  }
  if (canViewRoles) {
    items.push({ id: 'roles', label: 'Roles & Permissions', href: '/dashboard/access/roles', icon: '🛡️' });
  }
  if (canViewAccess) {
    items.push({ id: 'access', label: 'Access Control Hub', href: '/dashboard/access', icon: '🔒', exact: true });
  }
  if (canViewDiagnostics) {
    items.push({ id: 'diagnostics', label: 'Access Diagnostics', href: '/dashboard/access/diagnostics', icon: '🔬' });
  }
  if (canViewOrganization) {
    items.push({ id: 'organization', label: 'Organization Structure', href: '/dashboard/organization', icon: '🏢' });
  }
  if (canViewAudit) {
    items.push({ id: 'audit', label: 'Audit History', href: '/dashboard/access/audit', icon: '📜' });
  }

  return <HubSubNavigation items={items} className={className} />;
}
