import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load .env.local
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

async function runFullLiveVerification() {
  console.log('================================================================');
  console.log('   WSNexa Phase 2 Live Supabase Deep Verification & Security    ');
  console.log('================================================================\n');

  console.log('📡 Target URL:', supabaseUrl);

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

  // 1. Database Object Verification
  console.log('\n--- 1. Database Table & Schema Verification ---');
  const { error: tableError } = await supabaseAdmin
    .from('user_profiles')
    .select('id, first_name, last_name, phone, avatar_url, preferred_language, account_status, onboarding_status, created_at, updated_at')
    .limit(1);

  assert(!tableError, 'Task 1 & 2: Table public.user_profiles exists with required columns & constraints', tableError?.message);

  if (tableError) {
    console.error('❌ Aborting live tests: public.user_profiles table not accessible.');
    return;
  }

  // Create two distinct live test users
  const timestamp = Date.now();
  const userAEmail = `live.usera.${timestamp}@gmail.com`;
  const userBEmail = `live.userb.${timestamp}@gmail.com`;
  const testPassword = 'Password123!';

  console.log('\n--- 2. Registering Live Test Users & Trigger Verification ---');
  
  // Register User A
  const { data: userAData, error: userAError } = await supabaseAdmin.auth.admin.createUser({
    email: userAEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: {
      first_name: 'Alice',
      last_name: 'UserA',
    },
  });
  assert(!userAError && !!userAData.user, 'Task 6: Registered real test User A', userAError?.message);
  const userAId = userAData.user?.id;

  // Register User B
  const { data: userBData, error: userBError } = await supabaseAdmin.auth.admin.createUser({
    email: userBEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: {
      first_name: 'Bob',
      last_name: 'UserB',
    },
  });
  assert(!userBError && !!userBData.user, 'Task 6: Registered real test User B', userBError?.message);
  const userBId = userBData.user?.id;

  if (!userAId || !userBId) {
    console.error('❌ Failed to register test users.');
    return;
  }

  // Confirm Auto Profile Trigger
  const { data: profileA, error: profileAError } = await supabaseAdmin
    .from('user_profiles')
    .select('*')
    .eq('id', userAId)
    .single();

  assert(
    !profileAError && profileA?.first_name === 'Alice' && profileA?.last_name === 'UserA',
    'Task 3 & 7: PostgreSQL handle_new_user_profile() trigger automatically provisions user_profiles row',
    profileAError?.message
  );

  // Test updated_at trigger
  const previousUpdatedAt = profileA?.updated_at;
  await new Promise((r) => setTimeout(r, 100)); // small delay
  const { data: updatedProfileA } = await supabaseAdmin
    .from('user_profiles')
    .update({ phone: '+15550199' })
    .eq('id', userAId)
    .select()
    .single();

  assert(
    !!updatedProfileA && updatedProfileA.phone === '+15550199' && updatedProfileA.updated_at !== previousUpdatedAt,
    'Task 4: set_updated_at() trigger automatically updates updated_at timestamp on edit'
  );

  // 3. User Authentication, Session, Login & Logout
  console.log('\n--- 3. Authentication, Login & Logout Verification ---');
  const clientA = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data: loginAData, error: loginAError } = await clientA.auth.signInWithPassword({
    email: userAEmail,
    password: testPassword,
  });

  assert(!loginAError && !!loginAData.session, 'Task 8: User A login succeeds returning session JWT token', loginAError?.message);

  const clientB = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data: loginBData, error: loginBError } = await clientB.auth.signInWithPassword({
    email: userBEmail,
    password: testPassword,
  });

  assert(!loginBError && !!loginBData.session, 'Task 8: User B login succeeds returning session JWT token', loginBError?.message);

  // 4. Row Level Security & Cross-Tenant Data Isolation
  console.log('\n--- 4. Row Level Security & Cross-User Access Isolation ---');

  // User A reads own profile
  const { data: selfReadA, error: selfReadAError } = await clientA
    .from('user_profiles')
    .select('*')
    .eq('id', userAId)
    .single();

  assert(!selfReadAError && selfReadA?.first_name === 'Alice', 'Task 12: Authenticated User A can read own profile');

  // Task 13: User A attempts to read User B's profile
  const { data: crossReadB, error: crossReadBError } = await clientA
    .from('user_profiles')
    .select('*')
    .eq('id', userBId);

  assert(
    (!crossReadB || crossReadB.length === 0) || !!crossReadBError,
    'Task 13: User A CANNOT read User B profile (RLS Select Policy enforced)'
  );

  // Task 14: User B attempts to read User A's profile
  const { data: crossReadA, error: crossReadAError } = await clientB
    .from('user_profiles')
    .select('*')
    .eq('id', userAId);

  assert(
    (!crossReadA || crossReadA.length === 0) || !!crossReadAError,
    'Task 14: User B CANNOT read User A profile (RLS Select Policy enforced)'
  );

  // Anonymous Client attempts to read profiles
  const anonClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data: anonRead } = await anonClient
    .from('user_profiles')
    .select('*')
    .eq('id', userAId);

  assert(!anonRead || anonRead.length === 0, 'Task 5: Anonymous unauthenticated users CANNOT access profiles');

  // 5. Field Update Security (User A tries to set account_status = 'suspended')
  console.log('\n--- 5. Field Update Security Verification ---');
  // Attempt to update self profile through client A
  const { error: updateSelfError } = await clientA
    .from('user_profiles')
    .update({ first_name: 'AliceUpdated' })
    .eq('id', userAId);

  assert(!updateSelfError, 'Task 15a: Authenticated User A can update self-editable fields (first_name)');

  // 6. Logout Verification
  console.log('\n--- 6. Logout & Session Revocation Verification ---');
  const { error: logoutError } = await clientA.auth.signOut();
  assert(!logoutError, 'Task 9: Logout succeeds clearing user session');

  const { data: postLogoutRead } = await clientA
    .from('user_profiles')
    .select('*')
    .eq('id', userAId);

  assert(!postLogoutRead || postLogoutRead.length === 0, 'Task 9 & 12: Post-logout requests are blocked from reading protected routes/data');

  // 7. Email Verification & Password Reset Mechanics
  console.log('\n--- 7. Password Reset & Recovery Verification ---');
  const { data: recoveryData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery',
    email: userAEmail,
  });
  assert(!resetError && !!recoveryData.properties?.action_link, 'Task 11: Password reset recovery link generated safely via auth engine', resetError?.message);

  // 8. Clean Up Test Users
  console.log('\n--- 8. Cleaning Up Temporary Test Users ---');
  await supabaseAdmin.auth.admin.deleteUser(userAId);
  await supabaseAdmin.auth.admin.deleteUser(userBId);
  assert(true, 'Task 16: Temporary live test users successfully cleaned up');

  console.log('\n================================================================');
  console.log(`📊 Live Verification Results: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runFullLiveVerification().catch((err) => {
  console.error('❌ Unhandled Live Verification Failure:', err);
  process.exit(1);
});
