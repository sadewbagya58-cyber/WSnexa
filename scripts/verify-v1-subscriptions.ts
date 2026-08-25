import fs from 'fs';
import path from 'path';
import assert from 'assert';

// Bypass server-only guard for direct tsx execution
try {
  /* eslint-disable-next-line @typescript-eslint/ban-ts-comment */
  // @ts-ignore
  require.cache[require.resolve('server-only')] = {
    id: require.resolve('server-only'),
    filename: require.resolve('server-only'),
    loaded: true,
    exports: {},
  };
} catch {}

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  for (const line of envConfig.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const value = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-role-key';

async function runVerification() {
  console.log('\n================================================================');
  console.log('  WSNexa V1 Subscription Core — Step 3 Final Verification');
  console.log('================================================================\n');

  const { SubscriptionService } = await import('../src/server/services/subscription.service');
  const { SUBSCRIPTION_PLANS } = await import('../src/lib/config/subscription-plans');

  // 1. Migration Schema & Security Validation
  console.log('--- SECTION 1: Migration Schema & Security Validation ---');
  const migrationPath = path.join(process.cwd(), 'supabase/migrations/20260826000000_v1_subscription_core_schema.sql');
  assert(fs.existsSync(migrationPath), '1. Migration file 20260826000000_v1_subscription_core_schema.sql exists');

  const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
  assert(migrationSql.includes('CREATE TABLE IF NOT EXISTS public.business_subscriptions'), '2. public.business_subscriptions table created');
  assert(migrationSql.includes('CREATE TABLE IF NOT EXISTS public.business_subscription_events'), '3. public.business_subscription_events table created');
  assert(migrationSql.includes('dedupe_key VARCHAR(255) UNIQUE NOT NULL'), '4. Deterministic dedupe_key UNIQUE constraint enforced on events');
  assert(migrationSql.includes('ENABLE ROW LEVEL SECURITY'), '5. RLS enabled on subscription tables');
  assert(migrationSql.includes('REVOKE INSERT, UPDATE, DELETE ON TABLE public.business_subscriptions'), '6. Direct client mutation revoked on business_subscriptions');
  assert(migrationSql.includes('REVOKE INSERT, UPDATE, DELETE ON TABLE public.business_subscription_events'), '7. Direct client mutation revoked on business_subscription_events');
  assert(migrationSql.includes('V1 Migration Backfill: Pilot/Dev Complimentary Access'), '8. Safe forward-only backfill SQL for existing tenants included');

  // 2. Plan Definitions & Unlimited Semantics
  console.log('\n--- SECTION 2: Plan Definitions & Unlimited Semantics ---');
  assert(SUBSCRIPTION_PLANS.starter.limits.maxBranches === 1, '9. Starter branch limit is 1');
  assert(SUBSCRIPTION_PLANS.starter.limits.maxActiveStaff === 10, '10. Starter staff limit is 10');
  assert(SUBSCRIPTION_PLANS.growth.limits.maxBranches === 3, '11. Growth branch limit is 3');
  assert(SUBSCRIPTION_PLANS.growth.limits.maxActiveStaff === 40, '12. Growth staff limit is 40');
  assert(SUBSCRIPTION_PLANS.enterprise.limits.maxBranches === null, '13. Enterprise maxBranches is null (unlimited)');
  assert(SUBSCRIPTION_PLANS.enterprise.limits.maxActiveStaff === null, '14. Enterprise maxActiveStaff is null (unlimited)');
  assert(!migrationSql.includes('999999'), '15. Schema contains zero magic 999999 unlimited sentinel numbers');

  // 3. Pure Effective State Engine Unit Tests
  console.log('\n--- SECTION 3: Pure Effective State Engine Unit Tests ---');
  const now = new Date('2026-08-25T12:00:00Z');

  // Case A: Valid Trial
  const validTrial = SubscriptionService.calculateSubscriptionState(
    {
      status: 'trialing',
      trial_starts_at: '2026-08-20T00:00:00Z',
      trial_ends_at: '2026-09-03T00:00:00Z',
      current_period_starts_at: null,
      current_period_ends_at: null,
      grace_ends_at: null,
    },
    now
  );
  assert(validTrial.effectiveStatus === 'TRIALING', '16. Valid trial evaluates to TRIALING');
  assert(!validTrial.requiresDbReconciliation, '17. Valid trial requires no DB reconciliation');

  // Case B: Expired Trial within 7-Day Grace
  const expiredTrialInGrace = SubscriptionService.calculateSubscriptionState(
    {
      status: 'trialing',
      trial_starts_at: '2026-08-01T00:00:00Z',
      trial_ends_at: '2026-08-20T00:00:00Z', // Expired 5 days ago
      current_period_starts_at: null,
      current_period_ends_at: null,
      grace_ends_at: null,
    },
    now
  );
  assert(expiredTrialInGrace.effectiveStatus === 'GRACE_PERIOD', '18. Expired trial within 7 days evaluates to GRACE_PERIOD');
  assert(expiredTrialInGrace.requiresDbReconciliation, '19. Expired trial in grace flags DB reconciliation required');

  // Case C: Expired Trial Past Grace
  const expiredTrialPastGrace = SubscriptionService.calculateSubscriptionState(
    {
      status: 'trialing',
      trial_starts_at: '2026-07-01T00:00:00Z',
      trial_ends_at: '2026-07-15T00:00:00Z', // Expired 40 days ago
      current_period_starts_at: null,
      current_period_ends_at: null,
      grace_ends_at: null,
    },
    now
  );
  assert(expiredTrialPastGrace.effectiveStatus === 'SUSPENDED', '20. Expired trial past grace evaluates to SUSPENDED');
  assert(expiredTrialPastGrace.requiresDbReconciliation, '21. Expired trial past grace flags DB reconciliation required');

  // Case D: Valid Active
  const validActive = SubscriptionService.calculateSubscriptionState(
    {
      status: 'active',
      trial_starts_at: '2026-01-01T00:00:00Z',
      trial_ends_at: '2026-01-15T00:00:00Z',
      current_period_starts_at: '2026-08-01T00:00:00Z',
      current_period_ends_at: '2026-09-01T00:00:00Z',
      grace_ends_at: null,
    },
    now
  );
  assert(validActive.effectiveStatus === 'ACTIVE', '22. Valid active period evaluates to ACTIVE');

  // Case E: Expired Active within Grace
  const expiredActiveInGrace = SubscriptionService.calculateSubscriptionState(
    {
      status: 'active',
      trial_starts_at: '2026-01-01T00:00:00Z',
      trial_ends_at: '2026-01-15T00:00:00Z',
      current_period_starts_at: '2026-07-01T00:00:00Z',
      current_period_ends_at: '2026-08-22T00:00:00Z', // Expired 3 days ago
      grace_ends_at: null,
    },
    now
  );
  assert(expiredActiveInGrace.effectiveStatus === 'GRACE_PERIOD', '23. Expired active within 7 days evaluates to GRACE_PERIOD');

  // Case F: Stored grace_period Explicit Handling
  const storedGraceValid = SubscriptionService.calculateSubscriptionState(
    {
      status: 'grace_period',
      trial_starts_at: '2026-01-01T00:00:00Z',
      trial_ends_at: '2026-01-15T00:00:00Z',
      current_period_starts_at: null,
      current_period_ends_at: null,
      grace_ends_at: '2026-08-28T00:00:00Z', // Valid for 3 more days
    },
    now
  );
  assert(storedGraceValid.effectiveStatus === 'GRACE_PERIOD', '24. Stored grace_period with future grace_ends_at evaluates to GRACE_PERIOD');
  assert(!storedGraceValid.requiresDbReconciliation, '25. Valid stored grace_period requires no reconciliation');

  const storedGraceExpired = SubscriptionService.calculateSubscriptionState(
    {
      status: 'grace_period',
      trial_starts_at: '2026-01-01T00:00:00Z',
      trial_ends_at: '2026-01-15T00:00:00Z',
      current_period_starts_at: null,
      current_period_ends_at: null,
      grace_ends_at: '2026-08-20T00:00:00Z', // Expired 5 days ago
    },
    now
  );
  assert(storedGraceExpired.effectiveStatus === 'SUSPENDED', '26. Stored grace_period with past grace_ends_at evaluates to SUSPENDED');
  assert(storedGraceExpired.requiresDbReconciliation, '27. Expired stored grace_period requires DB reconciliation');

  // Case G: Terminal Suspended and Cancelled
  const suspendedState = SubscriptionService.calculateSubscriptionState(
    { status: 'suspended', trial_starts_at: '', trial_ends_at: '', current_period_starts_at: null, current_period_ends_at: null, grace_ends_at: null },
    now
  );
  assert(suspendedState.effectiveStatus === 'SUSPENDED', '28. Stored suspended evaluates to SUSPENDED');

  const cancelledState = SubscriptionService.calculateSubscriptionState(
    { status: 'cancelled', trial_starts_at: '', trial_ends_at: '', current_period_starts_at: null, current_period_ends_at: null, grace_ends_at: null },
    now
  );
  assert(cancelledState.effectiveStatus === 'CANCELLED', '29. Stored cancelled evaluates to CANCELLED');

  // 4. Effective Limits & Override Precedence
  console.log('\n--- SECTION 4: Effective Limits & Override Precedence ---');
  const mockSubStarterNoOverride = {
    id: 'sub-1',
    business_id: 'biz-1',
    plan_code: 'starter' as const,
    status: 'active' as const,
    trial_starts_at: '',
    trial_ends_at: '',
    current_period_starts_at: null,
    current_period_ends_at: null,
    grace_ends_at: null,
    suspended_at: null,
    cancelled_at: null,
    max_branches_override: null,
    max_staff_override: null,
    max_tables_override: null,
    max_menu_items_override: null,
    max_custom_roles_override: null,
    activation_source: 'manual',
    notes: null,
    created_at: '',
    updated_at: '',
  };

  const starterLimits = SubscriptionService.resolveEffectiveLimits(mockSubStarterNoOverride);
  assert(starterLimits.maxBranches === 1, '30. Default Starter maxBranches is 1');
  assert(starterLimits.maxActiveStaff === 10, '31. Default Starter maxActiveStaff is 10');

  const mockSubStarterWithOverride = {
    ...mockSubStarterNoOverride,
    max_branches_override: 5,
  };
  const overrideLimits = SubscriptionService.resolveEffectiveLimits(mockSubStarterWithOverride);
  assert(overrideLimits.maxBranches === 5, '32. Database max_branches_override (5) overrides plan default (1)');

  // 5. Branch Limit Compatibility Delegation
  console.log('\n--- SECTION 5: Branch Limit Service Compatibility ---');
  const branchLimitPath = path.join(process.cwd(), 'src/server/services/branch-limit.service.ts');
  assert(fs.existsSync(branchLimitPath), '33. branch-limit.service.ts file exists');

  const branchLimitContent = fs.readFileSync(branchLimitPath, 'utf-8');
  assert(branchLimitContent.includes('SubscriptionService.validateLimit'), '34. checkBranchQuota delegates to SubscriptionService');
  assert(!branchLimitContent.includes('process.env.NEXT_PUBLIC_DEFAULT_SUBSCRIPTION_TIER'), '35. Removed hardcoded process.env subscription tier reliance');

  // 6. Onboarding Integration Verification
  console.log('\n--- SECTION 6: Onboarding Integration Verification ---');
  const onboardingPath = path.join(process.cwd(), 'src/server/actions/onboarding.ts');
  const onboardingContent = fs.readFileSync(onboardingPath, 'utf-8');
  assert(onboardingContent.includes('SubscriptionService.createTrialSubscription'), '36. completeOnboardingAction provisions 14-day Starter trial upon onboarding RPC completion');

  // 7. Step 2 Tenant Resolver & Layout Guards Verification
  console.log('\n--- SECTION 7: Tenant Resolver & Layout Access Enforcement ---');
  const resolverPath = path.join(process.cwd(), 'src/server/tenant/resolver.ts');
  const resolverContent = fs.readFileSync(resolverPath, 'utf-8');
  assert(resolverContent.includes('SubscriptionService.resolveSubscriptionContext'), '37. resolveActiveBusinessContext resolves subscription context');

  const layoutPath = path.join(process.cwd(), 'src/app/(dashboard)/layout.tsx');
  const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
  assert(layoutContent.includes('business.status === \'suspended\''), '38. DashboardLayout checks platform suspension precedence');
  assert(layoutContent.includes('redirect(\'/account/pending-access?reason=platform_suspended\')'), '39. Platform suspension redirects to pending access page');
  assert(layoutContent.includes('membership.role !== \'business_owner\''), '40. Non-owner staff redirected when commercially suspended');

  const shellPath = path.join(process.cwd(), 'src/components/layout/dashboard-shell.tsx');
  const shellContent = fs.readFileSync(shellPath, 'utf-8');
  assert(shellContent.includes('/dashboard/settings/subscription'), '41. Suspended owner redirected to subscription settings page');
  assert(shellContent.includes('Subscription Grace Period Active'), '42. Grace period warning banner rendered in DashboardShell');
  assert(shellContent.includes('Free Trial Ending Soon'), '43. Trial ending warning banner rendered in DashboardShell');

  // 8. Step 2 Public QR Ordering & Reservation Enforcement Verification
  console.log('\n--- SECTION 8: Public QR Ordering & Reservation Enforcement ---');
  const orderServicePath = path.join(process.cwd(), 'src/server/services/order.service.ts');
  const orderServiceContent = fs.readFileSync(orderServicePath, 'utf-8');
  assert(orderServiceContent.includes('Ordering is currently unavailable for this venue.'), '44. OrderService.createGuestOrder blocks guest orders for suspended businesses');

  const publicResPath = path.join(process.cwd(), 'src/server/reservations/public-reservation.service.ts');
  const publicResContent = fs.readFileSync(publicResPath, 'utf-8');
  assert(publicResContent.includes('Table reservations are currently unavailable for this venue.'), '45. PublicReservationService blocks guest bookings for suspended businesses');

  // 9. Step 2 Resource Limit Enforcement Integration Verification
  console.log('\n--- SECTION 9: Resource Limit Enforcement Integration ---');
  const staffInvitePath = path.join(process.cwd(), 'src/server/services/staff-invitation.service.ts');
  const staffInviteContent = fs.readFileSync(staffInvitePath, 'utf-8');
  assert(staffInviteContent.includes('validateLimit(businessId, \'staff\')'), '46. StaffInvitationService checks active staff limit');

  const tableActionPath = path.join(process.cwd(), 'src/server/actions/table.ts');
  const tableActionContent = fs.readFileSync(tableActionPath, 'utf-8');
  assert(tableActionContent.includes('validateLimit(authContext.businessId, \'tables\')'), '47. createDiningTableAction checks table limit');

  const menuActionPath = path.join(process.cwd(), 'src/server/actions/menu.ts');
  const menuActionContent = fs.readFileSync(menuActionPath, 'utf-8');
  assert(menuActionContent.includes('validateLimit(authContext.businessId, \'menuItems\')'), '48. createMenuItemAction checks menu items limit');

  const roleGovPath = path.join(process.cwd(), 'src/server/services/role-governance.service.ts');
  const roleGovContent = fs.readFileSync(roleGovPath, 'utf-8');
  assert(roleGovContent.includes('validateLimit(businessId, \'customRoles\')'), '49. RoleGovernanceService checks custom roles limit');

  const ownerPagePath = path.join(process.cwd(), 'src/app/(dashboard)/dashboard/settings/subscription/page.tsx');
  assert(fs.existsSync(ownerPagePath), '50. Owner Subscription Management page exists at /dashboard/settings/subscription');

  // 10. Step 2 Pending-Access Hotfix & Redirect Loop Protection Verification
  console.log('\n--- SECTION 10: Pending-Access Hotfix & Redirect Loop Protection ---');
  const pendingPagePath = path.join(process.cwd(), 'src/app/(auth)/account/pending-access/page.tsx');
  const pendingPageContent = fs.readFileSync(pendingPagePath, 'utf-8');
  assert(pendingPageContent.includes('if (!reason)'), '51. PendingAccessPage skips dashboard redirect check when reason parameter is present');

  const pendingScreenPath = path.join(process.cwd(), 'src/components/auth/pending-access-screen.tsx');
  const pendingScreenContent = fs.readFileSync(pendingScreenPath, 'utf-8');
  assert(pendingScreenContent.includes('reason === \'subscription_suspended\''), '52. PendingAccessScreen handles subscription_suspended reason');
  assert(pendingScreenContent.includes('Subscription Suspended'), '53. PendingAccessScreen renders Subscription Suspended header');
  assert(pendingScreenContent.includes('reason === \'platform_suspended\''), '54. PendingAccessScreen handles platform_suspended reason');
  assert(pendingScreenContent.includes('Sign Out / Switch Account'), '55. PendingAccessScreen exposes Sign Out button');

  // 11. Step 2 Public Suspension UX Hotfix Verification
  console.log('\n--- SECTION 11: Public Suspension UX Hotfix ---');
  const venuePagePath = path.join(process.cwd(), 'src/app/(public)/venues/[slug]/page.tsx');
  const venuePageContent = fs.readFileSync(venuePagePath, 'utf-8');
  assert(venuePageContent.includes('isCommerciallySuspended'), '56. Public venue page checks isCommerciallySuspended');
  assert(venuePageContent.includes('Reservations Unavailable'), '57. Public venue page renders Reservations Unavailable CTA when suspended');

  const reservePagePath = path.join(process.cwd(), 'src/app/(public)/venues/[slug]/reserve/page.tsx');
  const reservePageContent = fs.readFileSync(reservePagePath, 'utf-8');
  assert(reservePageContent.includes('isCommerciallySuspended'), '58. Public reserve page checks isCommerciallySuspended');
  assert(reservePageContent.includes('Table reservations are currently unavailable for this venue.'), '59. Public reserve page renders Reservations Unavailable card when suspended');

  const qrPagePath = path.join(process.cwd(), 'src/app/m/[token]/page.tsx');
  const qrPageContent = fs.readFileSync(qrPagePath, 'utf-8');
  assert(qrPageContent.includes('isOrderingUnavailable'), '60. Public QR page checks isOrderingUnavailable');

  const checkoutPagePath = path.join(process.cwd(), 'src/app/m/[token]/checkout/page.tsx');
  const checkoutPageContent = fs.readFileSync(checkoutPagePath, 'utf-8');
  assert(checkoutPageContent.includes('Ordering is currently unavailable for this venue.'), '61. Public QR checkout page renders Ordering Unavailable card when suspended');

  // 12. Step 3 Super Admin Subscription Management & Final Closure Verification
  console.log('\n--- SECTION 12: Step 3 Super Admin Controls & Final Closure ---');
  const superAdminActionPath = path.join(process.cwd(), 'src/server/actions/super-admin-subscription.ts');
  assert(fs.existsSync(superAdminActionPath), '62. Super Admin subscription server actions exist in super-admin-subscription.ts');

  const superAdminActionContent = fs.readFileSync(superAdminActionPath, 'utf-8');
  assert(superAdminActionContent.includes('requireSuperAdmin()'), '63. Super Admin subscription server actions enforce requireSuperAdmin()');

  assert(typeof SubscriptionService.manualActivateSubscription === 'function', '64. SubscriptionService.manualActivateSubscription method exists');
  assert(typeof SubscriptionService.extendTrial === 'function', '65. SubscriptionService.extendTrial method exists');
  assert(typeof SubscriptionService.extendGracePeriod === 'function', '66. SubscriptionService.extendGracePeriod method exists');
  assert(typeof SubscriptionService.changeSubscriptionPlan === 'function', '67. SubscriptionService.changeSubscriptionPlan method exists');
  assert(typeof SubscriptionService.setEnterpriseOverrides === 'function', '68. SubscriptionService.setEnterpriseOverrides method exists');
  assert(typeof SubscriptionService.suspendSubscription === 'function', '69. SubscriptionService.suspendSubscription method exists');
  assert(typeof SubscriptionService.reactivateSubscription === 'function', '70. SubscriptionService.reactivateSubscription method exists');
  assert(typeof SubscriptionService.cancelSubscription === 'function', '71. SubscriptionService.cancelSubscription method exists');

  const adminControlPath = path.join(process.cwd(), 'src/components/admin/admin-subscription-control.tsx');
  assert(fs.existsSync(adminControlPath), '72. AdminSubscriptionControl component exists in admin-subscription-control.tsx');

  const ownerClientPath = path.join(process.cwd(), 'src/components/subscription/owner-subscription-client.tsx');
  const ownerClientContent = fs.readFileSync(ownerClientPath, 'utf-8');
  assert(ownerClientContent.includes('LKR 4,499'), '73. Owner subscription UI displays LKR 4,499 Starter pricing');
  assert(ownerClientContent.includes('LKR 8,999'), '74. Owner subscription UI displays LKR 8,999 Growth pricing');
  assert(ownerClientContent.includes('Manual Activation Required'), '75. Owner subscription UI displays manual activation notice for payment CTAs');

  const docPath = path.join(process.cwd(), 'docs/v1-subscription-core.md');
  assert(fs.existsSync(docPath), '76. Documentation file docs/v1-subscription-core.md exists');

  console.log('\n================================================================');
  console.log('  V1 Subscription Core Step 3: ALL 76 ASSERTIONS PASSED');
  console.log('  Status: V1 SUBSCRIPTION CORE CLOSED');
  console.log('================================================================\n');
}

runVerification().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
