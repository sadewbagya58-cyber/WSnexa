import type {
  CRMActionPriority,
  CRMActionType,
} from '@/lib/crm/crm-action.types';
import type { CustomerSegmentationDTO, UnifiedCustomerProfileDTO } from '@/lib/crm/crm-types';

export interface OpportunityCandidate {
  reasonCode: string;
  actionType: CRMActionType;
  priority: CRMActionPriority;
  title: string;
  summary: string;
  recommendedAction: string;
  sourceSegment: string;
  cooldownDays: number;
}

export class RetentionOpportunityEngine {
  /**
   * Evaluates deterministic retention opportunity rules over a customer profile and segmentation DTO.
   */
  public static async evaluateOpportunities(input: {
    businessId: string;
    profile: UnifiedCustomerProfileDTO;
    segmentation: CustomerSegmentationDTO;
    hasContactViewPermission?: boolean;
  }): Promise<OpportunityCandidate[]> {
    const { profile, segmentation } = input;
    const candidates: OpportunityCandidate[] = [];

    const totalOrders = profile.activity?.completedOrders || 0;
    const recencyDays = segmentation.rfmScore.recencyDays;
    const riskLevel = segmentation.riskLevel;
    const primarySegment = segmentation.primarySegmentCode;

    // Sample Guard: Zero completed orders -> No opportunities generated
    if (totalOrders <= 0) {
      return candidates;
    }

    // Rule 1: LAPSED_REGULAR
    // Customer previously REGULAR or VIP, now LAPSED (>90d recency, >= 2 orders)
    if (recencyDays > 90 && totalOrders >= 2 && (primarySegment === 'LAPSED' || segmentation.segmentCodes.includes('LAPSED'))) {
      candidates.push({
        reasonCode: 'LAPSED_REGULAR',
        actionType: 'RETENTION_REVIEW',
        priority: 'HIGH',
        title: 'Lapsed Repeat Guest Follow-up',
        summary: `Guest has placed ${totalOrders} past orders but has had no order activity for ${recencyDays} days.`,
        recommendedAction: 'Review past dining history and loyalty points balance. Consider a manual re-engagement check-in.',
        sourceSegment: 'LAPSED',
        cooldownDays: 30,
      });
    }

    // Rule 2: HIGH_RISK_REPEAT_GUEST
    // Repeat guest (>= 2 orders) with HIGH or CRITICAL retention risk decay ratio
    if (totalOrders >= 2 && (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') && recencyDays <= 90) {
      candidates.push({
        reasonCode: 'HIGH_RISK_REPEAT_GUEST',
        actionType: 'FOLLOW_UP',
        priority: 'HIGH',
        title: 'High Retention Risk Check-in',
        summary: `Guest visit interval has expanded significantly (Risk Level: ${riskLevel}).`,
        recommendedAction: 'Check previous order notes for service complaints and consider proactive guest outreach.',
        sourceSegment: 'AT_RISK',
        cooldownDays: 30,
      });
    }

    // Rule 3: VIP_REENGAGEMENT
    // VIP guest with deteriorating recency (recencyScore <= 2)
    if (segmentation.segmentCodes.includes('VIP') && segmentation.rfmScore.recencyScore <= 2) {
      candidates.push({
        reasonCode: 'VIP_REENGAGEMENT',
        actionType: 'RETENTION_REVIEW',
        priority: 'HIGH',
        title: 'VIP Guest Retention Review',
        summary: `VIP guest has not returned in ${recencyDays} days.`,
        recommendedAction: 'Review VIP guest preferences and notify venue manager for personalized hospitality check-in.',
        sourceSegment: 'VIP',
        cooldownDays: 30,
      });
    }

    // Rule 4: SERVICE_RECOVERY (Explicit Review Evidence Guard)
    if (profile.reviews && profile.reviews.avgRatingGiven !== null && profile.reviews.avgRatingGiven <= 2.0 && profile.reviews.reviewCount > 0) {
      candidates.push({
        reasonCode: 'SERVICE_RECOVERY',
        actionType: 'SERVICE_RECOVERY',
        priority: 'CRITICAL',
        title: 'Low Rating Service Recovery',
        summary: `Guest submitted feedback with average rating of ${profile.reviews.avgRatingGiven.toFixed(1)} / 5.0 stars.`,
        recommendedAction: 'Inspect review feedback details and execute service recovery response protocol.',
        sourceSegment: primarySegment,
        cooldownDays: 14,
      });
    }

    // Rule 5: LOYALTY_REDEMPTION_OPPORTUNITY
    if (profile.loyalty && profile.loyalty.pointsBalance >= 100 && recencyDays <= 60) {
      candidates.push({
        reasonCode: 'LOYALTY_REDEMPTION_OPPORTUNITY',
        actionType: 'LOYALTY_REVIEW',
        priority: 'MEDIUM',
        title: 'Loyalty Reward Redemption Review',
        summary: `Guest holds a significant balance of ${profile.loyalty.pointsBalance} loyalty points (${profile.loyalty.tierName || 'Base'} tier).`,
        recommendedAction: 'Remind staff to highlight available reward redemption on next venue visit.',
        sourceSegment: primarySegment,
        cooldownDays: 30,
      });
    }

    // Rule 6: VIP_RECOGNITION
    if (primarySegment === 'VIP' && segmentation.rfmScore.recencyScore >= 4) {
      candidates.push({
        reasonCode: 'VIP_RECOGNITION',
        actionType: 'VIP_RECOGNITION',
        priority: 'MEDIUM',
        title: 'VIP Recognition & Hospitality Prep',
        summary: `Top spending active VIP guest with recent visit activity.`,
        recommendedAction: 'Ensure staff acknowledge VIP status and apply preferred seating or hospitality perks.',
        sourceSegment: 'VIP',
        cooldownDays: 30,
      });
    }

    return candidates;
  }
}
