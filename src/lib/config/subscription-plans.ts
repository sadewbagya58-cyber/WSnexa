export type SubscriptionPlanCode = 'starter' | 'growth' | 'enterprise';

export interface SubscriptionPlanLimits {
  maxBranches: number | null;
  maxActiveStaff: number | null;
  maxTables: number | null;
  maxMenuItems: number | null;
  maxCustomRoles: number | null;
}

export interface SubscriptionPlanDefinition {
  code: SubscriptionPlanCode;
  name: string;
  priceLkrMonthly: number | null; // null for Enterprise
  limits: SubscriptionPlanLimits;
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionPlanCode, SubscriptionPlanDefinition> = {
  starter: {
    code: 'starter',
    name: 'Starter',
    priceLkrMonthly: 4499,
    limits: {
      maxBranches: 1,
      maxActiveStaff: 10,
      maxTables: 50,
      maxMenuItems: 250,
      maxCustomRoles: 3,
    },
  },
  growth: {
    code: 'growth',
    name: 'Growth',
    priceLkrMonthly: 8999,
    limits: {
      maxBranches: 3,
      maxActiveStaff: 40,
      maxTables: 200,
      maxMenuItems: 1000,
      maxCustomRoles: 15,
    },
  },
  enterprise: {
    code: 'enterprise',
    name: 'Enterprise',
    priceLkrMonthly: null, // Custom
    limits: {
      maxBranches: null, // null = Unlimited / Custom
      maxActiveStaff: null,
      maxTables: null,
      maxMenuItems: null,
      maxCustomRoles: null,
    },
  },
};

export function getPlanDefinition(planCode: string): SubscriptionPlanDefinition {
  const code = (planCode || 'starter').toLowerCase() as SubscriptionPlanCode;
  return SUBSCRIPTION_PLANS[code] || SUBSCRIPTION_PLANS.starter;
}
