/**
 * WSNexa Platform Feature Flags & Capability Registry
 * 
 * Central registry for feature toggles, launch scope gates, and experimental capabilities.
 */

export const FEATURES = {
  /**
   * Customer Loyalty & Rewards Program
   * Scope: V1 Launch reduction -> Temporarily disabled & moved to "Coming Soon".
   * 
   * When set to `false`:
   * - No points are earned on order completion or payment settlement.
   * - Reward creation and active redemption are blocked server-side.
   * - Customer and B2B portal loyalty routes render a clean "Coming Soon" state.
   * - Active checkout ignores reward deductions.
   * 
   * Architecture, database tables, and historical order snapshot compatibility
   * remain 100% preserved for upcoming releases.
   */
  LOYALTY_REWARDS_ENABLED: false,
} as const;

export const IS_LOYALTY_ENABLED = FEATURES.LOYALTY_REWARDS_ENABLED;
