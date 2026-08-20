'use server';

import { revalidatePath } from 'next/cache';
import { resolveActiveBusinessContext } from '../tenant/resolver';
import { PermissionService } from '../services/permission.service';
import { BranchService, CreateBranchInput, UpdateBranchInput } from '../services/branch.service';

export async function createBranchAction(input: CreateBranchInput) {
  try {
    const tenant = await resolveActiveBusinessContext();
    if (!tenant) return { success: false, message: 'Unauthorized session' };

    const canCreate = await PermissionService.hasPermission(
      tenant.user.id,
      tenant.business.id,
      null,
      'branches.manage'
    );
    if (!canCreate) {
      return { success: false, message: 'Forbidden: Missing permission to create branches.' };
    }

    const newBranch = await BranchService.createBranch(tenant.business.id, tenant.user.id, input);

    revalidatePath('/dashboard/branches');
    return { success: true, data: newBranch };
  } catch (err: unknown) {
    return { success: false, message: (err as Error).message || 'Failed to create branch' };
  }
}

export async function updateBranchAction(branchId: string, input: UpdateBranchInput) {
  try {
    const tenant = await resolveActiveBusinessContext();
    if (!tenant) return { success: false, message: 'Unauthorized session' };

    const branch = tenant.branches.find((b) => b.id === branchId);
    if (!branch && tenant.membership.role !== 'business_owner') {
      return { success: false, message: 'Branch not found or access denied.' };
    }

    const canUpdate =
      (await PermissionService.hasPermission(tenant.user.id, tenant.business.id, branchId, 'branches.operational.manage')) ||
      (await PermissionService.hasPermission(tenant.user.id, tenant.business.id, branchId, 'branches.manage'));

    if (!canUpdate) {
      return { success: false, message: 'Forbidden: Missing permission to update this branch.' };
    }

    const updated = await BranchService.updateBranch(branchId, input);

    revalidatePath('/dashboard/branches');
    return { success: true, data: updated };
  } catch (err: unknown) {
    return { success: false, message: (err as Error).message || 'Failed to update branch' };
  }
}

export async function archiveBranchAction(branchId: string) {
  try {
    const tenant = await resolveActiveBusinessContext();
    if (!tenant) return { success: false, message: 'Unauthorized session' };

    const canArchive = await PermissionService.hasPermission(
      tenant.user.id,
      tenant.business.id,
      null,
      'branches.manage'
    );
    if (!canArchive) {
      return { success: false, message: 'Forbidden: Missing permission to archive branches.' };
    }

    const archived = await BranchService.archiveBranch(branchId);

    revalidatePath('/dashboard/branches');
    return { success: true, data: archived };
  } catch (err: unknown) {
    return { success: false, message: (err as Error).message || 'Failed to archive branch' };
  }
}

export async function restoreBranchAction(branchId: string) {
  try {
    const tenant = await resolveActiveBusinessContext();
    if (!tenant) return { success: false, message: 'Unauthorized session' };

    const canRestore = await PermissionService.hasPermission(
      tenant.user.id,
      tenant.business.id,
      null,
      'branches.manage'
    );
    if (!canRestore) {
      return { success: false, message: 'Forbidden: Missing permission to restore branches.' };
    }

    const restored = await BranchService.restoreBranch(branchId);

    revalidatePath('/dashboard/branches');
    return { success: true, data: restored };
  } catch (err: unknown) {
    return { success: false, message: (err as Error).message || 'Failed to restore branch' };
  }
}

export async function deleteBranchAction(branchId: string) {
  try {
    const tenant = await resolveActiveBusinessContext();
    if (!tenant) return { success: false, message: 'Unauthorized session' };

    const canDelete = await PermissionService.hasPermission(
      tenant.user.id,
      tenant.business.id,
      null,
      'branches.manage'
    );
    if (!canDelete) {
      return { success: false, message: 'Forbidden: Missing permission to delete branches.' };
    }

    await BranchService.deleteBranch(branchId);

    revalidatePath('/dashboard/branches');
    return { success: true };
  } catch (err: unknown) {
    return { success: false, message: (err as Error).message || 'Failed to delete branch' };
  }
}
