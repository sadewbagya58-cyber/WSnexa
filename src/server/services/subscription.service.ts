import { createAdminClient } from '@/lib/supabase/server';
import {
  SubscriptionPlanCode,
  SubscriptionPlanDefinition,
  SubscriptionPlanLimits,
  getPlanDefinition,
} from '@/lib/config/subscription-plans';

export type StoredSubscriptionStatus = 'trialing' | 'active' | 'grace_period' | 'suspended' | 'cancelled';

export type EffectiveSubscriptionStatus =
  | 'TRIALING'
  | 'ACTIVE'
  | 'GRACE_PERIOD'
  | 'SUSPENDED'
  | 'CANCELLED';

export interface BusinessSubscriptionRecord {
  id: string;
  business_id: string;
  plan_code: SubscriptionPlanCode;
  status: StoredSubscriptionStatus;
  trial_starts_at: string;
  trial_ends_at: string;
  current_period_starts_at: string | null;
  current_period_ends_at: string | null;
  grace_ends_at: string | null;
  suspended_at: string | null;
  cancelled_at: string | null;
  max_branches_override: number | null;
  max_staff_override: number | null;
  max_tables_override: number | null;
  max_menu_items_override: number | null;
  max_custom_roles_override: number | null;
  activation_source: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalculatedSubscriptionState {
  effectiveStatus: EffectiveSubscriptionStatus;
  storedStatus: StoredSubscriptionStatus;
  requiresDbReconciliation: boolean;
  graceEndsAt: Date | null;
  periodEndsAt: Date | null;
  daysRemaining: number;
}

export interface ResolvedSubscriptionContext {
  subscription: BusinessSubscriptionRecord;
  plan: SubscriptionPlanDefinition;
  effectiveStatus: EffectiveSubscriptionStatus;
  effectiveLimits: SubscriptionPlanLimits;
  daysRemaining: number;
  periodEndsAt: Date | null;
  graceEndsAt: Date | null;
}

export interface ResourceUsageSnapshot {
  branches: number;
  staff: number;
  tables: number;
  menuItems: number;
  customRoles: number;
}

export type MonitoredResourceType = 'branches' | 'staff' | 'tables' | 'menuItems' | 'customRoles';

export interface LimitValidationResult {
  allowed: boolean;
  currentUsage: number;
  effectiveLimit: number | null;
  planCode: SubscriptionPlanCode;
  remainingCapacity: number | null;
  message?: string;
}

export interface DowngradeConflict {
  resourceType: MonitoredResourceType;
  currentUsage: number;
  planLimit: number;
  message: string;
}

export interface DowngradeValidationResult {
  allowed: boolean;
  targetPlanCode: SubscriptionPlanCode;
  conflicts: DowngradeConflict[];
}

export class SubscriptionService {
  /**
   * Pure state calculation engine evaluating stored status + timestamps against now.
   */
  static calculateSubscriptionState(
    sub: {
      status: StoredSubscriptionStatus;
      trial_starts_at: string;
      trial_ends_at: string;
      current_period_starts_at: string | null;
      current_period_ends_at: string | null;
      grace_ends_at: string | null;
    },
    now: Date = new Date()
  ): CalculatedSubscriptionState {
    // 1. Explicit Terminal Administrative States
    if (sub.status === 'cancelled') {
      return { effectiveStatus: 'CANCELLED', storedStatus: 'cancelled', requiresDbReconciliation: false, graceEndsAt: null, periodEndsAt: null, daysRemaining: 0 };
    }
    if (sub.status === 'suspended') {
      return { effectiveStatus: 'SUSPENDED', storedStatus: 'suspended', requiresDbReconciliation: false, graceEndsAt: null, periodEndsAt: null, daysRemaining: 0 };
    }

    const getDerivedGraceEnd = (baseDateIso: string): Date => {
      if (sub.grace_ends_at) return new Date(sub.grace_ends_at);
      return new Date(new Date(baseDateIso).getTime() + 7 * 86400000);
    };

    // 2. Explicit Stored Grace Period
    if (sub.status === 'grace_period') {
      const graceEnd = sub.grace_ends_at
        ? new Date(sub.grace_ends_at)
        : getDerivedGraceEnd(sub.current_period_ends_at || sub.trial_ends_at);

      if (graceEnd > now) {
        const daysRemaining = Math.max(0, Math.ceil((graceEnd.getTime() - now.getTime()) / 86400000));
        return { effectiveStatus: 'GRACE_PERIOD', storedStatus: 'grace_period', requiresDbReconciliation: false, graceEndsAt: graceEnd, periodEndsAt: null, daysRemaining };
      }

      return { effectiveStatus: 'SUSPENDED', storedStatus: 'grace_period', requiresDbReconciliation: true, graceEndsAt: graceEnd, periodEndsAt: null, daysRemaining: 0 };
    }

    // 3. Stored Active Period Evaluation
    if (sub.status === 'active') {
      const periodEnd = sub.current_period_ends_at ? new Date(sub.current_period_ends_at) : null;
      if (periodEnd && periodEnd > now) {
        const daysRemaining = Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / 86400000));
        return { effectiveStatus: 'ACTIVE', storedStatus: 'active', requiresDbReconciliation: false, graceEndsAt: null, periodEndsAt: periodEnd, daysRemaining };
      }

      const graceEnd = periodEnd ? getDerivedGraceEnd(periodEnd.toISOString()) : now;
      if (graceEnd > now) {
        const daysRemaining = Math.max(0, Math.ceil((graceEnd.getTime() - now.getTime()) / 86400000));
        return { effectiveStatus: 'GRACE_PERIOD', storedStatus: 'active', requiresDbReconciliation: true, graceEndsAt: graceEnd, periodEndsAt: periodEnd, daysRemaining };
      }

      return { effectiveStatus: 'SUSPENDED', storedStatus: 'active', requiresDbReconciliation: true, graceEndsAt: graceEnd, periodEndsAt: periodEnd, daysRemaining: 0 };
    }

    // 4. Stored Trialing Period Evaluation
    if (sub.status === 'trialing') {
      const trialEnd = new Date(sub.trial_ends_at);
      if (trialEnd > now) {
        const daysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / 86400000));
        return { effectiveStatus: 'TRIALING', storedStatus: 'trialing', requiresDbReconciliation: false, graceEndsAt: null, periodEndsAt: trialEnd, daysRemaining };
      }

      const graceEnd = getDerivedGraceEnd(sub.trial_ends_at);
      if (graceEnd > now) {
        const daysRemaining = Math.max(0, Math.ceil((graceEnd.getTime() - now.getTime()) / 86400000));
        return { effectiveStatus: 'GRACE_PERIOD', storedStatus: 'trialing', requiresDbReconciliation: true, graceEndsAt: graceEnd, periodEndsAt: trialEnd, daysRemaining };
      }

      return { effectiveStatus: 'SUSPENDED', storedStatus: 'trialing', requiresDbReconciliation: true, graceEndsAt: graceEnd, periodEndsAt: trialEnd, daysRemaining: 0 };
    }

    return { effectiveStatus: 'SUSPENDED', storedStatus: sub.status, requiresDbReconciliation: true, graceEndsAt: null, periodEndsAt: null, daysRemaining: 0 };
  }

  /**
   * Fetches raw subscription row from database.
   * Auto-provisions Starter trial if business subscription record is missing.
   */
  static async getBusinessSubscription(businessId: string): Promise<BusinessSubscriptionRecord> {
    const admin = createAdminClient();

    const { data: existing } = await admin
      .from('business_subscriptions')
      .select('*')
      .eq('business_id', businessId)
      .maybeSingle();

    if (existing) {
      return existing as BusinessSubscriptionRecord;
    }

    // Auto-provision trial if missing
    return this.createTrialSubscription(businessId);
  }

  /**
   * Resolves effective subscription context, executing an awaited idempotent DB reconciliation if required.
   */
  static async resolveSubscriptionContext(businessId: string): Promise<ResolvedSubscriptionContext> {
    const sub = await this.getBusinessSubscription(businessId);
    const now = new Date();
    const calculated = this.calculateSubscriptionState(sub, now);

    let updatedSub = sub;

    // Awaited Serverless-Safe Idempotent DB Reconciliation
    if (calculated.requiresDbReconciliation) {
      const admin = createAdminClient();
      const newStatus = calculated.effectiveStatus.toLowerCase() as StoredSubscriptionStatus;
      const updates: Record<string, unknown> = {
        status: newStatus,
        updated_at: now.toISOString(),
      };

      if (calculated.effectiveStatus === 'GRACE_PERIOD' && calculated.graceEndsAt) {
        updates.grace_ends_at = calculated.graceEndsAt.toISOString();
      }
      if (calculated.effectiveStatus === 'SUSPENDED') {
        updates.suspended_at = now.toISOString();
      }

      const { data: reconciled } = await admin
        .from('business_subscriptions')
        .update(updates)
        .eq('id', sub.id)
        .select('*')
        .single();

      if (reconciled) {
        updatedSub = reconciled as BusinessSubscriptionRecord;
      }

      // Log idempotent subscription event
      const eventType = calculated.effectiveStatus === 'GRACE_PERIOD' ? 'grace_started' : 'suspended';
      const dedupeKey = `${eventType}:${sub.id}:${newStatus}:${now.toISOString().slice(0, 10)}`;

      await admin.from('business_subscription_events').upsert(
        {
          business_id: businessId,
          actor_type: 'system_reconciliation',
          event_type: eventType,
          previous_status: sub.status,
          new_status: newStatus,
          previous_plan: sub.plan_code,
          new_plan: sub.plan_code,
          reason: `Automated lifecycle reconciliation: transitioned to ${calculated.effectiveStatus}`,
          dedupe_key: dedupeKey,
          metadata: { calculatedAt: now.toISOString() },
        },
        { onConflict: 'dedupe_key', ignoreDuplicates: true }
      );
    }

    const plan = getPlanDefinition(updatedSub.plan_code);
    const effectiveLimits = this.resolveEffectiveLimits(updatedSub);

    return {
      subscription: updatedSub,
      plan,
      effectiveStatus: calculated.effectiveStatus,
      effectiveLimits,
      daysRemaining: calculated.daysRemaining,
      periodEndsAt: calculated.periodEndsAt,
      graceEndsAt: calculated.graceEndsAt,
    };
  }

  /**
   * Resolves effective plan limits following precedence: Business DB Override -> Plan Default -> Unlimited (null).
   */
  static resolveEffectiveLimits(sub: BusinessSubscriptionRecord): SubscriptionPlanLimits {
    const plan = getPlanDefinition(sub.plan_code);
    return {
      maxBranches: sub.max_branches_override !== null ? sub.max_branches_override : plan.limits.maxBranches,
      maxActiveStaff: sub.max_staff_override !== null ? sub.max_staff_override : plan.limits.maxActiveStaff,
      maxTables: sub.max_tables_override !== null ? sub.max_tables_override : plan.limits.maxTables,
      maxMenuItems: sub.max_menu_items_override !== null ? sub.max_menu_items_override : plan.limits.maxMenuItems,
      maxCustomRoles: sub.max_custom_roles_override !== null ? sub.max_custom_roles_override : plan.limits.maxCustomRoles,
    };
  }

  /**
   * Authoritative server-side usage snapshot.
   */
  static async getUsageSnapshot(businessId: string): Promise<ResourceUsageSnapshot> {
    const admin = createAdminClient();

    const [
      { count: branchCount },
      { count: staffCount },
      { count: tableCount },
      { count: menuItemCount },
      { count: roleCount },
    ] = await Promise.all([
      admin.from('branches').select('id', { count: 'exact', head: true }).eq('business_id', businessId).is('deleted_at', null),
      admin.from('business_memberships').select('id', { count: 'exact', head: true }).eq('business_id', businessId).eq('membership_status', 'active'),
      admin.from('dining_tables').select('id', { count: 'exact', head: true }).eq('business_id', businessId).is('deleted_at', null),
      admin.from('menu_items').select('id', { count: 'exact', head: true }).eq('business_id', businessId).is('deleted_at', null),
      admin.from('custom_roles').select('id', { count: 'exact', head: true }).eq('business_id', businessId).eq('is_archived', false),
    ]);

    return {
      branches: branchCount || 0,
      staff: staffCount || 0,
      tables: tableCount || 0,
      menuItems: menuItemCount || 0,
      customRoles: roleCount || 0,
    };
  }

  /**
   * Reusable limit validator.
   */
  static async validateLimit(
    businessId: string,
    resourceType: MonitoredResourceType
  ): Promise<LimitValidationResult> {
    const context = await this.resolveSubscriptionContext(businessId);
    const usage = await this.getUsageSnapshot(businessId);

    const currentUsage = usage[resourceType];
    const limitKeyMap: Record<MonitoredResourceType, keyof SubscriptionPlanLimits> = {
      branches: 'maxBranches',
      staff: 'maxActiveStaff',
      tables: 'maxTables',
      menuItems: 'maxMenuItems',
      customRoles: 'maxCustomRoles',
    };

    const effectiveLimit = context.effectiveLimits[limitKeyMap[resourceType]];

    if (effectiveLimit === null) {
      return {
        allowed: true,
        currentUsage,
        effectiveLimit: null,
        planCode: context.subscription.plan_code,
        remainingCapacity: null,
      };
    }

    const allowed = currentUsage < effectiveLimit;
    const remainingCapacity = Math.max(0, effectiveLimit - currentUsage);

    return {
      allowed,
      currentUsage,
      effectiveLimit,
      planCode: context.subscription.plan_code,
      remainingCapacity,
      message: allowed
        ? undefined
        : `${context.plan.name} plan limit reached (${effectiveLimit} ${resourceType}). Upgrade your plan to add more.`,
    };
  }

  /**
   * Downgrade Eligibility Validator.
   * Blocks downgrade if current resource usage exceeds any destination plan limit.
   */
  static async validateDowngradeEligibility(
    businessId: string,
    targetPlanCode: SubscriptionPlanCode
  ): Promise<DowngradeValidationResult> {
    const targetPlan = getPlanDefinition(targetPlanCode);
    const usage = await this.getUsageSnapshot(businessId);
    const conflicts: DowngradeConflict[] = [];

    const checks: Array<{ type: MonitoredResourceType; usage: number; limit: number | null; label: string }> = [
      { type: 'branches', usage: usage.branches, limit: targetPlan.limits.maxBranches, label: 'active branches' },
      { type: 'staff', usage: usage.staff, limit: targetPlan.limits.maxActiveStaff, label: 'active staff members' },
      { type: 'tables', usage: usage.tables, limit: targetPlan.limits.maxTables, label: 'tables' },
      { type: 'menuItems', usage: usage.menuItems, limit: targetPlan.limits.maxMenuItems, label: 'menu items' },
      { type: 'customRoles', usage: usage.customRoles, limit: targetPlan.limits.maxCustomRoles, label: 'custom roles' },
    ];

    for (const check of checks) {
      if (check.limit !== null && check.usage > check.limit) {
        conflicts.push({
          resourceType: check.type,
          currentUsage: check.usage,
          planLimit: check.limit,
          message: `Cannot downgrade to ${targetPlan.name}: ${check.usage} ${check.label} exist (${targetPlan.name} limit is ${check.limit}).`,
        });
      }
    }

    return {
      allowed: conflicts.length === 0,
      targetPlanCode,
      conflicts,
    };
  }

  /**
   * Provisions a 14-day Starter trial subscription for a newly onboarded business.
   */
  static async createTrialSubscription(
    businessId: string,
    actorId?: string
  ): Promise<BusinessSubscriptionRecord> {
    const admin = createAdminClient();
    const now = new Date();
    const trialEnd = new Date(now.getTime() + 14 * 86400000);

    const row = {
      business_id: businessId,
      plan_code: 'starter' as const,
      status: 'trialing' as const,
      trial_starts_at: now.toISOString(),
      trial_ends_at: trialEnd.toISOString(),
      activation_source: 'onboarding_trial',
      notes: 'Initial 14-day Starter trial provisioned during onboarding',
    };

    const { data: created, error } = await admin
      .from('business_subscriptions')
      .upsert(row, { onConflict: 'business_id' })
      .select('*')
      .single();

    if (error || !created) {
      throw new Error(`Failed to provision trial subscription: ${error?.message || 'Database insert error'}`);
    }

    // Log initial trial_started event idempotently
    const dedupeKey = `trial_started:${created.id}`;
    await admin.from('business_subscription_events').upsert(
      {
        business_id: businessId,
        actor_id: actorId || null,
        actor_type: actorId ? 'business_owner' : 'system_reconciliation',
        event_type: 'trial_started',
        previous_status: 'none',
        new_status: 'trialing',
        previous_plan: 'none',
        new_plan: 'starter',
        reason: 'New business 14-day Starter trial provisioned',
        dedupe_key: dedupeKey,
        metadata: { trialEndsAt: trialEnd.toISOString() },
      },
      { onConflict: 'dedupe_key', ignoreDuplicates: true }
    );

    return created as BusinessSubscriptionRecord;
  }
}
