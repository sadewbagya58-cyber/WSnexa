import { createAdminClient } from '@/lib/supabase/server';
import { CustomerSegmentationService } from './customer-segmentation.service';

export interface CustomerCRMOverviewDTO {
  totalCustomers: number;
  registeredCount: number;
  guestCount: number;
  vipCount: number;
  regularCount: number;
  atRiskCount: number;
  lapsedCount: number;
  newGuestCount: number;
  oneTimeCount: number;
  riskCounts: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  actionsCounts: {
    open: number;
    inProgress: number;
    snoozed: number;
    completed: number;
    dismissed: number;
    criticalPriority: number;
    highPriority: number;
  };
}

export class CRMOverviewService {
  /**
   * Computes authorized aggregate metrics for the CRM Hub overview header cards and breakdowns.
   */
  public static async getCRMOverview(input: {
    businessId: string;
    branchIds?: string[] | null;
  }): Promise<CustomerCRMOverviewDTO> {
    const { businessId, branchIds } = input;
    const admin = createAdminClient();

    // Build CRM Action Queue Breakdown query
    let actionQuery = admin
      .from('crm_actions')
      .select('status, priority, branch_id')
      .eq('business_id', businessId);

    if (branchIds && branchIds.length > 0) {
      actionQuery = actionQuery.or(`branch_id.is.null,branch_id.in.(${branchIds.join(',')})`);
    }

    // Parallelize all independent overview queries concurrently via Promise.all
    const [breakdown, registeredRes, guestRes, actionsRes] = await Promise.all([
      CustomerSegmentationService.getSegmentBreakdown({
        businessId,
        branchIds,
      }),
      admin
        .from('crm_customers')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('identity_type', 'REGISTERED'),
      admin
        .from('crm_customers')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('identity_type', 'KNOWN_GUEST'),
      actionQuery,
    ]);

    const totalCustomers = breakdown.totalCustomers;
    const registeredCount = registeredRes.count || 0;
    const guestCount = guestRes.count || 0;

    let vipCount = 0;
    let regularCount = 0;
    let atRiskCount = 0;
    let lapsedCount = 0;
    let newGuestCount = 0;
    let oneTimeCount = 0;

    for (const seg of breakdown.segments) {
      if (seg.segmentCode === 'VIP') vipCount = seg.customerCount;
      if (seg.segmentCode === 'REGULAR') regularCount = seg.customerCount;
      if (seg.segmentCode === 'AT_RISK') atRiskCount = seg.customerCount;
      if (seg.segmentCode === 'LAPSED') lapsedCount = seg.customerCount;
      if (seg.segmentCode === 'NEW_GUEST') newGuestCount = seg.customerCount;
      if (seg.segmentCode === 'ONE_TIME') oneTimeCount = seg.customerCount;
    }

    const actionsData = actionsRes.data || [];
    let open = 0;
    let inProgress = 0;
    let snoozed = 0;
    let completed = 0;
    let dismissed = 0;
    let criticalPriority = 0;
    let highPriority = 0;

    for (const act of actionsData || []) {
      if (act.status === 'OPEN') open++;
      if (act.status === 'IN_PROGRESS') inProgress++;
      if (act.status === 'SNOOZED') snoozed++;
      if (act.status === 'COMPLETED') completed++;
      if (act.status === 'DISMISSED') dismissed++;

      if (act.status === 'OPEN' || act.status === 'IN_PROGRESS' || act.status === 'SNOOZED') {
        if (act.priority === 'CRITICAL') criticalPriority++;
        if (act.priority === 'HIGH') highPriority++;
      }
    }

    // Risk counts derived from segment distribution
    const lowRisk = newGuestCount + regularCount + oneTimeCount;
    const mediumRisk = atRiskCount;
    const highRisk = Math.round(lapsedCount * 0.4);
    const criticalRisk = Math.round(lapsedCount * 0.6);

    return {
      totalCustomers: totalCustomers || (registeredCount || 0) + (guestCount || 0),
      registeredCount: registeredCount || 0,
      guestCount: guestCount || 0,
      vipCount,
      regularCount,
      atRiskCount,
      lapsedCount,
      newGuestCount,
      oneTimeCount,
      riskCounts: {
        low: lowRisk,
        medium: mediumRisk,
        high: highRisk,
        critical: criticalRisk,
      },
      actionsCounts: {
        open,
        inProgress,
        snoozed,
        completed,
        dismissed,
        criticalPriority,
        highPriority,
      },
    };
  }
}
