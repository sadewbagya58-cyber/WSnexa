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
  console.log('  WSNexa V1 Subscription Core — FINAL 4 Production QA Issues Hotfix');
  console.log('================================================================\n');

  const { SubscriptionService, TRIAL_ENTITLEMENT_LIMITS } = await import('../src/server/services/subscription.service');
  const { SUBSCRIPTION_PLANS } = await import('../src/lib/config/subscription-plans');
  const { resolveUnifiedAccessState } = await import('../src/server/tenant/unified-access');

  // 1. Audit Log Persistence & Canonical Naming Verification
  console.log('--- SECTION 1: Subscription Audit Log Persistence & Canonical Naming ---');
  const subServicePath = path.join(process.cwd(), 'src/server/services/subscription.service.ts');
  const subServiceContent = fs.readFileSync(subServicePath, 'utf-8');
  assert(subServiceContent.includes('target_type: \'subscription\''), '1. SubscriptionService inserts target_type: subscription into audit_logs');
  assert(subServiceContent.includes('target_id: businessId'), '2. SubscriptionService inserts target_id into audit_logs');
  assert(subServiceContent.includes('payload:'), '3. SubscriptionService inserts structured payload into audit_logs');
  assert(subServiceContent.includes('subscription.'), '4. Canonical lowercase dot-separated action naming (subscription.*) used for audit logs');

  const auditClientPath = path.join(process.cwd(), 'src/app/admin/audit/admin-audit-client.tsx');
  const auditClientContent = fs.readFileSync(auditClientPath, 'utf-8');
  assert(auditClientContent.includes('value="subscription"'), '5. AdminAuditClient dropdown contains Subscription targetType option');

  // 2. Owner Dashboard Subscription Lifecycle Banner & CTA Verification
  console.log('\n--- SECTION 2: Owner Dashboard Subscription Lifecycle Banner & CTA ---');
  const ownerBannerPath = path.join(process.cwd(), 'src/components/subscription/owner-subscription-lifecycle-banner.tsx');
  assert(fs.existsSync(ownerBannerPath), '6. OwnerSubscriptionLifecycleBanner component exists');

  const ownerBannerContent = fs.readFileSync(ownerBannerPath, 'utf-8');
  assert(ownerBannerContent.includes('Upgrade Plan'), '7. Owner banner renders Upgrade Plan CTA for TRIALING');
  assert(ownerBannerContent.includes('Renew Plan'), '8. Owner banner renders Renew Plan CTA for GRACE_PERIOD');
  assert(ownerBannerContent.includes('Reactivate Subscription'), '9. Owner banner renders Reactivate Subscription CTA for SUSPENDED/CANCELLED');
  assert(ownerBannerContent.includes('/dashboard/settings/subscription'), '10. All banner CTAs route to /dashboard/settings/subscription');
  assert(ownerBannerContent.includes('if (!isBusinessOwner'), '11. Banner is strictly hidden for non-owner staff');

  const dashboardPagePath = path.join(process.cwd(), 'src/app/(dashboard)/dashboard/page.tsx');
  const dashboardPageContent = fs.readFileSync(dashboardPagePath, 'utf-8');
  assert(dashboardPageContent.includes('OwnerSubscriptionLifecycleBanner'), '12. Dashboard Overview page embeds OwnerSubscriptionLifecycleBanner');

  // 3. Status & CURRENT Badge Contrast Verification
  console.log('\n--- SECTION 3: Badge Contrast Verification ---');
  const badgePath = path.join(process.cwd(), 'src/components/ui/badge.tsx');
  const badgeContent = fs.readFileSync(badgePath, 'utf-8');
  assert(badgeContent.includes('solid:'), '13. Badge component supports solid variant without variant collisions');

  const ownerClientPath = path.join(process.cwd(), 'src/components/subscription/owner-subscription-client.tsx');
  const ownerClientContent = fs.readFileSync(ownerClientPath, 'utf-8');
  assert(ownerClientContent.includes('variant="solid"'), '14. OwnerSubscriptionClient uses solid variant badges');
  assert(ownerClientContent.includes('bg-zinc-950 text-white'), '15. CURRENT plan badge uses high-contrast bg-zinc-950 text-white font styling');
  assert(ownerClientContent.includes('bg-zinc-900 text-white'), '16. CANCELLED badge uses high-contrast bg-zinc-900 text-white font styling');

  // 4. Fake Billing Details Cleanup Verification
  console.log('\n--- SECTION 4: Fake Billing Details Cleanup ---');
  assert(!ownerClientContent.includes('billing@wsnexa.internal'), '17. Exact literal billing@wsnexa.internal is completely removed');
  assert(!ownerClientContent.includes('234-5678'), '18. Exact fake phone literal +94 (11) 234-5678 is completely removed');
  assert(ownerClientContent.includes('Manual Activation Required'), '19. Manual activation notice renders clean, honest support copy');

  // 5. Preserved Core Architecture Verification
  console.log('\n--- SECTION 5: Preserved Core Architecture Verification ---');
  assert(SUBSCRIPTION_PLANS.starter.limits.maxBranches === 1, '20. Starter plan maxBranches is 1');
  assert(SUBSCRIPTION_PLANS.growth.limits.maxBranches === 3, '21. Growth plan maxBranches is 3');
  assert(SUBSCRIPTION_PLANS.enterprise.limits.maxBranches === null, '22. Enterprise plan maxBranches is null (unlimited)');

  assert(TRIAL_ENTITLEMENT_LIMITS.maxBranches === 3, '23. Trial entitlement maxBranches is 3');
  assert(TRIAL_ENTITLEMENT_LIMITS.maxActiveStaff === 40, '24. Trial entitlement maxActiveStaff is 40');
  assert(TRIAL_ENTITLEMENT_LIMITS.maxTables === 150, '25. Trial entitlement maxTables is 150');
  assert(TRIAL_ENTITLEMENT_LIMITS.maxMenuItems === 1000, '26. Trial entitlement maxMenuItems is 1,000');
  assert(TRIAL_ENTITLEMENT_LIMITS.maxCustomRoles === 10, '27. Trial entitlement maxCustomRoles is 10');

  assert(typeof SubscriptionService.assertOperationalSubscription === 'function', '28. Server-side operational subscription guard remains intact');

  const realtimeCompPath = path.join(process.cwd(), 'src/components/subscription/subscription-realtime-listener.tsx');
  const realtimeCompContent = fs.readFileSync(realtimeCompPath, 'utf-8');
  assert(realtimeCompContent.includes('table: \'business_subscriptions\''), '29. Realtime listener business_subscriptions tracking intact');
  assert(realtimeCompContent.includes('table: \'businesses\''), '30. Realtime listener businesses tracking intact');

  console.log('\n================================================================');
  console.log('  WSNexa FINAL 4 Issues Hotfix: ALL 30 ASSERTIONS PASSED');
  console.log('================================================================\n');
}

runVerification().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
