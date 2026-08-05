'use server';

import { revalidatePath } from 'next/cache';
import { resolveActiveBusinessContext, requireBusinessRole } from '../tenant/resolver';
import { BranchService, CreateBranchInput, UpdateBranchInput } from '../services/branch.service';

export async function createBranchAction(input: CreateBranchInput) {
  try {
    const tenant = await resolveActiveBusinessContext();
    if (!tenant) return { success: false, message: 'Unauthorized session' };

    await requireBusinessRole(tenant.business.id, ['business_owner']);

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

    await requireBusinessRole(tenant.business.id, ['business_owner', 'branch_manager']);

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

    await requireBusinessRole(tenant.business.id, ['business_owner']);

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

    await requireBusinessRole(tenant.business.id, ['business_owner']);

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

    await requireBusinessRole(tenant.business.id, ['business_owner']);

    await BranchService.deleteBranch(branchId);

    revalidatePath('/dashboard/branches');
    return { success: true };
  } catch (err: unknown) {
    return { success: false, message: (err as Error).message || 'Failed to delete branch' };
  }
}
