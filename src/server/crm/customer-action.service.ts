import { createAdminClient } from '@/lib/supabase/server';
import type {
  CRMActionPriority,
  CRMActionStatus,
  CRMActionType,
  RetentionOpportunityDTO,
} from '@/lib/crm/crm-action.types';
import { CustomerProfileService } from './customer-profile.service';
import { CustomerSegmentationService } from './customer-segmentation.service';
import { EngagementEligibilityService } from './engagement-eligibility.service';
import { RetentionOpportunityEngine } from './retention-opportunity.engine';
import { maskEmail, maskPhone } from '@/lib/crm/crm-normalization';

export class CustomerActionService {
  /**
   * Validates state transition server-side.
   */
  public static validateStatusTransition(currentStatus: CRMActionStatus, newStatus: CRMActionStatus): boolean {
    if (currentStatus === newStatus) return true;

    // Terminal state rules
    if (currentStatus === 'COMPLETED' || currentStatus === 'DISMISSED') {
      return false; // Terminal states cannot transition without explicit reopen
    }

    if (currentStatus === 'OPEN') {
      return newStatus === 'IN_PROGRESS' || newStatus === 'SNOOZED' || newStatus === 'COMPLETED' || newStatus === 'DISMISSED';
    }

    if (currentStatus === 'IN_PROGRESS') {
      return newStatus === 'SNOOZED' || newStatus === 'COMPLETED' || newStatus === 'DISMISSED';
    }

    if (currentStatus === 'SNOOZED') {
      return newStatus === 'OPEN' || newStatus === 'IN_PROGRESS' || newStatus === 'COMPLETED' || newStatus === 'DISMISSED';
    }

    return false;
  }

  /**
   * Lists CRM actions for a business, bounded by property reach and paginated.
   */
  public static async listActions(input: {
    businessId: string;
    branchIds?: string[] | null;
    statusFilter?: CRMActionStatus | 'ACTIVE' | 'ALL';
    limit?: number;
    offset?: number;
    hasContactViewPermission?: boolean;
  }): Promise<{ actions: RetentionOpportunityDTO[]; total: number }> {
    const {
      businessId,
      branchIds,
      statusFilter = 'ACTIVE',
      limit = 50,
      offset = 0,
      hasContactViewPermission = false,
    } = input;

    const admin = createAdminClient();

    let query = admin
      .from('crm_actions')
      .select(
        'id, business_id, crm_customer_id, branch_id, action_type, status, priority, title, reason_code, reason_summary, recommended_action, source_segment, due_at, snoozed_until, assigned_user_id, created_at, crm_customers(display_name, email_normalized, phone_normalized)',
        { count: 'exact' }
      )
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (branchIds && branchIds.length > 0) {
      query = query.or(`branch_id.is.null,branch_id.in.(${branchIds.join(',')})`);
    }

    if (statusFilter === 'ACTIVE') {
      query = query.in('status', ['OPEN', 'IN_PROGRESS', 'SNOOZED']);
    } else if (statusFilter !== 'ALL') {
      query = query.eq('status', statusFilter);
    }

    const { data, count, error } = await query;
    if (error) throw new Error(`Failed to list CRM actions: ${error.message}`);

    const actions: RetentionOpportunityDTO[] = [];

    for (const row of data || []) {
      const cust = (row as unknown as {
        crm_customers?: {
          display_name?: string;
          email_normalized?: string;
          phone_normalized?: string;
        };
      }).crm_customers;
      const rawName = cust?.display_name || 'Guest';
      const rawEmail = cust?.email_normalized || '';
      const rawPhone = cust?.phone_normalized || '';

      const maskedName = rawName.length > 3 ? `${rawName.substring(0, 2)}***` : rawName;
      const maskedContact = hasContactViewPermission
        ? `${rawEmail || rawPhone}`
        : `${maskEmail(rawEmail)} / ${maskPhone(rawPhone)}`;

      const eligibility = await EngagementEligibilityService.evaluateEligibility({
        businessId,
        customerId: row.crm_customer_id,
        purpose: row.action_type === 'SERVICE_RECOVERY' ? 'SERVICE_RECOVERY' : 'TRANSACTIONAL',
        hasContactViewPermission,
      });

      actions.push({
        id: row.id,
        customerId: row.crm_customer_id,
        maskedCustomerName: maskedName,
        maskedContact,
        reasonCode: row.reason_code,
        title: row.title,
        summary: row.reason_summary,
        priority: row.priority as CRMActionPriority,
        sourceSegment: row.source_segment || 'UNKNOWN',
        retentionRiskLevel: null,
        branchId: row.branch_id,
        recommendedAction: row.recommended_action,
        engagementEligibility: eligibility,
        status: row.status as CRMActionStatus,
        assignedUserId: row.assigned_user_id,
        assignedUserName: null,
        snoozedUntil: row.snoozed_until,
        dueAt: row.due_at,
        createdAt: row.created_at,
      });
    }

    return { actions, total: count || 0 };
  }

  /**
   * Concurrency-safe creation or reuse of an active action.
   */
  public static async createOrReuseAction(input: {
    businessId: string;
    customerId: string;
    branchId?: string | null;
    actionType: CRMActionType;
    priority: CRMActionPriority;
    title: string;
    reasonCode: string;
    reasonSummary: string;
    recommendedAction: string;
    sourceSegment: string;
    actorUserId: string;
  }): Promise<string> {
    const {
      businessId,
      customerId,
      branchId,
      actionType,
      priority,
      title,
      reasonCode,
      reasonSummary,
      recommendedAction,
      sourceSegment,
      actorUserId,
    } = input;

    const admin = createAdminClient();

    // Check existing active action for same business, customer, and reason code
    const { data: existing } = await admin
      .from('crm_actions')
      .select('id, status')
      .eq('business_id', businessId)
      .eq('crm_customer_id', customerId)
      .eq('reason_code', reasonCode)
      .in('status', ['OPEN', 'IN_PROGRESS', 'SNOOZED'])
      .maybeSingle();

    if (existing) {
      return existing.id; // Reuse existing active action
    }

    // Insert new action
    const { data: newAction, error } = await admin
      .from('crm_actions')
      .insert({
        business_id: businessId,
        crm_customer_id: customerId,
        branch_id: branchId || null,
        action_type: actionType,
        priority,
        title,
        reason_code: reasonCode,
        reason_summary: reasonSummary,
        recommended_action: recommendedAction,
        source_segment: sourceSegment,
        status: 'OPEN',
      })
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') {
        // Concurrency conflict hit partial index -> query and return existing action ID
        const { data: existingConflict } = await admin
          .from('crm_actions')
          .select('id')
          .eq('business_id', businessId)
          .eq('crm_customer_id', customerId)
          .eq('reason_code', reasonCode)
          .in('status', ['OPEN', 'IN_PROGRESS', 'SNOOZED'])
          .single();
        if (existingConflict) return existingConflict.id;
      }
      throw new Error(`Failed to create CRM action: ${error.message}`);
    }

    // Audit Event
    await admin.from('crm_action_events').insert({
      business_id: businessId,
      action_id: newAction.id,
      event_type: 'CREATED',
      actor_user_id: actorUserId,
      metadata: { reasonCode, actionType, priority },
    });

    return newAction.id;
  }

  /**
   * Validates if a staff user has legitimate property reach into a target branch.
   */
  public static async validateAssigneeBranchReach(input: {
    businessId: string;
    assignedUserId: string;
    targetBranchId: string;
  }): Promise<boolean> {
    const { businessId, assignedUserId, targetBranchId } = input;
    const admin = createAdminClient();

    // 1. Fetch active business membership
    const { data: membership } = await admin
      .from('business_memberships')
      .select('id, user_id, role, primary_branch_id')
      .eq('business_id', businessId)
      .eq('user_id', assignedUserId)
      .is('deleted_at', null)
      .maybeSingle();

    if (!membership) return false;

    // Business Owners have canonical organization-wide reach across all branches
    if (membership.role === 'business_owner') return true;

    // Direct primary branch match
    if (membership.primary_branch_id === targetBranchId) return true;

    // Active staff assignments reach match
    const { data: assignment } = await admin
      .from('staff_assignments')
      .select('id')
      .eq('business_id', businessId)
      .eq('user_id', assignedUserId)
      .eq('branch_id', targetBranchId)
      .is('deleted_at', null)
      .maybeSingle();

    if (assignment) return true;

    // Active secondment reach match (temporal validity check)
    const nowIso = new Date().toISOString();
    const { data: secondment } = await admin
      .from('secondments')
      .select('id')
      .eq('business_id', businessId)
      .eq('user_id', assignedUserId)
      .eq('host_branch_id', targetBranchId)
      .lte('start_date', nowIso)
      .gte('end_date', nowIso)
      .maybeSingle();

    if (secondment) return true;

    // Active acting assignment reach match (temporal validity check)
    const { data: acting } = await admin
      .from('acting_assignments')
      .select('id')
      .eq('business_id', businessId)
      .eq('user_id', assignedUserId)
      .eq('branch_id', targetBranchId)
      .lte('start_date', nowIso)
      .gte('end_date', nowIso)
      .maybeSingle();

    if (acting) return true;

    return false;
  }

  /**
   * Retrieves server-scoped eligible staff assignees for a given action or branch reach.
   */
  public static async getEligibleAssignees(input: {
    businessId: string;
    actionId?: string;
    branchId?: string | null;
  }): Promise<{ userId: string; displayName: string; role: string }[]> {
    const { businessId, actionId, branchId } = input;
    const admin = createAdminClient();

    let targetBranchId: string | null = branchId || null;

    if (actionId) {
      const { data: action } = await admin
        .from('crm_actions')
        .select('branch_id')
        .eq('id', actionId)
        .eq('business_id', businessId)
        .single();
      if (action) {
        targetBranchId = action.branch_id;
      }
    }

    const { data: memberships } = await admin
      .from('business_memberships')
      .select('user_id, role, users:user_id ( id, display_name, email )')
      .eq('business_id', businessId)
      .is('deleted_at', null);

    if (!memberships) return [];

    const result: { userId: string; displayName: string; role: string }[] = [];

    for (const mem of memberships) {
      if (!mem.user_id) continue;

      if (targetBranchId) {
        const hasReach = await CustomerActionService.validateAssigneeBranchReach({
          businessId,
          assignedUserId: mem.user_id,
          targetBranchId,
        });
        if (!hasReach) continue;
      }

      const userObj = mem.users as any;
      const displayName = userObj?.display_name || userObj?.email || `Staff Member (${mem.user_id.slice(0, 8)})`;

      result.push({
        userId: mem.user_id,
        displayName,
        role: mem.role,
      });
    }

    return result;
  }

  /**
   * Assigns action to a staff user with business tenancy and property-scope reach validation.
   */
  public static async assignAction(input: {
    businessId: string;
    actionId: string;
    assignedUserId: string;
    actorUserId: string;
  }): Promise<boolean> {
    const { businessId, actionId, assignedUserId, actorUserId } = input;
    const admin = createAdminClient();

    // 1. Fetch action details to check branch scoping
    const { data: action } = await admin
      .from('crm_actions')
      .select('id, branch_id')
      .eq('id', actionId)
      .eq('business_id', businessId)
      .maybeSingle();

    if (!action) {
      throw new Error('CRM Action not found or outside business tenancy.');
    }

    // 2. Verify property scope reach if action is branch-specific
    if (action.branch_id) {
      const hasReach = await CustomerActionService.validateAssigneeBranchReach({
        businessId,
        assignedUserId,
        targetBranchId: action.branch_id,
      });

      if (!hasReach) {
        throw new Error('Assignee does not have valid property reach for this branch-specific action.');
      }
    } else {
      // For business-wide actions, verify active business membership
      const { data: membership } = await admin
        .from('business_memberships')
        .select('id')
        .eq('business_id', businessId)
        .eq('user_id', assignedUserId)
        .is('deleted_at', null)
        .maybeSingle();

      if (!membership) {
        throw new Error('Assignee must be an active staff member belonging to the same business.');
      }
    }

    const { error } = await admin
      .from('crm_actions')
      .update({
        assigned_user_id: assignedUserId,
        assigned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', actionId)
      .eq('business_id', businessId);

    if (error) throw new Error(`Failed to assign CRM action: ${error.message}`);

    await admin.from('crm_action_events').insert({
      business_id: businessId,
      action_id: actionId,
      event_type: 'ASSIGNED',
      actor_user_id: actorUserId,
      metadata: { assignedUserId },
    });

    return true;
  }

  /**
   * Transitions status to IN_PROGRESS.
   */
  public static async startAction(input: {
    businessId: string;
    actionId: string;
    actorUserId: string;
  }): Promise<boolean> {
    const { businessId, actionId, actorUserId } = input;
    const admin = createAdminClient();

    const { data: current } = await admin
      .from('crm_actions')
      .select('status')
      .eq('id', actionId)
      .eq('business_id', businessId)
      .single();

    if (!current) throw new Error('Action not found.');

    if (!this.validateStatusTransition(current.status as CRMActionStatus, 'IN_PROGRESS')) {
      throw new Error(`Invalid status transition from ${current.status} to IN_PROGRESS.`);
    }

    const { error } = await admin
      .from('crm_actions')
      .update({
        status: 'IN_PROGRESS',
        updated_at: new Date().toISOString(),
      })
      .eq('id', actionId)
      .eq('business_id', businessId);

    if (error) throw new Error(`Failed to start CRM action: ${error.message}`);

    await admin.from('crm_action_events').insert({
      business_id: businessId,
      action_id: actionId,
      event_type: 'STARTED',
      actor_user_id: actorUserId,
    });

    return true;
  }

  /**
   * Snoozes action until a bounded future date (max 90 days).
   */
  public static async snoozeAction(input: {
    businessId: string;
    actionId: string;
    snoozedUntil: string;
    actorUserId: string;
  }): Promise<boolean> {
    const { businessId, actionId, snoozedUntil, actorUserId } = input;
    const admin = createAdminClient();

    const snoozeDate = new Date(snoozedUntil).getTime();
    const now = Date.now();
    const maxHorizon = now + 90 * 24 * 60 * 60 * 1000;

    if (isNaN(snoozeDate) || snoozeDate <= now) {
      throw new Error('Snooze date must be a valid future date.');
    }

    if (snoozeDate > maxHorizon) {
      throw new Error('Snooze date exceeds maximum allowed business horizon of 90 days.');
    }

    const { data: current } = await admin
      .from('crm_actions')
      .select('status')
      .eq('id', actionId)
      .eq('business_id', businessId)
      .single();

    if (!current) throw new Error('Action not found.');

    if (!this.validateStatusTransition(current.status as CRMActionStatus, 'SNOOZED')) {
      throw new Error(`Invalid status transition from ${current.status} to SNOOZED.`);
    }

    const { error } = await admin
      .from('crm_actions')
      .update({
        status: 'SNOOZED',
        snoozed_until: new Date(snoozeDate).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', actionId)
      .eq('business_id', businessId);

    if (error) throw new Error(`Failed to snooze CRM action: ${error.message}`);

    await admin.from('crm_action_events').insert({
      business_id: businessId,
      action_id: actionId,
      event_type: 'SNOOZED',
      actor_user_id: actorUserId,
      metadata: { snoozedUntil: new Date(snoozeDate).toISOString() },
    });

    return true;
  }

  /**
   * Marks action as COMPLETED (terminal).
   */
  public static async completeAction(input: {
    businessId: string;
    actionId: string;
    actorUserId: string;
  }): Promise<boolean> {
    const { businessId, actionId, actorUserId } = input;
    const admin = createAdminClient();

    const { data: current } = await admin
      .from('crm_actions')
      .select('status')
      .eq('id', actionId)
      .eq('business_id', businessId)
      .single();

    if (!current) throw new Error('Action not found.');

    if (!this.validateStatusTransition(current.status as CRMActionStatus, 'COMPLETED')) {
      throw new Error(`Invalid status transition from ${current.status} to COMPLETED.`);
    }

    const { error } = await admin
      .from('crm_actions')
      .update({
        status: 'COMPLETED',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', actionId)
      .eq('business_id', businessId);

    if (error) throw new Error(`Failed to complete CRM action: ${error.message}`);

    await admin.from('crm_action_events').insert({
      business_id: businessId,
      action_id: actionId,
      event_type: 'COMPLETED',
      actor_user_id: actorUserId,
    });

    return true;
  }

  /**
   * Marks action as DISMISSED (terminal).
   */
  public static async dismissAction(input: {
    businessId: string;
    actionId: string;
    actorUserId: string;
  }): Promise<boolean> {
    const { businessId, actionId, actorUserId } = input;
    const admin = createAdminClient();

    const { data: current } = await admin
      .from('crm_actions')
      .select('status')
      .eq('id', actionId)
      .eq('business_id', businessId)
      .single();

    if (!current) throw new Error('Action not found.');

    if (!this.validateStatusTransition(current.status as CRMActionStatus, 'DISMISSED')) {
      throw new Error(`Invalid status transition from ${current.status} to DISMISSED.`);
    }

    const { error } = await admin
      .from('crm_actions')
      .update({
        status: 'DISMISSED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', actionId)
      .eq('business_id', businessId);

    if (error) throw new Error(`Failed to dismiss CRM action: ${error.message}`);

    await admin.from('crm_action_events').insert({
      business_id: businessId,
      action_id: actionId,
      event_type: 'DISMISSED',
      actor_user_id: actorUserId,
    });

    return true;
  }

  /**
   * Evaluates retention opportunities across authorized customer base and creates/reuses actions.
   */
  public static async batchEvaluateActions(input: {
    businessId: string;
    branchIds?: string[] | null;
    actorUserId: string;
    limit?: number;
  }): Promise<{ evaluatedCount: number; createdCount: number }> {
    const { businessId, branchIds, actorUserId, limit = 50 } = input;
    const admin = createAdminClient();

    const { data: customers } = await admin
      .from('crm_customers')
      .select('id')
      .eq('business_id', businessId)
      .limit(limit);

    if (!customers || customers.length === 0) {
      return { evaluatedCount: 0, createdCount: 0 };
    }

    let createdCount = 0;

    for (const cust of customers) {
      const profile = await CustomerProfileService.getUnifiedCustomerProfileInternal({
        customerId: cust.id,
        businessId,
        branchIds,
      });

      if (!profile) continue;

      const segmentation = await CustomerSegmentationService.getCustomerSegmentation({
        businessId,
        customerId: cust.id,
        branchIds,
      });

      if (!segmentation) continue;

      const opportunities = await RetentionOpportunityEngine.evaluateOpportunities({
        businessId,
        profile,
        segmentation,
      });

      for (const opp of opportunities) {
        await this.createOrReuseAction({
          businessId,
          customerId: cust.id,
          branchId: branchIds && branchIds.length === 1 ? branchIds[0] : null,
          actionType: opp.actionType,
          priority: opp.priority,
          title: opp.title,
          reasonCode: opp.reasonCode,
          reasonSummary: opp.summary,
          recommendedAction: opp.recommendedAction,
          sourceSegment: opp.sourceSegment,
          actorUserId,
        });
        createdCount++;
      }
    }

    return { evaluatedCount: customers.length, createdCount };
  }
}
