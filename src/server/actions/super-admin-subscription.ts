'use server';

import { revalidatePath } from 'next/cache';
import { requireSuperAdmin } from '../auth/super-admin';
import { SubscriptionService } from '../services/subscription.service';
import { SubscriptionPlanCode } from '@/lib/config/subscription-plans';

export async function getAdminSubscriptionContextAction(businessId: string) {
  await requireSuperAdmin();
  try {
    const subContext = await SubscriptionService.resolveSubscriptionContext(businessId);
    const usage = await SubscriptionService.getUsageSnapshot(businessId);
    const history = await SubscriptionService.getSubscriptionEventHistory(businessId);

    return {
      success: true,
      data: {
        subContext,
        usage,
        history,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to load subscription details';
    return { success: false, message: msg };
  }
}

export async function manualActivateSubscriptionAction(input: {
  businessId: string;
  planCode: SubscriptionPlanCode;
  periodEnd: string;
  reason: string;
  notes?: string;
}) {
  const { user } = await requireSuperAdmin();
  try {
    const periodEnd = new Date(input.periodEnd);
    const updated = await SubscriptionService.manualActivateSubscription({
      businessId: input.businessId,
      planCode: input.planCode,
      periodEnd,
      reason: input.reason,
      notes: input.notes,
      actorId: user.id,
    });

    revalidatePath(`/admin/businesses/${input.businessId}`);
    revalidatePath('/admin/businesses');
    return { success: true, data: updated, message: 'Subscription manually activated.' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to activate subscription';
    return { success: false, message: msg };
  }
}

export async function extendTrialAction(input: {
  businessId: string;
  newTrialEnd: string;
  reason: string;
}) {
  const { user } = await requireSuperAdmin();
  try {
    const updated = await SubscriptionService.extendTrial({
      businessId: input.businessId,
      newTrialEnd: new Date(input.newTrialEnd),
      reason: input.reason,
      actorId: user.id,
    });

    revalidatePath(`/admin/businesses/${input.businessId}`);
    return { success: true, data: updated, message: 'Trial extended successfully.' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to extend trial';
    return { success: false, message: msg };
  }
}

export async function extendGracePeriodAction(input: {
  businessId: string;
  newGraceEnd: string;
  reason: string;
}) {
  const { user } = await requireSuperAdmin();
  try {
    const updated = await SubscriptionService.extendGracePeriod({
      businessId: input.businessId,
      newGraceEnd: new Date(input.newGraceEnd),
      reason: input.reason,
      actorId: user.id,
    });

    revalidatePath(`/admin/businesses/${input.businessId}`);
    return { success: true, data: updated, message: 'Grace period extended successfully.' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to extend grace period';
    return { success: false, message: msg };
  }
}

export async function changeSubscriptionPlanAction(input: {
  businessId: string;
  newPlanCode: SubscriptionPlanCode;
  reason: string;
}) {
  const { user } = await requireSuperAdmin();
  try {
    const updated = await SubscriptionService.changeSubscriptionPlan({
      businessId: input.businessId,
      newPlanCode: input.newPlanCode,
      reason: input.reason,
      actorId: user.id,
    });

    revalidatePath(`/admin/businesses/${input.businessId}`);
    return { success: true, data: updated, message: 'Subscription plan updated successfully.' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to change subscription plan';
    return { success: false, message: msg };
  }
}

export async function setEnterpriseOverridesAction(input: {
  businessId: string;
  overrides: {
    maxBranches?: number | null;
    maxActiveStaff?: number | null;
    maxTables?: number | null;
    maxMenuItems?: number | null;
    maxCustomRoles?: number | null;
  };
  reason: string;
}) {
  const { user } = await requireSuperAdmin();
  try {
    const updated = await SubscriptionService.setEnterpriseOverrides({
      businessId: input.businessId,
      overrides: input.overrides,
      reason: input.reason,
      actorId: user.id,
    });

    revalidatePath(`/admin/businesses/${input.businessId}`);
    return { success: true, data: updated, message: 'Enterprise overrides updated successfully.' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update Enterprise overrides';
    return { success: false, message: msg };
  }
}

export async function suspendSubscriptionAction(input: {
  businessId: string;
  reason: string;
}) {
  const { user } = await requireSuperAdmin();
  try {
    const updated = await SubscriptionService.suspendSubscription({
      businessId: input.businessId,
      reason: input.reason,
      actorId: user.id,
    });

    revalidatePath(`/admin/businesses/${input.businessId}`);
    return { success: true, data: updated, message: 'Subscription commercially suspended.' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to suspend subscription';
    return { success: false, message: msg };
  }
}

export async function reactivateSubscriptionAction(input: {
  businessId: string;
  planCode: SubscriptionPlanCode;
  periodEnd: string;
  reason: string;
}) {
  const { user } = await requireSuperAdmin();
  try {
    const updated = await SubscriptionService.reactivateSubscription({
      businessId: input.businessId,
      planCode: input.planCode,
      periodEnd: new Date(input.periodEnd),
      reason: input.reason,
      actorId: user.id,
    });

    revalidatePath(`/admin/businesses/${input.businessId}`);
    return { success: true, data: updated, message: 'Subscription reactivated successfully.' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to reactivate subscription';
    return { success: false, message: msg };
  }
}

export async function cancelSubscriptionAction(input: {
  businessId: string;
  reason: string;
}) {
  const { user } = await requireSuperAdmin();
  try {
    const updated = await SubscriptionService.cancelSubscription({
      businessId: input.businessId,
      reason: input.reason,
      actorId: user.id,
    });

    revalidatePath(`/admin/businesses/${input.businessId}`);
    return { success: true, data: updated, message: 'Subscription explicitly cancelled.' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to cancel subscription';
    return { success: false, message: msg };
  }
}
