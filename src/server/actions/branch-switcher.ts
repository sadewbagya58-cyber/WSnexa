'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { resolveActiveBusinessContext, ACTIVE_BRANCH_COOKIE } from '../tenant/resolver';

export async function switchActiveBranchAction(branchId: string) {
  try {
    const tenant = await resolveActiveBusinessContext();
    if (!tenant) return { success: false, message: 'Unauthorized session' };

    const targetBranch = tenant.branches.find((b) => b.id === branchId);
    if (!targetBranch) {
      return { success: false, message: 'Invalid branch ID or branch not found' };
    }

    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_BRANCH_COOKIE, branchId, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    revalidatePath('/dashboard', 'layout');
    return { success: true, activeBranch: targetBranch };
  } catch (err: unknown) {
    return { success: false, message: (err as Error).message || 'Failed to switch active branch' };
  }
}
