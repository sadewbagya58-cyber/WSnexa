import {
  SubscriptionPlanCode,
  SUBSCRIPTION_PRICING_CONFIG,
} from '@/lib/config/subscription-plans';

export type SubscriptionPaymentStatus =
  | 'pending'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'expired'
  | 'refunded';

export type SubscriptionPaymentProvider = 'dialog' | string | null;

export type SubscriptionBillingInterval = 'monthly';

export type SubscriptionPricingMode = 'SELF_SERVICE' | 'CONTACT_SALES';

export interface EnterprisePricingInput {
  branches: number;
  activeStaff: number;
}

export interface SubscriptionPricingRequest {
  planCode: SubscriptionPlanCode;
  billingInterval?: SubscriptionBillingInterval;
  enterpriseConfig?: EnterprisePricingInput;
}

export interface EnterprisePricingBreakdown {
  basePrice: number;
  includedBranches: number;
  includedStaff: number;
  requestedBranches: number;
  requestedStaff: number;
  extraBranches: number;
  extraBranchCharge: number;
  extraStaffCount: number;
  extraStaffBlocks: number;
  extraStaffCharge: number;
}

export interface SubscriptionPricingResult {
  planCode: SubscriptionPlanCode;
  billingInterval: SubscriptionBillingInterval;
  currency: 'LKR';
  subtotal: number;
  total: number;
  pricingMode: SubscriptionPricingMode;
  pricingEngineVersion: string;
  breakdown: EnterprisePricingBreakdown | null;
}

export interface SubscriptionPricingSnapshot extends SubscriptionPricingResult {
  calculatedAt: string;
}

export class SubscriptionPricingService {
  /**
   * Calculates canonical server-side subscription price for Starter plan.
   */
  static calculateStarterPrice(
    interval: SubscriptionBillingInterval = 'monthly'
  ): SubscriptionPricingResult {
    this.validateBillingInterval(interval);
    const amount = SUBSCRIPTION_PRICING_CONFIG.starterMonthlyLkr;

    return {
      planCode: 'starter',
      billingInterval: 'monthly',
      currency: 'LKR',
      subtotal: amount,
      total: amount,
      pricingMode: 'SELF_SERVICE',
      pricingEngineVersion: SUBSCRIPTION_PRICING_CONFIG.pricingEngineVersion,
      breakdown: null,
    };
  }

  /**
   * Calculates canonical server-side subscription price for Growth plan.
   */
  static calculateGrowthPrice(
    interval: SubscriptionBillingInterval = 'monthly'
  ): SubscriptionPricingResult {
    this.validateBillingInterval(interval);
    const amount = SUBSCRIPTION_PRICING_CONFIG.growthMonthlyLkr;

    return {
      planCode: 'growth',
      billingInterval: 'monthly',
      currency: 'LKR',
      subtotal: amount,
      total: amount,
      pricingMode: 'SELF_SERVICE',
      pricingEngineVersion: SUBSCRIPTION_PRICING_CONFIG.pricingEngineVersion,
      breakdown: null,
    };
  }

  /**
   * Calculates canonical server-side subscription price for Enterprise plan.
   * Base: LKR 24,999 (includes 5 branches / 75 staff).
   * Extra branch: +3,000 LKR/mo per branch above 5.
   * Extra staff: +2,000 LKR/mo per ceiling block of 25 staff above 75.
   */
  static calculateEnterprisePrice(
    config: EnterprisePricingInput,
    interval: SubscriptionBillingInterval = 'monthly'
  ): SubscriptionPricingResult {
    this.validateBillingInterval(interval);
    this.validateEnterpriseInput(config);

    const { branches, activeStaff } = config;
    const basePrice = SUBSCRIPTION_PRICING_CONFIG.enterpriseBaseMonthlyLkr;
    const includedBranches = SUBSCRIPTION_PRICING_CONFIG.enterpriseIncludedBranches;
    const includedStaff = SUBSCRIPTION_PRICING_CONFIG.enterpriseIncludedStaff;

    // 1. Calculate Extra Branches
    const extraBranches = Math.max(0, branches - includedBranches);
    const extraBranchCharge = extraBranches * SUBSCRIPTION_PRICING_CONFIG.enterpriseExtraBranchMonthlyLkr;

    // 2. Calculate Extra Staff (Ceiling Block Logic)
    const extraStaffCount = Math.max(0, activeStaff - includedStaff);
    const blockSize = SUBSCRIPTION_PRICING_CONFIG.enterpriseExtraStaffBlockSize;
    const extraStaffBlocks = extraStaffCount > 0 ? Math.ceil(extraStaffCount / blockSize) : 0;
    const extraStaffCharge = extraStaffBlocks * SUBSCRIPTION_PRICING_CONFIG.enterpriseExtraStaffBlockMonthlyLkr;

    // 3. Compute Total Integer LKR Amount
    const total = basePrice + extraBranchCharge + extraStaffCharge;

    const breakdown: EnterprisePricingBreakdown = {
      basePrice,
      includedBranches,
      includedStaff,
      requestedBranches: branches,
      requestedStaff: activeStaff,
      extraBranches,
      extraBranchCharge,
      extraStaffCount,
      extraStaffBlocks,
      extraStaffCharge,
    };

    return {
      planCode: 'enterprise',
      billingInterval: 'monthly',
      currency: 'LKR',
      subtotal: total,
      total,
      pricingMode: 'SELF_SERVICE',
      pricingEngineVersion: SUBSCRIPTION_PRICING_CONFIG.pricingEngineVersion,
      breakdown,
    };
  }

  /**
   * Single canonical public entry point for subscription price calculation.
   */
  static calculateSubscriptionPrice(
    request: SubscriptionPricingRequest
  ): SubscriptionPricingResult {
    if (!request || !request.planCode) {
      throw new Error('PRICING_INVALID_INPUT: Missing planCode');
    }

    const interval = request.billingInterval || 'monthly';
    const planCode = request.planCode.toLowerCase() as SubscriptionPlanCode;

    switch (planCode) {
      case 'starter':
        return this.calculateStarterPrice(interval);
      case 'growth':
        return this.calculateGrowthPrice(interval);
      case 'enterprise':
        if (!request.enterpriseConfig) {
          throw new Error('PRICING_INVALID_INPUT: enterpriseConfig is required for Enterprise plan pricing');
        }
        return this.calculateEnterprisePrice(request.enterpriseConfig, interval);
      default:
        throw new Error(`PRICING_INVALID_PLAN: Unsupported planCode "${request.planCode}"`);
    }
  }

  /**
   * Helper to construct immutable pricing snapshot object for DB persistence.
   */
  static createPricingSnapshot(result: SubscriptionPricingResult): SubscriptionPricingSnapshot {
    return {
      ...result,
      calculatedAt: new Date().toISOString(),
    };
  }

  /**
   * Validates billing interval.
   */
  private static validateBillingInterval(interval: string): void {
    if (interval !== 'monthly') {
      throw new Error(`PRICING_UNSUPPORTED_INTERVAL: Billing interval "${interval}" is not supported in V1`);
    }
  }

  /**
   * Validates Enterprise branch and staff inputs.
   */
  private static validateEnterpriseInput(config: EnterprisePricingInput): void {
    if (!config || typeof config !== 'object') {
      throw new Error('PRICING_INVALID_ENTERPRISE_CONFIG: Configuration object is required');
    }

    const { branches, activeStaff } = config;

    if (
      typeof branches !== 'number' ||
      !Number.isFinite(branches) ||
      !Number.isInteger(branches) ||
      branches < 1
    ) {
      throw new Error('PRICING_INVALID_ENTERPRISE_BRANCHES: Branches must be a positive integer >= 1');
    }

    if (
      typeof activeStaff !== 'number' ||
      !Number.isFinite(activeStaff) ||
      !Number.isInteger(activeStaff) ||
      activeStaff < 1
    ) {
      throw new Error('PRICING_INVALID_ENTERPRISE_STAFF: Active staff must be a positive integer >= 1');
    }
  }
}
