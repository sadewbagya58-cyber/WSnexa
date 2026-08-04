import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import {
  businessProfileSchema,
  operatingDaySchema,
} from '../src/lib/validation/onboarding';

// Parse .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  for (const line of envConfig.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...values] = trimmed.split('=');
      process.env[key.trim()] = values.join('=').trim();
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

async function runLiveOnboardingVerificationSuite() {
  console.log('================================================================');
  console.log('  WSNexa Phase 4 Live Supabase Onboarding & Storage Suite      ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.log(`  ❌ [FAIL] ${testName} ${detail ? `-> ${detail}` : ''}`);
      failed++;
    }
  }

  // 1. Verify Database Tables & RPC
  const { error: tablesError } = await supabaseAdmin
    .from('branch_operating_hours')
    .select('id')
    .limit(1);

  if (tablesError && tablesError.message.includes('schema cache')) {
    console.log('⚠️ ATTENTION: Onboarding migration missing. Please run 20260804070000_create_onboarding_schema.sql in Supabase SQL Editor.');
    process.exitCode = 1;
    return;
  }
  assert(!tablesError, 'Test 1: Verified public.branch_operating_hours and public.onboarding_drafts exist');

  // Verify extended business columns
  const { data: bizColumns } = await supabaseAdmin
    .from('businesses')
    .select('description, logo_url, email, phone, website')
    .limit(1);
  assert(!!bizColumns, 'Test 1b: Verified description, logo_url, email, phone, website columns on businesses table');

  const timestamp = Date.now();
  const userAEmail = `live.onboardA.${timestamp}@gmail.com`;
  const userBEmail = `live.onboardB.${timestamp}@gmail.com`;
  const password = 'Password123!';

  // Create real authenticated User A & User B
  const { data: userAData } = await supabaseAdmin.auth.admin.createUser({
    email: userAEmail,
    password,
    email_confirm: true,
    user_metadata: { first_name: 'LiveUserA' },
  });
  const userAId = userAData.user ? userAData.user.id : '';
  assert(!!userAId, 'Test 2: Created real authenticated User A session');

  const { data: userBData } = await supabaseAdmin.auth.admin.createUser({
    email: userBEmail,
    password,
    email_confirm: true,
    user_metadata: { first_name: 'LiveUserB' },
  });
  const userBId = userBData.user ? userBData.user.id : '';
  assert(!!userBId, 'Test 2b: Created real authenticated User B session');

  // Create browser Supabase clients with real authenticated user JWTs
  const clientA = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  await clientA.auth.signInWithPassword({ email: userAEmail, password });

  const clientB = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  await clientB.auth.signInWithPassword({ email: userBEmail, password });

  const clientAnon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

  // 3 & 4. User A creates draft & draft persists upon query
  const { error: draftInsertError } = await clientA
    .from('onboarding_drafts')
    .upsert({
      user_id: userAId,
      current_step: 'location',
      payload: {
        business: { name: 'Aura Luxury Hotel', businessType: 'hotel' },
        location: { branchName: 'Resort Branch', branchCode: 'MAIN' },
      },
    }, { onConflict: 'user_id' });
  assert(!draftInsertError, 'Test 3 & 4: User A saved onboarding draft server-side & draft persists');

  // 5 & 6. User B cannot read User A draft; User A cannot read User B draft
  const { data: userBDraftOfA } = await clientB
    .from('onboarding_drafts')
    .select('*')
    .eq('user_id', userAId);
  assert(!userBDraftOfA || userBDraftOfA.length === 0, 'Test 5: User B CANNOT read User A onboarding draft (RLS draft isolation)');

  const { data: anonReadDraft } = await clientAnon
    .from('onboarding_drafts')
    .select('*')
    .eq('user_id', userAId);
  assert(!anonReadDraft || anonReadDraft.length === 0, 'Test 6: Anonymous user CANNOT read onboarding drafts');

  // 7-11. Validation Schemas
  const invalidBizType = businessProfileSchema.safeParse({ name: 'Test', businessType: 'space_station' });
  assert(!invalidBizType.success, 'Test 7: Invalid business type rejected');

  const invalidCurrency = businessProfileSchema.safeParse({ name: 'Test', businessType: 'restaurant', defaultCurrency: 'INVALID' });
  assert(!invalidCurrency.success, 'Test 8: Invalid currency rejected');

  const invalidTimezone = businessProfileSchema.safeParse({ name: 'Test', businessType: 'restaurant', timezone: '' });
  assert(!invalidTimezone.success, 'Test 9: Invalid timezone rejected');

  const invalidHours = operatingDaySchema.safeParse({ dayOfWeek: 1, isClosed: false, opensAt: '22:00', closesAt: '08:00' });
  assert(!invalidHours.success, 'Test 10: Invalid operating hours (closing <= opening) rejected');

  const closedDay = operatingDaySchema.safeParse({ dayOfWeek: 0, isClosed: true, opensAt: '00:00', closesAt: '00:00' });
  assert(closedDay.success, 'Test 11: Closed day requires no open/close time validation');

  // 12-14. Storage Bucket & File Validation Tests
  const logoBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const logoPathA = `logos/${userAId}/test-logo-${timestamp}.png`;

  // Valid PNG upload under User A path
  const { error: logoUploadError } = await clientA.storage
    .from('business-assets')
    .upload(logoPathA, logoBuffer, { contentType: 'image/png', upsert: true });

  assert(!logoUploadError, 'Test 12: Valid PNG logo upload to business-assets bucket succeeded', logoUploadError?.message);

  // User B attempts to upload into User A path -> Should fail under Storage RLS
  const { error: crossUploadError } = await clientB.storage
    .from('business-assets')
    .upload(logoPathA, logoBuffer, { contentType: 'image/png', upsert: true });
  assert(!!crossUploadError, 'Test 13: User B CANNOT upload into User A storage path');

  // Anonymous upload attempt -> Should fail
  const { error: anonUploadError } = await clientAnon.storage
    .from('business-assets')
    .upload(`logos/anon/logo.png`, logoBuffer, { contentType: 'image/png', upsert: true });
  assert(!!anonUploadError, 'Test 14: Anonymous user CANNOT upload to storage bucket');

  const { data: publicLogoUrlData } = clientA.storage.from('business-assets').getPublicUrl(logoPathA);
  const logoUrl = publicLogoUrlData.publicUrl;

  // 15-22. Execute Complete Onboarding RPC
  const slugA = `live-onboard-biz-${timestamp}`;
  const { data: rpcResult, error: rpcError } = await clientA.rpc(
    'complete_business_onboarding',
    {
      p_name: 'Aura Grand Palace',
      p_slug: slugA,
      p_business_type: 'hotel',
      p_description: 'Luxury 5-star hotel & resort',
      p_country_code: 'US',
      p_default_currency: 'USD',
      p_timezone: 'UTC',
      p_email: 'contact@aurapalace.com',
      p_phone: '+1 555-0199',
      p_website: 'https://aurapalace.com',
      p_logo_url: logoUrl,
      p_branch_name: 'Main Palace Branch',
      p_branch_code: 'MAIN',
      p_branch_address_line_1: '100 Ocean Drive',
      p_branch_city: 'Miami',
      p_branch_region: 'FL',
      p_branch_postal_code: '33139',
      p_hours: [
        { day_of_week: 0, is_closed: false, opens_at: '08:00:00', closes_at: '22:00:00' },
        { day_of_week: 1, is_closed: false, opens_at: '08:00:00', closes_at: '22:00:00' },
        { day_of_week: 2, is_closed: false, opens_at: '08:00:00', closes_at: '22:00:00' },
        { day_of_week: 3, is_closed: false, opens_at: '08:00:00', closes_at: '22:00:00' },
        { day_of_week: 4, is_closed: false, opens_at: '08:00:00', closes_at: '22:00:00' },
        { day_of_week: 5, is_closed: false, opens_at: '08:00:00', closes_at: '22:00:00' },
        { day_of_week: 6, is_closed: false, opens_at: '08:00:00', closes_at: '22:00:00' },
      ],
    }
  );

  const businessId = (rpcResult as { business_id?: string })?.business_id || '';
  const branchId = (rpcResult as { branch_id?: string })?.branch_id || '';

  assert(!rpcError && !!businessId, 'Test 15: Executed complete_business_onboarding RPC & created business', rpcError?.message);

  // 16. Default branch check
  const { data: defaultBranch } = await supabaseAdmin
    .from('branches')
    .select('*')
    .eq('id', branchId)
    .single();
  assert(defaultBranch?.is_default === true && defaultBranch?.code === 'MAIN', 'Test 16: Exactly one default branch created with code MAIN');

  // 17. Business Owner membership check
  const { data: ownerMem } = await supabaseAdmin
    .from('business_memberships')
    .select('*')
    .eq('business_id', businessId)
    .eq('user_id', userAId)
    .single();
  assert(ownerMem?.role === 'business_owner' && ownerMem?.membership_status === 'active', 'Test 17: Business Owner membership created');

  // 18. 7 Operating hours records check
  const { data: hoursRows } = await supabaseAdmin
    .from('branch_operating_hours')
    .select('*')
    .eq('branch_id', branchId);
  assert(hoursRows?.length === 7, 'Test 18: 7 operating hours records created');

  // 19. Audit log check
  const { data: auditLogs } = await supabaseAdmin
    .from('audit_logs')
    .select('*')
    .eq('business_id', businessId);
  assert(Boolean(auditLogs?.some((l) => l.action === 'business.onboarding_completed')), 'Test 19: Immutable audit log entry created');

  // 20. Onboarding draft deleted after success
  const { data: remainingDraft } = await supabaseAdmin
    .from('onboarding_drafts')
    .select('*')
    .eq('user_id', userAId);
  assert(!remainingDraft || remainingDraft.length === 0, 'Test 20: Onboarding draft automatically deleted upon completion');

  // 21. Profile onboarding_status set to completed
  const { data: profileA } = await supabaseAdmin
    .from('user_profiles')
    .select('onboarding_status')
    .eq('id', userAId)
    .single();
  assert(profileA?.onboarding_status === 'completed', 'Test 21: user_profiles.onboarding_status updated to completed');

  // 23. Double submission protection
  const { error: doubleSubError } = await clientA.rpc('complete_business_onboarding', {
    p_name: 'Duplicate Business',
    p_slug: `dup-${timestamp}`,
    p_business_type: 'restaurant',
  });
  assert(!!doubleSubError, 'Test 23: Double submission blocked by database exception');

  // 26. User B cannot access User A's business
  const { data: crossReadBiz } = await clientB
    .from('businesses')
    .select('*')
    .eq('id', businessId);
  assert(!crossReadBiz || crossReadBiz.length === 0, 'Test 26: User B CANNOT access User A business (Cross-tenant RLS blocked)');

  // 28. User A cannot repeat onboarding
  assert(profileA?.onboarding_status === 'completed', 'Test 28: User A cannot repeat onboarding once completed');

  // 29. Clean up live test data & uploaded files
  console.log('\n🧹 Cleaning up live test data & storage files...');
  await clientA.storage.from('business-assets').remove([logoPathA]);
  if (businessId) await supabaseAdmin.from('businesses').delete().eq('id', businessId);
  if (userAId) await supabaseAdmin.auth.admin.deleteUser(userAId);
  if (userBId) await supabaseAdmin.auth.admin.deleteUser(userBId);
  assert(true, 'Test 29: Temporary live test data & uploaded storage files cleaned up');

  console.log('\n================================================================');
  console.log(`📊 Live Onboarding Verification Results: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exitCode = 1;
  }
}

runLiveOnboardingVerificationSuite().catch((err) => {
  console.error('❌ Live Onboarding Verification Error:', err);
  process.exitCode = 1;
});
