'use server';

import { revalidatePath } from 'next/cache';
import { can, resolveAuthorizationContext } from '../auth';
import { BranchService, CreateBranchInput, UpdateBranchInput } from '../services/branch.service';

export async function createBranchAction(input: CreateBranchInput) {
  try {
    const authContext = await resolveAuthorizationContext();
    if (!authContext || !authContext.businessId) return { success: false, message: 'Unauthorized session' };

    const canCreate = await can({
      context: authContext,
      permission: 'branches.manage',
    });
    if (!canCreate) {
      return { success: false, message: 'Forbidden: Missing permission to create branches.' };
    }

    const newBranch = await BranchService.createBranch(authContext.businessId, authContext.userId, input);

    revalidatePath('/dashboard/branches');
    return { success: true, data: newBranch };
  } catch (err: unknown) {
    return { success: false, message: (err as Error).message || 'Failed to create branch' };
  }
}

export async function updateBranchAction(branchId: string, input: UpdateBranchInput) {
  try {
    const authContext = await resolveAuthorizationContext();
    if (!authContext || !authContext.businessId) return { success: false, message: 'Unauthorized session' };

    const branchResource = { type: 'branch' as const, id: branchId };
    const canUpdate =
      (await can({ context: authContext, permission: 'branches.operational.manage', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'branches.manage', resource: branchResource }));

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
    const authContext = await resolveAuthorizationContext();
    if (!authContext || !authContext.businessId) return { success: false, message: 'Unauthorized session' };

    const branchResource = { type: 'branch' as const, id: branchId };
    const canArchive = await can({
      context: authContext,
      permission: 'branches.manage',
      resource: branchResource,
    });
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
    const authContext = await resolveAuthorizationContext();
    if (!authContext || !authContext.businessId) return { success: false, message: 'Unauthorized session' };

    const branchResource = { type: 'branch' as const, id: branchId };
    const canRestore = await can({
      context: authContext,
      permission: 'branches.manage',
      resource: branchResource,
    });
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
    const authContext = await resolveAuthorizationContext();
    if (!authContext || !authContext.businessId) return { success: false, message: 'Unauthorized session' };

    const branchResource = { type: 'branch' as const, id: branchId };
    const canDelete = await can({
      context: authContext,
      permission: 'branches.manage',
      resource: branchResource,
    });
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
