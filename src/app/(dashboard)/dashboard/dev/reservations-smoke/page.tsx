import { redirect } from 'next/navigation';
import { can, resolveAuthorizationContext } from '@/server/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { ReservationSettingsService } from '@/server/reservations/reservation-settings.service';
import { ReservationQueryService } from '@/server/reservations/reservation-query.service';
import { ReservationsSmokeClient } from '@/components/dev/reservations-smoke-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Reservation Smoke Harness | WSNexa Dev',
  description: 'Internal manual verification surface for Phase 35 Step 1 reservation foundation.',
};

export default async function ReservationsSmokePage() {
  let authContext;
  try {
    authContext = await resolveAuthorizationContext();
  } catch {
    redirect('/login');
  }

  if (!authContext || !authContext.businessId) {
    redirect('/login');
  }

  const hasViewPermission = await can({
    context: authContext,
    permission: 'reservations.view',
  });

  const hasManagePermission = await can({
    context: authContext,
    permission: 'reservations.manage',
  });

  if (!hasViewPermission && !hasManagePermission) {
    return (
      <div className="p-8 text-center bg-white rounded-lg border border-slate-200 m-6">
        <h2 className="text-xl font-bold text-slate-900">Access Denied</h2>
        <p className="text-sm text-slate-600 mt-2">
          You lack the required <code className="text-amber-700">reservations.view</code> permission to access this internal smoke harness.
        </p>
      </div>
    );
  }

  const admin = createAdminClient();
  const { data: branchRows } = await admin
    .from('branches')
    .select('id, name, code')
    .eq('business_id', authContext.businessId)
    .order('created_at', { ascending: true });

  const branches = (branchRows || []).map((b) => ({
    id: b.id,
    name: b.name,
    code: b.code || b.name,
  }));

  const activeBranchId = branches.length > 0 ? branches[0].id : '';

  const initialSettings = activeBranchId
    ? await ReservationSettingsService.getBranchSettings(authContext.businessId, activeBranchId)
    : null;

  const hasContactView = await can({
    context: authContext,
    permission: 'customers.contact_view',
  });

  const initialReservations = await ReservationQueryService.listReservations(
    {
      businessId: authContext.businessId,
      branchId: activeBranchId || undefined,
      authorizedBranchIds: authContext.authorizedBranchIds,
      limit: 10,
      offset: 0,
    },
    hasContactView
  );

  return (
    <ReservationsSmokeClient
      businessId={authContext.businessId}
      branches={branches}
      authorizedBranchIds={authContext.authorizedBranchIds}
      hasContactView={hasContactView}
      hasManagePermission={hasManagePermission}
      initialSettings={initialSettings}
      initialReservations={initialReservations}
    />
  );
}
