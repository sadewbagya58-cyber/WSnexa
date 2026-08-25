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

    if (context.effectiveStatus === 'SUSPENDED' || context.effectiveStatus === 'CANCELLED') {
      return {
        allowed: false,
        currentUsage,
        effectiveLimit: 0,
        planCode: context.subscription.plan_code,
        remainingCapacity: 0,
        message: `Subscription is ${context.effectiveStatus.toLowerCase()}. Operational mutations are restricted.`,
      };
    }

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

  // ── SUPER ADMIN MANAGEMENT METHODS ──────────────────────────────────────────

  /**
   * Helper to record a subscription event and Super Admin audit log.
   */
  static async recordSubscriptionEventAndAudit({
    businessId,
    actorId,
    actorType = 'super_admin',
    eventType,
    previousStatus,
    newStatus,
    previousPlan,
    newPlan,
    reason,
    metadata = {},
  }: {
    businessId: string;
    actorId: string;
    actorType?: 'super_admin' | 'business_owner' | 'system_reconciliation';
    eventType: string;
    previousStatus: string;
    newStatus: string;
    previousPlan: string;
    newPlan: string;
    reason: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const admin = createAdminClient();
    const dedupeKey = `sub_evt_${businessId}_${eventType}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    await admin.from('business_subscription_events').insert({
      business_id: businessId,
      actor_id: actorId,
      actor_type: actorType,
      event_type: eventType,
      previous_status: previousStatus,
      new_status: newStatus,
      previous_plan: previousPlan,
      new_plan: newPlan,
      reason: reason,
      metadata,
      dedupe_key: dedupeKey,
    });

    try {
      await admin.from('audit_logs').insert({
        business_id: businessId,
        actor_id: actorId,
        action: `SUBSCRIPTION_${eventType.toUpperCase()}`,
        entity_type: 'business_subscription',
        entity_id: businessId,
        details: { previousStatus, newStatus, previousPlan, newPlan, reason, ...metadata },
      });
    } catch {
      // Audit log creation fail-safe
    }
  }

  /**
   * Emits in-app notification to Business Owner(s) for subscription state changes.
   */
  static async notifyBusinessOwner(
    businessId: string,
    notificationType: string,
    title: string,
    message: string
  ): Promise<void> {
    const admin = createAdminClient();
    const { data: owners } = await admin
      .from('business_memberships')
      .select('user_id')
      .eq('business_id', businessId)
      .eq('role', 'business_owner')
      .eq('membership_status', 'active');

    if (!owners || owners.length === 0) return;

    const rows = owners.map((o) => ({
      business_id: businessId,
      recipient_user_id: o.user_id,
      notification_type: notificationType,
      priority: 'high',
      title,
      message,
      entity_type: 'subscription',
      entity_id: businessId,
      action_url: '/dashboard/settings/subscription',
      dedupe_key: `${notificationType}:${businessId}:${o.user_id}:${Date.now()}`,
      metadata: { timestamp: new Date().toISOString() },
    }));

    await admin.from('notifications').upsert(rows, { onConflict: 'dedupe_key', ignoreDuplicates: true });
  }

  /**
   * Manually activates a commercial subscription for a business.
   */
  static async manualActivateSubscription({
    businessId,
    planCode,
    periodEnd,
    reason,
    notes,
    actorId,
  }: {
    businessId: string;
    planCode: SubscriptionPlanCode;
    periodEnd: Date;
    reason: string;
    notes?: string;
    actorId: string;
  }): Promise<BusinessSubscriptionRecord> {
    if (!['bank_transfer', 'pilot_account', 'complimentary', 'gateway_issue', 'other'].includes(reason)) {
      throw new Error('Invalid manual activation reason.');
    }
    if (reason === 'other' && (!notes || !notes.trim())) {
      throw new Error('Notes are required when selecting "other" as activation reason.');
    }
    if (periodEnd <= new Date()) {
      throw new Error('Subscription period end must be a future date.');
    }

    const admin = createAdminClient();
    const subContext = await this.resolveSubscriptionContext(businessId);
    const oldSub = subContext.subscription;
    const now = new Date();

    const updatePayload = {
      business_id: businessId,
      plan_code: planCode,
      status: 'active' as const,
      current_period_starts_at: now.toISOString(),
      current_period_ends_at: periodEnd.toISOString(),
      grace_ends_at: null,
      suspended_at: null,
      cancelled_at: null,
      activation_source: reason,
      notes: notes?.trim() || null,
      updated_at: now.toISOString(),
    };

    const { data: updated, error } = await admin
      .from('business_subscriptions')
      .upsert(updatePayload, { onConflict: 'business_id' })
      .select('*')
      .single();

    if (error || !updated) {
      throw new Error(`Failed to activate subscription: ${error?.message || 'Database update error'}`);
    }

    await this.recordSubscriptionEventAndAudit({
      businessId,
      actorId,
      eventType: 'activated',
      previousStatus: oldSub.status,
      newStatus: 'active',
      previousPlan: oldSub.plan_code,
      newPlan: planCode,
      reason: `Manual activation: ${reason}${notes ? ` (${notes})` : ''}`,
      metadata: { periodEnd: periodEnd.toISOString(), activationSource: reason },
    });

    await this.notifyBusinessOwner(
      businessId,
      'SUBSCRIPTION_ACTIVATED',
      'Subscription Activated',
      `Your WSNexa ${getPlanDefinition(planCode).name} subscription has been activated until ${periodEnd.toLocaleDateString()}.`
    );

    return updated as BusinessSubscriptionRecord;
  }

  /**
   * Authoritative server-side subscription operational assertion guard.
   * Resolves effective subscription state and throws Error if SUSPENDED or CANCELLED.
   */
  static async assertOperationalSubscription(businessId: string): Promise<ResolvedSubscriptionContext> {
    const subContext = await this.resolveSubscriptionContext(businessId);
    if (subContext.effectiveStatus === 'SUSPENDED' || subContext.effectiveStatus === 'CANCELLED') {
      throw new Error(
        `Subscription is ${subContext.effectiveStatus.toLowerCase()}. Operational mutations are restricted. Contact business owner or WSNexa support.`
      );
    }
    return subContext;
  }

  /**
   * Extends business trial end date.
   */
  static async extendTrial({
    businessId,
    newTrialEnd,
    reason,
    actorId,
  }: {
    businessId: string;
    newTrialEnd: Date;
    reason: string;
    actorId: string;
  }): Promise<BusinessSubscriptionRecord> {
    if (!reason || !reason.trim()) throw new Error('Reason is mandatory for trial extension.');
    if (newTrialEnd <= new Date()) throw new Error('New trial end date must be in the future.');

    const subContext = await this.resolveSubscriptionContext(businessId);
    const oldSub = subContext.subscription;
    if (oldSub.status === 'cancelled') throw new Error('Cannot extend trial for a cancelled subscription.');
    if (oldSub.status === 'suspended') throw new Error('Cannot extend trial for a suspended subscription.');
    const admin = createAdminClient();
    const now = new Date();

    const newStatus = oldSub.status === 'trialing' || newTrialEnd > now ? 'trialing' : oldSub.status;

    const { data: updated, error } = await admin
      .from('business_subscriptions')
      .update({
        trial_ends_at: newTrialEnd.toISOString(),
        status: newStatus,
        updated_at: now.toISOString(),
      })
      .eq('business_id', businessId)
      .select('*')
      .single();

    if (error || !updated) throw new Error(`Failed to extend trial: ${error?.message}`);

    await this.recordSubscriptionEventAndAudit({
      businessId,
      actorId,
      eventType: 'trial_extended',
      previousStatus: oldSub.status,
      newStatus,
      previousPlan: oldSub.plan_code,
      newPlan: oldSub.plan_code,
      reason,
      metadata: { newTrialEnd: newTrialEnd.toISOString() },
    });

    return updated as BusinessSubscriptionRecord;
  }

  /**
   * Extends commercial grace period.
   */
  static async extendGracePeriod({
    businessId,
    newGraceEnd,
    reason,
    actorId,
  }: {
    businessId: string;
    newGraceEnd: Date;
    reason: string;
    actorId: string;
  }): Promise<BusinessSubscriptionRecord> {
    if (!reason || !reason.trim()) throw new Error('Reason is mandatory for grace period extension.');
    if (newGraceEnd <= new Date()) throw new Error('New grace period end date must be in the future.');

    const subContext = await this.resolveSubscriptionContext(businessId);
    const oldSub = subContext.subscription;
    if (oldSub.status === 'cancelled') throw new Error('Cannot extend grace period for a cancelled subscription.');
    const admin = createAdminClient();
    const now = new Date();

    const { data: updated, error } = await admin
      .from('business_subscriptions')
      .update({
        grace_ends_at: newGraceEnd.toISOString(),
        status: 'grace_period',
        updated_at: now.toISOString(),
      })
      .eq('business_id', businessId)
      .select('*')
      .single();

    if (error || !updated) throw new Error(`Failed to extend grace period: ${error?.message}`);

    await this.recordSubscriptionEventAndAudit({
      businessId,
      actorId,
      eventType: 'grace_extended',
      previousStatus: oldSub.status,
      newStatus: 'grace_period',
      previousPlan: oldSub.plan_code,
      newPlan: oldSub.plan_code,
      reason,
      metadata: { newGraceEnd: newGraceEnd.toISOString() },
    });

    await this.notifyBusinessOwner(
      businessId,
      'SUBSCRIPTION_GRACE_STARTED',
      'Subscription Grace Period Extended',
      `Your WSNexa subscription grace period has been extended until ${newGraceEnd.toLocaleDateString()}.`
    );

    return updated as BusinessSubscriptionRecord;
  }

  /**
   * Changes subscription plan with downgrade eligibility validation.
   */
  static async changeSubscriptionPlan({
    businessId,
    newPlanCode,
    reason,
    actorId,
  }: {
    businessId: string;
    newPlanCode: SubscriptionPlanCode;
    reason: string;
    actorId: string;
  }): Promise<BusinessSubscriptionRecord> {
    if (!reason || !reason.trim()) throw new Error('Reason is mandatory for plan change.');

    const subContext = await this.resolveSubscriptionContext(businessId);
    const oldSub = subContext.subscription;

    if (oldSub.plan_code === newPlanCode) {
      return oldSub;
    }

    // Downgrade Eligibility Check
    const eligibility = await this.validateDowngradeEligibility(businessId, newPlanCode);
    if (!eligibility.allowed) {
      const conflictMsg = eligibility.conflicts.map((c) => `${c.resourceType}: ${c.currentUsage}/${c.planLimit}`).join('; ');
      throw new Error(`Plan downgrade blocked. Resource usage exceeds target plan limits (${conflictMsg}).`);
    }

    const admin = createAdminClient();
    const now = new Date();

    const { data: updated, error } = await admin
      .from('business_subscriptions')
      .update({
        plan_code: newPlanCode,
        updated_at: now.toISOString(),
      })
      .eq('business_id', businessId)
      .select('*')
      .single();

    if (error || !updated) throw new Error(`Failed to change plan: ${error?.message}`);

    await this.recordSubscriptionEventAndAudit({
      businessId,
      actorId,
      eventType: 'plan_changed',
      previousStatus: oldSub.status,
      newStatus: oldSub.status,
      previousPlan: oldSub.plan_code,
      newPlan: newPlanCode,
      reason,
    });

    return updated as BusinessSubscriptionRecord;
  }

  /**
   * Sets finite Enterprise overrides.
   */
  static async setEnterpriseOverrides({
    businessId,
    overrides,
    reason,
    actorId,
  }: {
    businessId: string;
    overrides: {
      maxBranches?: number | null;
      maxActiveStaff?: number | null;
      maxTables?: number | null;
      maxMenuItems?: number | null;
      maxCustomRoles?: number | null;
    };
    reason: string;
    actorId: string;
  }): Promise<BusinessSubscriptionRecord> {
    if (!reason || !reason.trim()) throw new Error('Reason is mandatory for custom limit overrides.');

    const subContext = await this.resolveSubscriptionContext(businessId);
    const oldSub = subContext.subscription;
    const usage = await this.getUsageSnapshot(businessId);

    // Validate integer bounds & capacity vs usage
    const validateOverride = (val: number | null | undefined, currentUsage: number, name: string) => {
      if (val === undefined) return undefined;
      if (val !== null) {
        if (!Number.isInteger(val) || val < 0) {
          throw new Error(`${name} override must be a non-negative integer.`);
        }
        if (val < currentUsage) {
          throw new Error(`${name} override (${val}) cannot be below current usage (${currentUsage}).`);
        }
      }
      return val;
    };

    const updateFields = {
      max_branches_override: validateOverride(overrides.maxBranches, usage.branches, 'Branches'),
      max_staff_override: validateOverride(overrides.maxActiveStaff, usage.staff, 'Active Staff'),
      max_tables_override: validateOverride(overrides.maxTables, usage.tables, 'Dining Tables'),
      max_menu_items_override: validateOverride(overrides.maxMenuItems, usage.menuItems, 'Menu Items'),
      max_custom_roles_override: validateOverride(overrides.maxCustomRoles, usage.customRoles, 'Custom Roles'),
      updated_at: new Date().toISOString(),
    };

    const admin = createAdminClient();
    const { data: updated, error } = await admin
      .from('business_subscriptions')
      .update(updateFields)
      .eq('business_id', businessId)
      .select('*')
      .single();

    if (error || !updated) throw new Error(`Failed to update overrides: ${error?.message}`);

    await this.recordSubscriptionEventAndAudit({
      businessId,
      actorId,
      eventType: 'manual_override',
      previousStatus: oldSub.status,
      newStatus: oldSub.status,
      previousPlan: oldSub.plan_code,
      newPlan: oldSub.plan_code,
      reason,
      metadata: { overrides },
    });

    return updated as BusinessSubscriptionRecord;
  }

  /**
   * Commercially suspends a subscription (does NOT alter platform businesses.status).
   */
  static async suspendSubscription({
    businessId,
    reason,
    actorId,
  }: {
    businessId: string;
    reason: string;
    actorId: string;
  }): Promise<BusinessSubscriptionRecord> {
    if (!reason || !reason.trim()) throw new Error('Reason is mandatory for subscription suspension.');

    const subContext = await this.resolveSubscriptionContext(businessId);
    const oldSub = subContext.subscription;
    if (oldSub.status === 'cancelled') throw new Error('Cannot suspend a subscription that is already cancelled.');
    if (oldSub.status === 'suspended') throw new Error('Subscription is already suspended.');
    const now = new Date();

    const admin = createAdminClient();
    const { data: updated, error } = await admin
      .from('business_subscriptions')
      .update({
        status: 'suspended',
        suspended_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('business_id', businessId)
      .select('*')
      .single();

    if (error || !updated) throw new Error(`Failed to suspend subscription: ${error?.message}`);

    await this.recordSubscriptionEventAndAudit({
      businessId,
      actorId,
      eventType: 'suspended',
      previousStatus: oldSub.status,
      newStatus: 'suspended',
      previousPlan: oldSub.plan_code,
      newPlan: oldSub.plan_code,
      reason,
    });

    await this.notifyBusinessOwner(
      businessId,
      'SUBSCRIPTION_SUSPENDED',
      'Subscription Suspended',
      'Your WSNexa commercial subscription has been suspended. Operational modules are restricted. Contact support for assistance.'
    );

    return updated as BusinessSubscriptionRecord;
  }

  /**
   * Reactivates a suspended/grace commercial subscription.
   */
  static async reactivateSubscription({
    businessId,
    planCode,
    periodEnd,
    reason,
    actorId,
  }: {
    businessId: string;
    planCode: SubscriptionPlanCode;
    periodEnd: Date;
    reason: string;
    actorId: string;
  }): Promise<BusinessSubscriptionRecord> {
    if (!reason || !reason.trim()) throw new Error('Reason is mandatory for subscription reactivation.');
    if (periodEnd <= new Date()) throw new Error('Subscription period end must be a future date.');

    const subContext = await this.resolveSubscriptionContext(businessId);
    const oldSub = subContext.subscription;
    const now = new Date();

    const admin = createAdminClient();
    const { data: updated, error } = await admin
      .from('business_subscriptions')
      .update({
        status: 'active',
        plan_code: planCode,
        current_period_starts_at: now.toISOString(),
        current_period_ends_at: periodEnd.toISOString(),
        suspended_at: null,
        grace_ends_at: null,
        updated_at: now.toISOString(),
      })
      .eq('business_id', businessId)
      .select('*')
      .single();

    if (error || !updated) throw new Error(`Failed to reactivate subscription: ${error?.message}`);

    await this.recordSubscriptionEventAndAudit({
      businessId,
      actorId,
      eventType: 'reactivated',
      previousStatus: oldSub.status,
      newStatus: 'active',
      previousPlan: oldSub.plan_code,
      newPlan: planCode,
      reason,
      metadata: { periodEnd: periodEnd.toISOString() },
    });

    await this.notifyBusinessOwner(
      businessId,
      'SUBSCRIPTION_REACTIVATED',
      'Subscription Reactivated',
      `Your WSNexa subscription has been reactivated on the ${getPlanDefinition(planCode).name} plan until ${periodEnd.toLocaleDateString()}.`
    );

    return updated as BusinessSubscriptionRecord;
  }

  /**
   * Explicitly cancels a commercial subscription (preserves all tenant data).
   */
  static async cancelSubscription({
    businessId,
    reason,
    actorId,
  }: {
    businessId: string;
    reason: string;
    actorId: string;
  }): Promise<BusinessSubscriptionRecord> {
    if (!reason || !reason.trim()) throw new Error('Reason is mandatory for subscription cancellation.');

    const subContext = await this.resolveSubscriptionContext(businessId);
    const oldSub = subContext.subscription;
    if (oldSub.status === 'cancelled') throw new Error('Subscription is already cancelled.');
    const now = new Date();

    const admin = createAdminClient();
    const { data: updated, error } = await admin
      .from('business_subscriptions')
      .update({
        status: 'cancelled',
        cancelled_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('business_id', businessId)
      .select('*')
      .single();

    if (error || !updated) throw new Error(`Failed to cancel subscription: ${error?.message}`);

    await this.recordSubscriptionEventAndAudit({
      businessId,
      actorId,
      eventType: 'cancelled',
      previousStatus: oldSub.status,
      newStatus: 'cancelled',
      previousPlan: oldSub.plan_code,
      newPlan: oldSub.plan_code,
      reason,
    });

    return updated as BusinessSubscriptionRecord;
  }

  /**
   * Fetches event history for a business subscription.
   */
  static async getSubscriptionEventHistory(businessId: string) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('business_subscription_events')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch subscription history: ${error.message}`);
    return data || [];
  }
}
