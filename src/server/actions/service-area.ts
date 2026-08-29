'use server';

import { revalidatePath } from 'next/cache';
import { can, resolveAuthorizationContext } from '@/server/auth';
import { ServiceAreaService } from '../services/service-area.service';

export async function createServiceAreaAction(name: string, description?: string | null) {
  try {
    const authContext = await resolveAuthorizationContext();
    if (!authContext || !authContext.activeBranchId) {
      return { success: false, message: 'Unauthorized or active branch context not found.' };
    }

    const branchResource = { type: 'branch' as const, id: authContext.activeBranchId };
    const canManage =
      (await can({ context: authContext, permission: 'areas.manage', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'tables.manage', resource: branchResource }));

    if (!canManage) {
      return { success: false, message: 'Forbidden. Missing required area permission.' };
    }

    const res = await ServiceAreaService.createArea(
      authContext.businessId,
      authContext.activeBranchId,
      name,
      description,
      authContext.userId
    );

    if (res.success) {
      revalidatePath('/dashboard/areas');
      revalidatePath('/dashboard/tables');
      revalidatePath('/dashboard/tables/areas');
      revalidatePath('/dashboard/dining');
      revalidatePath('/dashboard');
    }

    return res;
  } catch (err: unknown) {
    return { success: false, message: (err as Error).message || 'Failed to create service area.' };
  }
}

export async function updateServiceAreaAction(
  areaId: string,
  name: string,
  description?: string | null,
  isActive?: boolean
) {
  try {
    const authContext = await resolveAuthorizationContext();
    if (!authContext || !authContext.activeBranchId) {
      return { success: false, message: 'Unauthorized or active branch context not found.' };
    }

    const areaResource = { type: 'service_area' as const, id: areaId };
    const canManage =
      (await can({ context: authContext, permission: 'areas.manage', resource: areaResource })) ||
      (await can({ context: authContext, permission: 'tables.manage', resource: areaResource }));

    if (!canManage) {
      return { success: false, message: 'Forbidden. Missing required area permission.' };
    }

    const res = await ServiceAreaService.updateArea(
      areaId,
      authContext.businessId,
      authContext.activeBranchId,
      name,
      description,
      isActive
    );

    if (res.success) {
      revalidatePath('/dashboard/areas');
      revalidatePath('/dashboard/tables');
      revalidatePath('/dashboard/tables/areas');
      revalidatePath('/dashboard/dining');
      revalidatePath('/dashboard');
    }

    return res;
  } catch (err: unknown) {
    return { success: false, message: (err as Error).message || 'Failed to update service area.' };
  }
}

export async function deleteServiceAreaAction(areaId: string) {
  try {
    const authContext = await resolveAuthorizationContext();
    if (!authContext || !authContext.activeBranchId) {
      return { success: false, message: 'Unauthorized or active branch context not found.' };
    }

    const areaResource = { type: 'service_area' as const, id: areaId };
    const canManage =
      (await can({ context: authContext, permission: 'areas.manage', resource: areaResource })) ||
      (await can({ context: authContext, permission: 'tables.manage', resource: areaResource }));

    if (!canManage) {
      return { success: false, message: 'Forbidden. Missing required area permission.' };
    }

    const res = await ServiceAreaService.deleteArea(
      areaId,
      authContext.businessId,
      authContext.activeBranchId
    );

    if (res.success) {
      revalidatePath('/dashboard/areas');
      revalidatePath('/dashboard/tables');
      revalidatePath('/dashboard/tables/areas');
      revalidatePath('/dashboard/dining');
      revalidatePath('/dashboard');
    }

    return res;
  } catch (err: unknown) {
    return { success: false, message: (err as Error).message || 'Failed to delete service area.' };
  }
}

export async function assignStaffToAreasAction(membershipId: string, areaIds: string[]) {
  try {
    const authContext = await resolveAuthorizationContext();
    if (!authContext || !authContext.activeBranchId) {
      return { success: false, message: 'Unauthorized or active branch context not found.' };
    }

    const branchResource = { type: 'branch' as const, id: authContext.activeBranchId };
    const canAssign =
      (await can({ context: authContext, permission: 'staff.area.assign', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'staff.manage', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'areas.manage', resource: branchResource }));

    if (!canAssign) {
      return { success: false, message: 'Forbidden. Missing required staff area assignment permission.' };
    }

    const res = await ServiceAreaService.assignStaffToAreas(
      membershipId,
      authContext.businessId,
      authContext.activeBranchId,
      areaIds,
      authContext.userId
    );

    if (res.success) {
      revalidatePath('/dashboard/team');
      revalidatePath('/dashboard/areas');
    }

    return res;
  } catch (err: unknown) {
    return { success: false, message: (err as Error).message || 'Failed to update staff area assignments.' };
  }
}

export async function setBranchOrderingModeAction(orderingMode: 'qr_only' | 'waiter_only' | 'qr_and_waiter') {
  try {
    const authContext = await resolveAuthorizationContext();
    if (!authContext || !authContext.activeBranchId) {
      return { success: false, message: 'Unauthorized or active branch context not found.' };
    }

    const branchResource = { type: 'branch' as const, id: authContext.activeBranchId };
    const canManage =
      (await can({ context: authContext, permission: 'branches.operational.manage', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'branches.manage', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'business.settings.manage' }));

    if (!canManage) {
      return { success: false, message: 'Forbidden. Missing required branch ordering settings permission.' };
    }

    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    const { error } = await supabase
      .from('branches')
      .update({ ordering_mode: orderingMode, updated_at: new Date().toISOString() })
      .eq('id', authContext.activeBranchId)
      .eq('business_id', authContext.businessId);

    if (error) {
      return { success: false, message: error.message };
    }

    revalidatePath('/dashboard');
    return { success: true, message: `Ordering mode set to ${orderingMode}.` };
  } catch (err: unknown) {
    return { success: false, message: (err as Error).message || 'Failed to update ordering mode.' };
  }
}
