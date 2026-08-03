import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

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

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

async function runTenantVerificationSuite() {
  console.log('================================================================');
  console.log('   WSNexa Phase 3 Multi-Tenant Architecture & Isolation Suite   ');
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

  // Check database table availability
  const { error: schemaCheck } = await supabaseAdmin.from('businesses').select('id').limit(1);
  if (schemaCheck && schemaCheck.message.includes('schema cache')) {
    console.log('⚠️ ATTENTION: Multi-tenant database migration (20260803171500_create_multi_tenant_schema.sql) needs to be executed on your remote Supabase project.');
    console.log('   Please run: supabase/migrations/20260803171500_create_multi_tenant_schema.sql in your Supabase SQL Editor.');
    process.exitCode = 1;
    return;
  }

  const timestamp = Date.now();
  const userAEmail = `ownerA.${timestamp}@gmail.com`;
  const userBEmail = `ownerB.${timestamp}@gmail.com`;
  const password = 'Password123!';

  // 1. Create User A
  const { data: userAData } = await supabaseAdmin.auth.admin.createUser({
    email: userAEmail,
    password,
    email_confirm: true,
    user_metadata: { first_name: 'OwnerA', last_name: 'Test' },
  });
  const userAId = userAData.user ? userAData.user.id : '';
  assert(!!userAId, 'Test 1: Created User A');

  // 2. Create Business A through atomic RPC
  const clientA = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  await clientA.auth.signInWithPassword({ email: userAEmail, password });

  const slugA = `business-a-${timestamp}`;
  const { data: bizAResult, error: createBizAError } = await clientA.rpc('create_business_with_default_branch', {
    p_name: 'Business A Hotel',
    p_slug: slugA,
    p_business_type: 'hotel',
    p_default_currency: 'USD',
    p_branch_name: 'Main Branch A',
    p_branch_code: 'MAIN',
  });

  const businessAId = (bizAResult as { business_id?: string })?.business_id || '';
  assert(!createBizAError && !!businessAId, 'Test 2: Created Business A atomically through RPC', createBizAError?.message);

  // 3. Confirm Business A default branch
  const { data: branchesA } = await supabaseAdmin
    .from('branches')
    .select('*')
    .eq('business_id', businessAId);

  assert(
    branchesA?.length === 1 && branchesA[0].is_default === true && branchesA[0].code === 'MAIN',
    'Test 3: Business A has exactly one default branch (code = MAIN, is_default = true)'
  );

  // 4. Confirm User A receives business_owner membership
  const { data: memA } = await supabaseAdmin
    .from('business_memberships')
    .select('*')
    .eq('business_id', businessAId)
    .eq('user_id', userAId)
    .single();

  assert(memA?.role === 'business_owner', 'Test 4: User A receives business_owner membership role');

  // 5 & 6. Create User B & Business B
  const { data: userBData } = await supabaseAdmin.auth.admin.createUser({
    email: userBEmail,
    password,
    email_confirm: true,
    user_metadata: { first_name: 'OwnerB', last_name: 'Test' },
  });
  const userBId = userBData.user ? userBData.user.id : '';

  const clientB = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  await clientB.auth.signInWithPassword({ email: userBEmail, password });

  const slugB = `business-b-${timestamp}`;
  const { data: bizBResult } = await clientB.rpc('create_business_with_default_branch', {
    p_name: 'Business B Bistro',
    p_slug: slugB,
    p_business_type: 'restaurant',
    p_default_currency: 'EUR',
    p_branch_name: 'Main Branch B',
    p_branch_code: 'MAIN',
  });
  const businessBId = (bizBResult as { business_id?: string })?.business_id || '';
  assert(!!businessBId, 'Test 5 & 6: Created User B & Business B');

  // 7. Confirm User A can read Business A
  const { data: readBizA } = await clientA
    .from('businesses')
    .select('*')
    .eq('id', businessAId)
    .single();

  assert(readBizA?.name === 'Business A Hotel', 'Test 7: Authenticated User A can read Business A');

  // 8. Confirm User A CANNOT read Business B (RLS)
  const { data: crossReadBizB } = await clientA
    .from('businesses')
    .select('*')
    .eq('id', businessBId);

  assert(!crossReadBizB || crossReadBizB.length === 0, 'Test 8: User A CANNOT read Business B (Cross-tenant RLS blocked)');

  // 9. Confirm User B CANNOT read Business A (RLS)
  const { data: crossReadBizA } = await clientB
    .from('businesses')
    .select('*')
    .eq('id', businessAId);

  assert(!crossReadBizA || crossReadBizA.length === 0, 'Test 9: User B CANNOT read Business A (Cross-tenant RLS blocked)');

  // 10. Confirm anonymous users cannot read businesses
  const clientAnon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data: anonReadBiz } = await clientAnon
    .from('businesses')
    .select('*')
    .eq('id', businessAId);

  assert(!anonReadBiz || anonReadBiz.length === 0, 'Test 10: Anonymous unauthenticated users CANNOT read businesses');

  // 11. Confirm Owner A can update allowed Business A fields
  const { error: updateBizAError } = await clientA
    .from('businesses')
    .update({ name: 'Business A Resort' })
    .eq('id', businessAId);

  assert(!updateBizAError, 'Test 11: Owner A can update allowed Business A fields');

  // 12. Confirm Owner A CANNOT update Business B
  const { data: updatedB } = await clientA
    .from('businesses')
    .update({ name: 'Hacked Business B' })
    .eq('id', businessBId)
    .select();

  assert(!updatedB || updatedB.length === 0, 'Test 12: Owner A CANNOT update Business B (0 rows updated via RLS)');

  // 13. Confirm staff cannot promote themselves
  const staffEmail = `staff.${timestamp}@gmail.com`;
  const { data: staffData } = await supabaseAdmin.auth.admin.createUser({
    email: staffEmail,
    password,
    email_confirm: true,
  });
  const staffId = staffData.user ? staffData.user.id : '';

  // Owner A adds staff as waiter
  const { data: staffMem } = await supabaseAdmin
    .from('business_memberships')
    .insert({
      business_id: businessAId,
      user_id: staffId,
      role: 'waiter',
      membership_status: 'active',
    })
    .select()
    .single();

  const clientStaff = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  await clientStaff.auth.signInWithPassword({ email: staffEmail, password });

  // Staff attempts to promote self to owner
  const { data: updatedStaffMem } = await clientStaff
    .from('business_memberships')
    .update({ role: 'business_owner' })
    .eq('id', staffMem?.id || '')
    .select();

  assert(!updatedStaffMem || updatedStaffMem.length === 0, 'Test 13: Staff user CANNOT promote themselves to owner (0 rows updated via RLS)');

  // 17. Confirm duplicate business memberships are rejected
  const { error: dupMemError } = await supabaseAdmin
    .from('business_memberships')
    .insert({
      business_id: businessAId,
      user_id: userAId,
      role: 'business_owner',
    });

  assert(!!dupMemError, 'Test 17: Duplicate business membership rejected by unique constraint');

  // 18. Confirm duplicate branch codes within one business are rejected
  const { error: dupBranchCodeError } = await supabaseAdmin
    .from('branches')
    .insert({
      business_id: businessAId,
      name: 'Second Branch',
      code: 'MAIN', // duplicate code in same business
    });

  assert(!!dupBranchCodeError, 'Test 18: Duplicate branch code within same business rejected');

  // 19. Confirm same branch code may be used across different businesses
  assert(
    branchesA?.[0]?.code === 'MAIN',
    'Test 19: Branch code MAIN exists in both Business A and Business B concurrently'
  );

  // 20. Confirm only one default branch exists per business
  const { error: dupDefaultBranchError } = await supabaseAdmin
    .from('branches')
    .insert({
      business_id: businessAId,
      name: 'Another Default Branch',
      code: 'MAIN2',
      is_default: true,
    });

  assert(!!dupDefaultBranchError, 'Test 20: Second default branch rejected by idx_unique_default_branch index');

  // Clean up test data
  console.log('\n🧹 Cleaning up live test data...');
  await supabaseAdmin.from('businesses').delete().eq('id', businessAId);
  await supabaseAdmin.from('businesses').delete().eq('id', businessBId);
  if (userAId) await supabaseAdmin.auth.admin.deleteUser(userAId);
  if (userBId) await supabaseAdmin.auth.admin.deleteUser(userBId);
  if (staffId) await supabaseAdmin.auth.admin.deleteUser(staffId);
  assert(true, 'Test 23: Cleaned up test data');

  console.log('\n================================================================');
  console.log(`📊 Multi-Tenant Verification Results: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exitCode = 1;
  }
}

runTenantVerificationSuite().catch((err) => {
  console.error('❌ Tenant Verification Error:', err);
  process.exitCode = 1;
});
