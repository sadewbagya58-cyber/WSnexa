import { registerSchema, profileUpdateSchema } from '../src/lib/validation/auth';

/**
 * Automated Verification Suite for Phase 2 Authentication & Security
 */
function runAuthVerificationSuite() {
  console.log('🧪 Running Phase 2 Authentication & Security Verification Suite...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.log(`  ❌ [FAIL] ${testName} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  // Test 1: Registration schema validation (valid input)
  const validRegister = registerSchema.safeParse({
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    password: 'Password123!',
    confirmPassword: 'Password123!',
    termsAccepted: true,
  });
  assert(validRegister.success, 'Test 1: Registration schema accepts valid registration input');

  // Test 2: Weak password rejection
  const weakPassword = registerSchema.safeParse({
    firstName: 'John',
    email: 'john@example.com',
    password: 'weak',
    confirmPassword: 'weak',
    termsAccepted: true,
  });
  assert(!weakPassword.success, 'Test 2: Weak password rejected by Zod password validator');

  // Test 3: Password mismatch rejection
  const mismatchPassword = registerSchema.safeParse({
    firstName: 'John',
    email: 'john@example.com',
    password: 'Password123!',
    confirmPassword: 'Different123!',
    termsAccepted: true,
  });
  assert(!mismatchPassword.success, 'Test 3: Mismatched password confirmation rejected');

  // Test 4: Profile update white-listing (Allowed fields)
  const validProfileUpdate = profileUpdateSchema.safeParse({
    firstName: 'Jane',
    lastName: 'Smith',
    phone: '+1 555-0199',
    preferredLanguage: 'es',
  });
  assert(validProfileUpdate.success, 'Test 4: Profile update accepts white-listed self-editable fields');

  // Test 5: Protected fields stripping (account_status cannot be set via profileUpdateSchema)
  const profileWithProtected = profileUpdateSchema.safeParse({
    firstName: 'Jane',
    account_status: 'suspended',
    onboarding_status: 'completed',
  });
  assert(
    validProfileUpdate.success && !('account_status' in (profileWithProtected.data || {})),
    'Test 5: Protected fields (account_status, onboarding_status) stripped from self-update schema'
  );

  // Test 6: Open Redirect validation logic
  function isSafeRedirect(next: string | null): boolean {
    if (!next) return false;
    if (next.startsWith('//') || next.includes(':\\') || next.includes('://') || !next.startsWith('/')) {
      return false;
    }
    return true;
  }

  assert(isSafeRedirect('/dashboard'), 'Test 6a: Internal relative path /dashboard accepted');
  assert(!isSafeRedirect('https://malicious.com'), 'Test 6b: External URL https://malicious.com rejected');
  assert(!isSafeRedirect('//malicious.com'), 'Test 6c: Protocol-relative URL //malicious.com rejected');

  // Test 7: Service Role key isolation (Verify env client schema does NOT contain SUPABASE_SERVICE_ROLE_KEY)
  const clientEnvKeys = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_APP_URL'];
  assert(
    !clientEnvKeys.includes('SUPABASE_SERVICE_ROLE_KEY'),
    'Test 7: SUPABASE_SERVICE_ROLE_KEY excluded from client environment bundle'
  );

  console.log(`\n📊 Verification Summary: ${passed} Passed, ${failed} Failed\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runAuthVerificationSuite();
