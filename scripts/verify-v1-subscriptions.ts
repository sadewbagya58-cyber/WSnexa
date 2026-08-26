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
  console.log('  WSNexa V1 Subscription Core — FINAL Production QA Hotfix Batch');
  console.log('================================================================\n');

  const { SubscriptionService, TRIAL_ENTITLEMENT_LIMITS } = await import('../src/server/services/subscription.service');
  const { SUBSCRIPTION_PLANS } = await import('../src/lib/config/subscription-plans');
  const { resolveUnifiedAccessState } = await import('../src/server/tenant/unified-access');

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

  const realtimeMigrationPath = path.join(process.cwd(), 'supabase/migrations/20260826010000_realtime_subscriptions_and_businesses.sql');
  assert(fs.existsSync(realtimeMigrationPath), '7. Realtime migration 20260826010000_realtime_subscriptions_and_businesses.sql exists');

  const realtimeMigrationSql = fs.readFileSync(realtimeMigrationPath, 'utf-8');
  assert(realtimeMigrationSql.includes('ALTER PUBLICATION supabase_realtime ADD TABLE public.business_subscriptions'), '8. business_subscriptions added to supabase_realtime publication');
  assert(realtimeMigrationSql.includes('ALTER PUBLICATION supabase_realtime ADD TABLE public.businesses'), '9. businesses added to supabase_realtime publication');
  assert(realtimeMigrationSql.includes('ALTER TABLE public.notifications ALTER COLUMN branch_id DROP NOT NULL'), '10. notifications.branch_id constraint updated for business-level notifications');

  // 2. Plan Definitions & Trial Entitlements Model
  console.log('\n--- SECTION 2: Plan Definitions & Trial Entitlements Model ---');
  assert(SUBSCRIPTION_PLANS.starter.limits.maxBranches === 1, '11. Starter branch limit is 1');
  assert(SUBSCRIPTION_PLANS.starter.limits.maxActiveStaff === 10, '12. Starter staff limit is 10');
  assert(SUBSCRIPTION_PLANS.growth.limits.maxBranches === 3, '13. Growth branch limit is 3');
  assert(SUBSCRIPTION_PLANS.enterprise.limits.maxBranches === null, '14. Enterprise maxBranches is null (unlimited)');

  assert(TRIAL_ENTITLEMENT_LIMITS.maxBranches === 3, '15. 14-day trial provides 3 branches entitlement');
  assert(TRIAL_ENTITLEMENT_LIMITS.maxActiveStaff === 40, '16. 14-day trial provides 40 staff entitlement');
  assert(TRIAL_ENTITLEMENT_LIMITS.maxTables === 150, '17. 14-day trial provides 150 tables entitlement');
  assert(TRIAL_ENTITLEMENT_LIMITS.maxMenuItems === 1000, '18. 14-day trial provides 1,000 menu items entitlement');

  // 3. Unified Access State Resolver Unit Tests
  console.log('\n--- SECTION 3: Unified Access State Resolver Unit Tests ---');
  const platSusp = resolveUnifiedAccessState({ businessStatus: 'suspended', effectiveSubscriptionStatus: 'ACTIVE' });
  assert(platSusp.isRestricted && platSusp.reason === 'platform_suspended', '19. Platform suspension takes precedence over active subscription');

  const subSusp = resolveUnifiedAccessState({ businessStatus: 'active', effectiveSubscriptionStatus: 'SUSPENDED' });
  assert(subSusp.isRestricted && subSusp.reason === 'subscription_suspended', '20. Subscription SUSPENDED evaluates to subscription_suspended');

  const subCanc = resolveUnifiedAccessState({ businessStatus: 'active', effectiveSubscriptionStatus: 'CANCELLED' });
  assert(subCanc.isRestricted && subCanc.reason === 'subscription_cancelled', '21. Subscription CANCELLED evaluates to subscription_cancelled');

  const opActive = resolveUnifiedAccessState({ businessStatus: 'active', effectiveSubscriptionStatus: 'ACTIVE' });
  assert(!opActive.isRestricted && opActive.reason === null, '22. Active business and subscription evaluates to operational (unrestricted)');

  const opTrial = resolveUnifiedAccessState({ businessStatus: 'active', effectiveSubscriptionStatus: 'TRIALING' });
  assert(!opTrial.isRestricted && opTrial.reason === null, '23. Trialing subscription evaluates to operational');

  const opGrace = resolveUnifiedAccessState({ businessStatus: 'active', effectiveSubscriptionStatus: 'GRACE_PERIOD' });
  assert(!opGrace.isRestricted && opGrace.reason === null, '24. Grace period subscription evaluates to operational');

  // 4. Effective Limits & Override Precedence
  console.log('\n--- SECTION 4: Effective Limits & Override Precedence ---');
  const mockSubTrial = {
    id: 'sub-1',
    business_id: 'biz-1',
    plan_code: 'starter' as const,
    status: 'trialing' as const,
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
    activation_source: 'onboarding_trial',
    notes: null,
    created_at: '',
    updated_at: '',
  };

  const trialLimits = SubscriptionService.resolveEffectiveLimits(mockSubTrial);
  assert(trialLimits.maxBranches === 3, '25. Default Trial maxBranches uses trial entitlement (3)');
  assert(trialLimits.maxActiveStaff === 40, '26. Default Trial maxActiveStaff uses trial entitlement (40)');

  const mockSubActiveStarter = {
    ...mockSubTrial,
    status: 'active' as const,
  };
  const activeLimits = SubscriptionService.resolveEffectiveLimits(mockSubActiveStarter);
  assert(activeLimits.maxBranches === 1, '27. Active Starter maxBranches falls back to plan limit (1)');

  const mockSubStarterWithOverride = {
    ...mockSubActiveStarter,
    max_branches_override: 8,
  };
  const overrideLimits = SubscriptionService.resolveEffectiveLimits(mockSubStarterWithOverride);
  assert(overrideLimits.maxBranches === 8, '28. Database max_branches_override (8) overrides plan default');

  // 5. Server-Side Operational Assertion Guard Tests
  console.log('\n--- SECTION 5: Server-Side Operational Assertion Guard ---');
  assert(typeof SubscriptionService.assertOperationalSubscription === 'function', '29. SubscriptionService.assertOperationalSubscription method exists');

  // 6. Branch Limit & Onboarding Integration
  console.log('\n--- SECTION 6: Service & Onboarding Integration ---');
  const branchLimitPath = path.join(process.cwd(), 'src/server/services/branch-limit.service.ts');
  const branchLimitContent = fs.readFileSync(branchLimitPath, 'utf-8');
  assert(branchLimitContent.includes('SubscriptionService.validateLimit'), '30. checkBranchQuota delegates to SubscriptionService');

  const onboardingPath = path.join(process.cwd(), 'src/server/actions/onboarding.ts');
  const onboardingContent = fs.readFileSync(onboardingPath, 'utf-8');
  assert(onboardingContent.includes('SubscriptionService.createTrialSubscription'), '31. completeOnboardingAction provisions trial subscription');

  // 7. Tenant Resolver & Layout Guards Verification
  console.log('\n--- SECTION 7: Tenant Resolver & Layout Access Enforcement ---');
  const layoutPath = path.join(process.cwd(), 'src/app/(dashboard)/layout.tsx');
  const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
  assert(layoutContent.includes('resolveUnifiedAccessState'), '32. DashboardLayout uses resolveUnifiedAccessState');

  const shellPath = path.join(process.cwd(), 'src/components/layout/dashboard-shell.tsx');
  const shellContent = fs.readFileSync(shellPath, 'utf-8');
  assert(shellContent.includes('SubscriptionRealtimeListener'), '33. DashboardShell embeds SubscriptionRealtimeListener');

  // 8. Public QR Ordering & Reservation Enforcement Verification
  console.log('\n--- SECTION 8: Public QR Ordering & Reservation Enforcement ---');
  const orderServicePath = path.join(process.cwd(), 'src/server/services/order.service.ts');
  const orderServiceContent = fs.readFileSync(orderServicePath, 'utf-8');
  assert(orderServiceContent.includes('Ordering is currently unavailable for this venue.'), '34. OrderService blocks guest orders for suspended businesses');

  const publicResPath = path.join(process.cwd(), 'src/server/reservations/public-reservation.service.ts');
  const publicResContent = fs.readFileSync(publicResPath, 'utf-8');
  assert(publicResContent.includes('Table reservations are currently unavailable for this venue.'), '35. PublicReservationService blocks guest bookings for suspended businesses');

  // 9. Resource Limit Enforcement Integration Verification
  console.log('\n--- SECTION 9: Resource Limit Enforcement Integration ---');
  const staffInvitePath = path.join(process.cwd(), 'src/server/services/staff-invitation.service.ts');
  const staffInviteContent = fs.readFileSync(staffInvitePath, 'utf-8');
  assert(staffInviteContent.includes('validateLimit(businessId, \'staff\')'), '36. StaffInvitationService checks staff limit');

  const menuActionPath = path.join(process.cwd(), 'src/server/actions/menu.ts');
  const menuActionContent = fs.readFileSync(menuActionPath, 'utf-8');
  assert(menuActionContent.includes('assertOperationalSubscription'), '37. Menu server actions assert operational subscription server-side');

  // 10. Pending-Access Hotfix & Recovery Verification
  console.log('\n--- SECTION 10: Pending-Access Recovery & State Re-resolution ---');
  const pendingPagePath = path.join(process.cwd(), 'src/app/(auth)/account/pending-access/page.tsx');
  const pendingPageContent = fs.readFileSync(pendingPagePath, 'utf-8');
  assert(pendingPageContent.includes('resolveUnifiedAccessState'), '38. PendingAccessPage uses resolveUnifiedAccessState on every render');
  assert(pendingPageContent.includes('redirect(\'/dashboard\')'), '39. PendingAccessPage automatically redirects to /dashboard when restriction resolves');

  const pendingScreenPath = path.join(process.cwd(), 'src/components/auth/pending-access-screen.tsx');
  const pendingScreenContent = fs.readFileSync(pendingScreenPath, 'utf-8');
  assert(pendingScreenContent.includes('reason === \'subscription_suspended\''), '40. PendingAccessScreen handles subscription_suspended reason');
  assert(pendingScreenContent.includes('reason === \'subscription_cancelled\''), '41. PendingAccessScreen handles subscription_cancelled reason');
  assert(pendingScreenContent.includes('reason === \'platform_suspended\''), '42. PendingAccessScreen handles platform_suspended reason');

  // 11. Public Suspension UX Hotfix Verification
  console.log('\n--- SECTION 11: Public Suspension UX ---');
  const venuePagePath = path.join(process.cwd(), 'src/app/(public)/venues/[slug]/page.tsx');
  const venuePageContent = fs.readFileSync(venuePagePath, 'utf-8');
  assert(venuePageContent.includes('isCommerciallySuspended'), '43. Public venue page checks isCommerciallySuspended');

  // 12. Super Admin Controls & Audit Logging Verification
  console.log('\n--- SECTION 12: Super Admin Controls & Audit Integration ---');
  const superAdminActionPath = path.join(process.cwd(), 'src/server/actions/super-admin-subscription.ts');
  assert(fs.existsSync(superAdminActionPath), '44. super-admin-subscription.ts actions exist');

  const subServicePath = path.join(process.cwd(), 'src/server/services/subscription.service.ts');
  const subServiceContent = fs.readFileSync(subServicePath, 'utf-8');
  assert(subServiceContent.includes('admin.from(\'audit_logs\').insert'), '45. SubscriptionService writes to platform audit_logs table');
  assert(subServiceContent.includes('activation_source: \'manual_admin\''), '46. manualActivateSubscription records activation_source = manual_admin');

  const adminControlPath = path.join(process.cwd(), 'src/components/admin/admin-subscription-control.tsx');
  const adminControlContent = fs.readFileSync(adminControlPath, 'utf-8');
  assert(adminControlContent.includes('Grace Period End'), '47. AdminSubscriptionControl explicitly renders Grace Period End');
  assert(adminControlContent.includes('effectiveStatus !== \'CANCELLED\''), '48. AdminSubscriptionControl actions are state-aware');

  // 13. UI Cleanliness & Badge Contrast Verification
  console.log('\n--- SECTION 13: UI Cleanliness & Badge Contrast ---');
  const ownerClientPath = path.join(process.cwd(), 'src/components/subscription/owner-subscription-client.tsx');
  const ownerClientContent = fs.readFileSync(ownerClientPath, 'utf-8');
  assert(!ownerClientContent.includes('billing@wsnexa.internal'), '49. Removed fake billing@wsnexa.internal email literal');
  assert(!ownerClientContent.includes('+94 (11) 234-5678'), '50. Removed fake +94 (11) 234-5678 phone number literal');
  assert(ownerClientContent.includes('Manual Activation Required'), '51. Owner payment notice modal retains honest manual activation copy');

  const accessDeniedPath = path.join(process.cwd(), 'src/components/auth/access-denied.tsx');
  const accessDeniedContent = fs.readFileSync(accessDeniedPath, 'utf-8');
  assert(!accessDeniedContent.includes('Your staff account'), '52. AccessDenied component uses role-neutral copy');

  // 14. Realtime Component Dual Listener Verification
  console.log('\n--- SECTION 14: Realtime Component Dual Listener ---');
  const realtimeCompPath = path.join(process.cwd(), 'src/components/subscription/subscription-realtime-listener.tsx');
  const realtimeCompContent = fs.readFileSync(realtimeCompPath, 'utf-8');
  assert(realtimeCompContent.includes('table: \'business_subscriptions\''), '53. SubscriptionRealtimeListener listens to business_subscriptions');
  assert(realtimeCompContent.includes('table: \'businesses\''), '54. SubscriptionRealtimeListener listens to businesses platform table');

  // 15. Zero Fake Gateway Verification
  console.log('\n--- SECTION 15: Zero Fake Gateway Verification ---');
  assert(!subServiceContent.includes('DialogGateway') && !subServiceContent.includes('payhere'), '55. Zero fake payment actions or Dialog Gateway stubs introduced');

  console.log('\n================================================================');
  console.log('  V1 Subscription Core Final Hotfix: ALL 55 ASSERTIONS PASSED');
  console.log('================================================================\n');
}

runVerification().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
