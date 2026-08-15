'use server';

import { revalidatePath } from 'next/cache';
import { resolveActiveBusinessContext } from '../tenant/resolver';
import { ServiceAreaService } from '../services/service-area.service';

import { PermissionService } from '@/server/services/permission.service';

export async function createServiceAreaAction(name: string, description?: string | null) {
  try {
    const tenant = await resolveActiveBusinessContext();
    if (!tenant || !tenant.activeBranch) {
      return { success: false, message: 'Unauthorized or active branch context not found.' };
    }

    const canManage =
      (await PermissionService.hasPermission(tenant.user.id, tenant.business.id, tenant.activeBranch.id, 'areas.manage')) ||
      (await PermissionService.hasPermission(tenant.user.id, tenant.business.id, tenant.activeBranch.id, 'tables.manage')) ||
      tenant.membership?.role === 'business_owner';

    if (!canManage) {
      return { success: false, message: 'Forbidden. Missing required area permission.' };
    }

    const res = await ServiceAreaService.createArea(
      tenant.business.id,
      tenant.activeBranch.id,
      name,
      description,
      tenant.user.id
    );

    if (res.success) {
      revalidatePath('/dashboard/areas');
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
    const tenant = await resolveActiveBusinessContext();
    if (!tenant || !tenant.activeBranch) {
      return { success: false, message: 'Unauthorized or active branch context not found.' };
    }

    const canManage =
      (await PermissionService.hasPermission(tenant.user.id, tenant.business.id, tenant.activeBranch.id, 'areas.manage')) ||
      (await PermissionService.hasPermission(tenant.user.id, tenant.business.id, tenant.activeBranch.id, 'tables.manage')) ||
      tenant.membership?.role === 'business_owner';

    if (!canManage) {
      return { success: false, message: 'Forbidden. Missing required area permission.' };
    }

    const res = await ServiceAreaService.updateArea(
      areaId,
      tenant.business.id,
      tenant.activeBranch.id,
      name,
      description,
      isActive
    );

    if (res.success) {
      revalidatePath('/dashboard/areas');
    }

    return res;
  } catch (err: unknown) {
    return { success: false, message: (err as Error).message || 'Failed to update service area.' };
  }
}

export async function deleteServiceAreaAction(areaId: string) {
  try {
    const tenant = await resolveActiveBusinessContext();
    if (!tenant || !tenant.activeBranch) {
      return { success: false, message: 'Unauthorized or active branch context not found.' };
    }

    const canManage =
      (await PermissionService.hasPermission(tenant.user.id, tenant.business.id, tenant.activeBranch.id, 'areas.manage')) ||
      (await PermissionService.hasPermission(tenant.user.id, tenant.business.id, tenant.activeBranch.id, 'tables.manage')) ||
      tenant.membership?.role === 'business_owner';

    if (!canManage) {
      return { success: false, message: 'Forbidden. Missing required area permission.' };
    }

    const res = await ServiceAreaService.deleteArea(
      areaId,
      tenant.business.id,
      tenant.activeBranch.id
    );

    if (res.success) {
      revalidatePath('/dashboard/areas');
    }

    return res;
  } catch (err: unknown) {
    return { success: false, message: (err as Error).message || 'Failed to delete service area.' };
  }
}


export async function assignStaffToAreasAction(membershipId: string, areaIds: string[]) {
  try {
    const tenant = await resolveActiveBusinessContext();
    if (!tenant || !tenant.activeBranch) {
      return { success: false, message: 'Unauthorized or active branch context not found.' };
    }

    const res = await ServiceAreaService.assignStaffToAreas(
      membershipId,
      tenant.business.id,
      tenant.activeBranch.id,
      areaIds,
      tenant.user.id
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
    const tenant = await resolveActiveBusinessContext();
    if (!tenant || !tenant.activeBranch) {
      return { success: false, message: 'Unauthorized or active branch context not found.' };
    }

    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    const { error } = await supabase
      .from('branches')
      .update({ ordering_mode: orderingMode, updated_at: new Date().toISOString() })
      .eq('id', tenant.activeBranch.id)
      .eq('business_id', tenant.business.id);

    if (error) {
      return { success: false, message: error.message };
    }

    revalidatePath('/dashboard');
    return { success: true, message: `Ordering mode set to ${orderingMode}.` };
  } catch (err: unknown) {
    return { success: false, message: (err as Error).message || 'Failed to update ordering mode.' };
  }
}
