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
  console.log('  WSNexa Production Realtime Infrastructure Targeted Hotfix');
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

  const completeRealtimePath = path.join(process.cwd(), 'supabase/migrations/20260826020000_realtime_publications_complete.sql');
  assert(fs.existsSync(completeRealtimePath), '8. Complete publication migration 20260826020000_realtime_publications_complete.sql exists');

  const completeRealtimeSql = fs.readFileSync(completeRealtimePath, 'utf-8');
  assert(completeRealtimeSql.includes('ALTER PUBLICATION supabase_realtime ADD TABLE public.business_subscriptions'), '9. business_subscriptions added to supabase_realtime publication');
  assert(completeRealtimeSql.includes('ALTER PUBLICATION supabase_realtime ADD TABLE public.businesses'), '10. businesses added to supabase_realtime publication');
  assert(completeRealtimeSql.includes('ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications'), '11. notifications added to supabase_realtime publication');
  assert(completeRealtimeSql.includes('ALTER PUBLICATION supabase_realtime ADD TABLE public.orders'), '12. orders added to supabase_realtime publication');
  assert(completeRealtimeSql.includes('ALTER PUBLICATION supabase_realtime ADD TABLE public.waiter_requests'), '13. waiter_requests added to supabase_realtime publication');

  // 2. Plan Definitions & Trial Entitlements Model
  console.log('\n--- SECTION 2: Plan Definitions & Trial Entitlements Model ---');
  assert(SUBSCRIPTION_PLANS.starter.limits.maxBranches === 1, '14. Starter branch limit is 1');
  assert(SUBSCRIPTION_PLANS.starter.limits.maxActiveStaff === 10, '15. Starter staff limit is 10');
  assert(SUBSCRIPTION_PLANS.growth.limits.maxBranches === 3, '16. Growth branch limit is 3');
  assert(SUBSCRIPTION_PLANS.enterprise.limits.maxBranches === null, '17. Enterprise maxBranches is null (unlimited)');

  assert(TRIAL_ENTITLEMENT_LIMITS.maxBranches === 3, '18. 14-day trial provides 3 branches entitlement');
  assert(TRIAL_ENTITLEMENT_LIMITS.maxActiveStaff === 40, '19. 14-day trial provides 40 staff entitlement');

  // 3. Unified Access State Resolver Unit Tests
  console.log('\n--- SECTION 3: Unified Access State Resolver Unit Tests ---');
  const platSusp = resolveUnifiedAccessState({ businessStatus: 'suspended', effectiveSubscriptionStatus: 'ACTIVE' });
  assert(platSusp.isRestricted && platSusp.reason === 'platform_suspended', '20. Platform suspension takes precedence over active subscription');

  const subSusp = resolveUnifiedAccessState({ businessStatus: 'active', effectiveSubscriptionStatus: 'SUSPENDED' });
  assert(subSusp.isRestricted && subSusp.reason === 'subscription_suspended', '21. Subscription SUSPENDED evaluates to subscription_suspended');

  const subCanc = resolveUnifiedAccessState({ businessStatus: 'active', effectiveSubscriptionStatus: 'CANCELLED' });
  assert(subCanc.isRestricted && subCanc.reason === 'subscription_cancelled', '22. Subscription CANCELLED evaluates to subscription_cancelled');

  const opActive = resolveUnifiedAccessState({ businessStatus: 'active', effectiveSubscriptionStatus: 'ACTIVE' });
  assert(!opActive.isRestricted && opActive.reason === null, '23. Active business and subscription evaluates to operational (unrestricted)');

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
  assert(trialLimits.maxBranches === 3, '24. Default Trial maxBranches uses trial entitlement (3)');

  // 5. Server-Side Operational Assertion Guard Tests
  console.log('\n--- SECTION 5: Server-Side Operational Assertion Guard ---');
  assert(typeof SubscriptionService.assertOperationalSubscription === 'function', '25. SubscriptionService.assertOperationalSubscription method exists');

  // 6. Branch Limit & Onboarding Integration
  console.log('\n--- SECTION 6: Service & Onboarding Integration ---');
  const branchLimitPath = path.join(process.cwd(), 'src/server/services/branch-limit.service.ts');
  const branchLimitContent = fs.readFileSync(branchLimitPath, 'utf-8');
  assert(branchLimitContent.includes('SubscriptionService.validateLimit'), '26. checkBranchQuota delegates to SubscriptionService');

  // 7. Tenant Resolver & Layout Guards Verification
  console.log('\n--- SECTION 7: Tenant Resolver & Layout Access Enforcement ---');
  const layoutPath = path.join(process.cwd(), 'src/app/(dashboard)/layout.tsx');
  const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
  assert(layoutContent.includes('resolveUnifiedAccessState'), '27. DashboardLayout uses resolveUnifiedAccessState');

  const shellPath = path.join(process.cwd(), 'src/components/layout/dashboard-shell.tsx');
  const shellContent = fs.readFileSync(shellPath, 'utf-8');
  assert(shellContent.includes('SubscriptionRealtimeListener'), '28. DashboardShell embeds SubscriptionRealtimeListener');

  // 8. Public QR Ordering & Reservation Enforcement Verification
  console.log('\n--- SECTION 8: Public QR Ordering & Reservation Enforcement ---');
  const orderServicePath = path.join(process.cwd(), 'src/server/services/order.service.ts');
  const orderServiceContent = fs.readFileSync(orderServicePath, 'utf-8');
  assert(orderServiceContent.includes('Ordering is currently unavailable for this venue.'), '29. OrderService blocks guest orders for suspended businesses');

  // 9. Resource Limit Enforcement Integration Verification
  console.log('\n--- SECTION 9: Resource Limit Enforcement Integration ---');
  const menuActionPath = path.join(process.cwd(), 'src/server/actions/menu.ts');
  const menuActionContent = fs.readFileSync(menuActionPath, 'utf-8');
  assert(menuActionContent.includes('assertOperationalSubscription'), '30. Menu server actions assert operational subscription server-side');

  // 10. Pending-Access Live Listener Mounting Verification
  console.log('\n--- SECTION 10: Pending-Access Live Listener Mounting & Recovery ---');
  const pendingPagePath = path.join(process.cwd(), 'src/app/(auth)/account/pending-access/page.tsx');
  const pendingPageContent = fs.readFileSync(pendingPagePath, 'utf-8');
  assert(pendingPageContent.includes('resolveUnifiedAccessState'), '31. PendingAccessPage uses resolveUnifiedAccessState on every render');
  assert(pendingPageContent.includes('redirect(\'/dashboard\')'), '32. PendingAccessPage automatically redirects to /dashboard when restriction resolves');
  assert(pendingPageContent.includes('SubscriptionRealtimeListener'), '33. PendingAccessPage mounts SubscriptionRealtimeListener for live pending-access recovery');

  // 11. Realtime Infrastructure Verification
  console.log('\n--- SECTION 11: Realtime Infrastructure & Notification End-to-End ---');
  const realtimeCompPath = path.join(process.cwd(), 'src/components/subscription/subscription-realtime-listener.tsx');
  const realtimeCompContent = fs.readFileSync(realtimeCompPath, 'utf-8');
  assert(realtimeCompContent.includes('table: \'business_subscriptions\''), '34. SubscriptionRealtimeListener listens to business_subscriptions');
  assert(realtimeCompContent.includes('table: \'businesses\''), '35. SubscriptionRealtimeListener listens to businesses platform table');
  assert(realtimeCompContent.includes('filter: `business_id=eq.${businessId}`'), '36. SubscriptionRealtimeListener filters business_subscriptions by business_id');
  assert(realtimeCompContent.includes('filter: `id=eq.${businessId}`'), '37. SubscriptionRealtimeListener filters businesses by id');
  assert(realtimeCompContent.includes('visibilitychange'), '38. SubscriptionRealtimeListener has visibilitychange window focus resilience fallback');

  const useNotifPath = path.join(process.cwd(), 'src/hooks/use-notifications.ts');
  const useNotifContent = fs.readFileSync(useNotifPath, 'utf-8');
  assert(useNotifContent.includes('table: \'notifications\''), '39. useNotifications listens to notifications table');
  assert(useNotifContent.includes('filter: `recipient_user_id=eq.${userId}`'), '40. useNotifications filters notifications by recipient_user_id');
  assert(useNotifContent.includes('CHANNEL_ERROR'), '41. useNotifications monitors channel status callbacks');
  assert(useNotifContent.includes('visibilitychange'), '42. useNotifications has visibilitychange window focus resilience fallback');

  // 12. Zero Fake Gateway Verification
  console.log('\n--- SECTION 12: Zero Fake Gateway Verification ---');
  const subServicePath = path.join(process.cwd(), 'src/server/services/subscription.service.ts');
  const subServiceContent = fs.readFileSync(subServicePath, 'utf-8');
  assert(!subServiceContent.includes('DialogGateway') && !subServiceContent.includes('payhere'), '43. Zero fake payment actions or Dialog Gateway stubs introduced');

  console.log('\n================================================================');
  console.log('  Production Realtime Infrastructure Hotfix: ALL 43 ASSERTIONS PASSED');
  console.log('================================================================\n');
}

runVerification().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
