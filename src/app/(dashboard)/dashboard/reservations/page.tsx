import React from 'react';
import { redirect } from 'next/navigation';
import { resolveAuthorizationContext } from '@/server/auth';
import { can } from '@/server/auth/policy-engine';
import { BranchService } from '@/server/services/branch.service';
import { ReservationQueryService } from '@/server/reservations/reservation-query.service';
import { ReservationWaitlistService } from '@/server/reservations/reservation-waitlist.service';
import { ReservationManagementClient } from '@/components/reservations/reservation-management-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Reservations & Table Allocation | WSNexa',
  description: 'Manage dining table availability, capacity allocation, walk-in seating, and waitlist queue.',
};

export default async function ReservationsDashboardPage() {
  let authContext;
  try {
    authContext = await resolveAuthorizationContext();
  } catch {
    redirect('/login');
  }

  if (!authContext || !authContext.businessId) {
    redirect('/login');
  }

  const [
    hasViewPermission,
    hasManagePermission,
    hasAssignPermission,
    hasWaitlistPermission,
    hasContactView,
  ] = await Promise.all([
    can({ context: authContext, permission: 'reservations.view' }),
    can({ context: authContext, permission: 'reservations.manage' }),
    can({ context: authContext, permission: 'reservations.assign_tables' }),
    can({ context: authContext, permission: 'reservations.waitlist_manage' }),
    can({ context: authContext, permission: 'customers.contact_view' }),
  ]);

  if (!hasViewPermission) {
    redirect('/dashboard');
  }

  // Fetch branches
  const branchesData = await BranchService.getBusinessBranches(authContext.businessId);
  const branches = branchesData.map((b) => ({
    id: b.id,
    name: b.name,
    code: b.code,
  }));

  const activeBranchId = branches.length > 0 ? branches[0].id : '';

  // Initial reservation list & waitlist queue queries run concurrently
  const [initialReservations, initialWaitlist] = await Promise.all([
    ReservationQueryService.listReservations(
      {
        businessId: authContext.businessId,
        branchId: activeBranchId || undefined,
        authorizedBranchIds: authContext.authorizedBranchIds,
        limit: 20,
        offset: 0,
      },
      hasContactView
    ),
    activeBranchId
      ? ReservationWaitlistService.listWaitlistEntries({
          businessId: authContext.businessId,
          branchId: activeBranchId,
          hasContactView,
          authorizedBranchIds: authContext.authorizedBranchIds,
        })
      : Promise.resolve([]),
  ]);

  return (
    <ReservationManagementClient
      businessId={authContext.businessId}
      branches={branches}
      hasManagePermission={hasManagePermission}
      hasAssignPermission={hasAssignPermission}
      hasWaitlistPermission={hasWaitlistPermission}
      hasContactView={hasContactView}
      initialReservations={initialReservations}
      initialWaitlist={initialWaitlist}
    />
  );
}
