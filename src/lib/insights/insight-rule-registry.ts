import { InsightCategory, InsightSeverity } from './insight-types';
import { AnalyticsMetricKey } from '@/lib/analytics/analytics-types';

export interface InsightRuleDefinition {
  ruleKey: string;
  category: InsightCategory;
  defaultSeverity: InsightSeverity;
  titleTemplate: string;
  requiredMetrics: AnalyticsMetricKey[];
  requiresFinancialAccess: boolean;
  minSampleSize?: number;
  description: string;
  recommendationTemplate: {
    title: string;
    action: string;
    cautiousReasoning: string;
  };
}

export const INSIGHT_RULES: Record<string, InsightRuleDefinition> = {
  // Sales Rules
  'sales.decline': {
    ruleKey: 'sales.decline',
    category: 'SALES',
    defaultSeverity: 'WARNING',
    titleTemplate: 'Gross Sales Decline Detected',
    requiredMetrics: ['gross_sales'],
    requiresFinancialAccess: true,
    description: 'Triggers when period gross sales decrease by >= 10% compared to the prior period.',
    recommendationTemplate: {
      title: 'Sales & Volume Inspection',
      action: 'Compare customer traffic, promotion effectiveness, and peak-hour order counts against baseline.',
      cautiousReasoning: 'Sales decline may stem from external demand shifts, weather, or operational bottlenecks.',
    },
  },
  'sales.growth': {
    ruleKey: 'sales.growth',
    category: 'SALES',
    defaultSeverity: 'SUCCESS',
    titleTemplate: 'Strong Sales Growth Recorded',
    requiredMetrics: ['gross_sales'],
    requiresFinancialAccess: true,
    description: 'Triggers when period gross sales increase by >= 10% compared to the prior period.',
    recommendationTemplate: {
      title: 'Capacity & Inventory Alignment',
      action: 'Verify stock reserves and kitchen staffing to sustain sales momentum during peak hours.',
      cautiousReasoning: 'Increased order volume places higher demand on inventory and preparation teams.',
    },
  },
  'sales.aov_decline': {
    ruleKey: 'sales.aov_decline',
    category: 'SALES',
    defaultSeverity: 'WARNING',
    titleTemplate: 'Average Order Value (AOV) Contracting',
    requiredMetrics: ['aov'],
    requiresFinancialAccess: true,
    description: 'Triggers when Average Order Value drops by >= 8% compared to the prior period.',
    recommendationTemplate: {
      title: 'Basket Size Analysis',
      action: 'Review modifier upsell rates, combo pricing, and staff suggestion techniques at checkout.',
      cautiousReasoning: 'Lower AOV indicates smaller basket sizes or increased redemption of promotional discounts.',
    },
  },

  // Operations Rules
  'ops.prep_time_deterioration': {
    ruleKey: 'ops.prep_time_deterioration',
    category: 'OPERATIONS',
    defaultSeverity: 'WARNING',
    titleTemplate: 'Kitchen Preparation Time Deterioration',
    requiredMetrics: ['avg_kitchen_preparation_time', 'placed_orders'],
    requiresFinancialAccess: false,
    minSampleSize: 10,
    description: 'Triggers when average kitchen prep time exceeds 20 minutes or increases significantly.',
    recommendationTemplate: {
      title: 'Kitchen Queue & Workload Review',
      action: 'Inspect station routing, peak-hour kitchen prep queue depth, and item preparation complexity.',
      cautiousReasoning: 'Long prep times increase order backlog and lower guest satisfaction during busy shifts.',
    },
  },
  'ops.low_completion_rate': {
    ruleKey: 'ops.low_completion_rate',
    category: 'OPERATIONS',
    defaultSeverity: 'CRITICAL',
    titleTemplate: 'Order Completion Rate Below Target',
    requiredMetrics: ['completion_rate', 'placed_orders'],
    requiresFinancialAccess: false,
    minSampleSize: 10,
    description: 'Triggers when overall order completion rate drops below 90%.',
    recommendationTemplate: {
      title: 'Fulfillment & Rejection Audit',
      action: 'Investigate reasons for cancelled or rejected orders across POS and kitchen entry terminals.',
      cautiousReasoning: 'Order drops lead to wasted kitchen inventory and lost revenue opportunities.',
    },
  },
  'ops.high_pending_queue': {
    ruleKey: 'ops.high_pending_queue',
    category: 'OPERATIONS',
    defaultSeverity: 'WARNING',
    titleTemplate: 'High Pending Order Backlog',
    requiredMetrics: ['pending_order_count'],
    requiresFinancialAccess: false,
    description: 'Triggers when active pending order backlog exceeds 15 orders.',
    recommendationTemplate: {
      title: 'Order Dispatch Acceleration',
      action: 'Ensure expediter and kitchen displays are actively clearing completed tickets.',
      cautiousReasoning: 'Backlogged pending tickets delay kitchen ticket printing and order dispatching.',
    },
  },

  // Menu Rules
  'menu.top_performer': {
    ruleKey: 'menu.top_performer',
    category: 'MENU',
    defaultSeverity: 'INFO',
    titleTemplate: 'Top Revenue Generating Menu Item',
    requiredMetrics: ['quantity_sold_by_item'],
    requiresFinancialAccess: false,
    description: 'Identifies the leading menu item driving volume and category revenue.',
    recommendationTemplate: {
      title: 'Ingredient Availability Safeguard',
      action: 'Maintain strict reorder levels for raw ingredients supporting top-selling items.',
      cautiousReasoning: 'High demand items are particularly vulnerable to sudden stockout disruptions.',
    },
  },

  // Inventory Rules
  'inventory.out_of_stock_critical': {
    ruleKey: 'inventory.out_of_stock_critical',
    category: 'INVENTORY',
    defaultSeverity: 'CRITICAL',
    titleTemplate: 'Stockout Condition Detected',
    requiredMetrics: ['out_of_stock_item_count'],
    requiresFinancialAccess: false,
    description: 'Triggers when one or more active inventory items are completely out of stock.',
    recommendationTemplate: {
      title: 'Emergency Replenishment',
      action: 'Check supplier purchase orders or initiate inter-branch stock transfers immediately.',
      cautiousReasoning: 'Complete stockouts require menu item disabling to prevent order fulfillment failures.',
    },
  },
  'inventory.low_stock_warning': {
    ruleKey: 'inventory.low_stock_warning',
    category: 'INVENTORY',
    defaultSeverity: 'WARNING',
    titleTemplate: 'Low Inventory Level Pressure',
    requiredMetrics: ['low_stock_item_count'],
    requiresFinancialAccess: false,
    description: 'Triggers when 5 or more active items cross below minimum reorder thresholds.',
    recommendationTemplate: {
      title: 'Purchase Order Review',
      action: 'Review suggested reorder quantities and submit purchase orders to registered suppliers.',
      cautiousReasoning: 'Items below minimum stock level risk stockouts during subsequent busy shifts.',
    },
  },
  'inventory.high_waste': {
    ruleKey: 'inventory.high_waste',
    category: 'INVENTORY',
    defaultSeverity: 'WARNING',
    titleTemplate: 'Elevated Ingredient Waste Cost',
    requiredMetrics: ['waste_cost_cents'],
    requiresFinancialAccess: true,
    description: 'Triggers when recorded ingredient waste cost is significant during the period.',
    recommendationTemplate: {
      title: 'Waste & Spoilage Investigation',
      action: 'Inspect storage temperature logs, shelf-life expiry dates, and prep portioning compliance.',
      cautiousReasoning: 'High waste directly impacts food margin and indicates potential storage or over-prepping issues.',
    },
  },

  // Reputation Rules
  'reputation.rating_decline': {
    ruleKey: 'reputation.rating_decline',
    category: 'REPUTATION',
    defaultSeverity: 'WARNING',
    titleTemplate: 'Average Rating Contraction',
    requiredMetrics: ['avg_rating', 'review_count'],
    requiresFinancialAccess: false,
    minSampleSize: 5,
    description: 'Triggers when average customer rating drops below 4.0 or decreases significantly.',
    recommendationTemplate: {
      title: 'Customer Feedback Audit',
      action: 'Examine recent negative feedback tags (food temperature, service speed, accuracy).',
      cautiousReasoning: 'Falling customer ratings indicate recurring operational friction points.',
    },
  },
  'reputation.unresponded_reviews': {
    ruleKey: 'reputation.unresponded_reviews',
    category: 'REPUTATION',
    defaultSeverity: 'INFO',
    titleTemplate: 'Unresponded Customer Reviews Backlog',
    requiredMetrics: ['unresponded_review_count', 'response_rate'],
    requiresFinancialAccess: false,
    minSampleSize: 5,
    description: 'Triggers when 5 or more customer reviews remain unresponded.',
    recommendationTemplate: {
      title: 'Reputation Engagement',
      action: 'Draft responses to pending customer reviews to maintain brand responsiveness.',
      cautiousReasoning: 'Prompt owner responses build customer loyalty and demonstrate service accountability.',
    },
  },

  // Branch Comparison Rules
  'branch.performance_variance': {
    ruleKey: 'branch.performance_variance',
    category: 'BRANCH',
    defaultSeverity: 'INFO',
    titleTemplate: 'Multi-Branch Performance Variance',
    requiredMetrics: ['revenue_per_branch'],
    requiresFinancialAccess: false,
    description: 'Highlights top and bottom performing branches across authorized property scope.',
    recommendationTemplate: {
      title: 'Fleet Standardization Check',
      action: 'Share operational best practices from high-performing branches to underperforming locations.',
      cautiousReasoning: 'Variance in prep speed or sales volume often reflects local staffing or traffic differences.',
    },
  },
};
