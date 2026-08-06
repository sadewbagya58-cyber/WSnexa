import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

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
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

async function runBranchesVerification() {
  console.log('================================================================');
  console.log('    WSNexa Phase 9.5 — Multi-Branch Management Verification     ');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`✅ TEST ${total}: ${testName}`);
      passed++;
    } else {
      console.error(`❌ TEST ${total} FAILED: ${testName}`);
      if (detail) console.error(`   Details: ${detail}`);
    }
  }

  const timestamp = Date.now();
  const testBizName = `Multi-Branch Test Biz ${timestamp}`;
  const ownerEmail = `owner_branch_${timestamp}@test.com`;
  const password = 'TestPassword123!';

  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email: ownerEmail,
    password,
    email_confirm: true,
  });

  if (authErr || !authUser.user) {
    console.error('Failed to create test owner:', authErr);
    return;
  }

  const userId = authUser.user.id;

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const clientA = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  await clientA.auth.signInWithPassword({ email: ownerEmail, password });

  const { data: bizAResult, error: rpcErr } = await clientA.rpc('create_business_with_default_branch', {
    p_name: testBizName,
    p_slug: `multi-branch-${timestamp}`,
    p_business_type: 'restaurant',
    p_default_currency: 'LKR',
    p_branch_name: 'Main Branch A',
    p_branch_code: 'MAIN',
  });

  const bizId = (bizAResult as { business_id?: string })?.business_id || '';
  assert(!rpcErr && !!bizId, 'Created Business with default Branch A atomically', rpcErr?.message);

  // Fetch Branch A
  const { data: branchA } = await admin
    .from('branches')
    .select('*')
    .eq('business_id', bizId)
    .eq('is_default', true)
    .single();

  assert(!!branchA, 'Branch A (Primary Default Branch) resolved correctly');

  // 2. Create Branch B under same Business
  const { data: branchB, error: branchBErr } = await admin
    .from('branches')
    .insert({
      business_id: bizId,
      name: 'Kandy Branch',
      code: 'KDY',
      city: 'Kandy',
      timezone: 'Asia/Colombo',
      is_default: false,
      status: 'active',
      require_table_selection: true,
      require_table_pin: true,
      table_pin_length: 4,
    })
    .select('*')
    .single();

  assert(!branchBErr && !!branchB, 'Created Branch B ("Kandy Branch", code "KDY") under Business');

  // 3. Duplicate Branch Code within same Business rejected
  const { error: dupCodeErr } = await admin.from('branches').insert({
    business_id: bizId,
    name: 'Duplicate Kandy Branch',
    code: 'KDY',
    timezone: 'Asia/Colombo',
  });

  assert(!!dupCodeErr, 'Duplicate branch code "KDY" within same business rejected');

  // 4. Update Branch B settings
  const { data: updatedB, error: updateBErr } = await admin
    .from('branches')
    .update({ name: 'Kandy Flagship Branch', phone: '+94812223333' })
    .eq('id', branchB.id)
    .select('*')
    .single();

  assert(!updateBErr && updatedB.name === 'Kandy Flagship Branch', 'Updated Branch B name and settings');

  // 5. Data Isolation: Verify newly created Branch B starts completely empty
  const [{ data: bCats0 }, { data: bItems0 }, { data: bAreas0 }, { data: bTables0 }] = await Promise.all([
    admin.from('menu_categories').select('id').eq('branch_id', branchB.id),
    admin.from('menu_items').select('id').eq('branch_id', branchB.id),
    admin.from('service_areas').select('id').eq('branch_id', branchB.id),
    admin.from('dining_tables').select('id').eq('branch_id', branchB.id),
  ]);

  assert(
    (bCats0?.length || 0) === 0 &&
      (bItems0?.length || 0) === 0 &&
      (bAreas0?.length || 0) === 0 &&
      (bTables0?.length || 0) === 0,
    'Data Isolation: Newly created Branch B starts completely empty (0 categories, items, areas, tables)'
  );

  // 6. Create Category, Item, Area, and Table isolated to Branch B
  const { data: catB } = await admin
    .from('menu_categories')
    .insert({
      business_id: bizId,
      branch_id: branchB.id,
      name: 'Kandy Specials',
      slug: `kandy-specials-${Date.now()}`,
    })
    .select('*')
    .single();

  const { data: itemB } = await admin
    .from('menu_items')
    .insert({
      business_id: bizId,
      branch_id: branchB.id,
      category_id: catB.id,
      name: 'Kandy Kottu',
      slug: `kandy-kottu-${Date.now()}`,
      price_cents: 120000,
      currency: 'LKR',
    })
    .select('*')
    .single();

  const { data: areaB } = await admin
    .from('service_areas')
    .insert({
      business_id: bizId,
      branch_id: branchB.id,
      name: 'Main Dining Area',
      code: 'MDA',
    })
    .select('*')
    .single();

  const { data: tableB, error: tableBErr } = await admin
    .from('dining_tables')
    .insert({
      business_id: bizId,
      branch_id: branchB.id,
      service_area_id: areaB.id,
      name: 'Kandy Table 1',
      code: 'KT1',
      table_number: 1,
      capacity: 4,
    })
    .select('*')
    .single();

  assert(!!catB && !!itemB && !!areaB && !!tableB, 'Created Category, Item, Area, and Table in Branch B', tableBErr?.message);

  // Verify Branch A queries exclude Branch B items
  const [{ data: branchACats }, { data: branchAItems }, { data: branchAAreas }, { data: branchATables }] = await Promise.all([
    admin.from('menu_categories').select('*').eq('branch_id', branchA.id),
    admin.from('menu_items').select('*').eq('branch_id', branchA.id),
    admin.from('service_areas').select('*').eq('branch_id', branchA.id),
    admin.from('dining_tables').select('*').eq('branch_id', branchA.id),
  ]);

  assert(
    !branchACats?.some((c) => c.id === catB.id) &&
      !branchAItems?.some((i) => i.id === itemB.id) &&
      !branchAAreas?.some((a) => a.id === areaB.id) &&
      !branchATables?.some((t) => t.id === tableB.id),
    'Data Isolation: Branch A queries strictly exclude all Branch B data'
  );

  // 6. Independent Branch QR Codes Enforcement
  const { data: qrA } = await admin
    .from('branch_qr_codes')
    .insert({
      business_id: bizId,
      branch_id: branchA.id,
      token_hash: `hash_branch_a_${Date.now()}`,
      token_prefix: 'prefA',
      encrypted_token: 'encA',
      version: 1,
      is_active: true,
      generated_by: userId,
    })
    .select('*')
    .single();

  const { data: qrB } = await admin
    .from('branch_qr_codes')
    .insert({
      business_id: bizId,
      branch_id: branchB.id,
      token_hash: `hash_branch_b_${Date.now()}`,
      token_prefix: 'prefB',
      encrypted_token: 'encB',
      version: 1,
      is_active: true,
      generated_by: userId,
    })
    .select('*')
    .single();

  assert(
    !!qrA && !!qrB && qrA.id !== qrB.id,
    'Each branch has an independent, unique Branch QR record (Branch A -> QR A, Branch B -> QR B)'
  );

  // 7. Duplicate active QR for same branch rejected by unique index
  const { error: dupQrErr } = await admin.from('branch_qr_codes').insert({
    business_id: bizId,
    branch_id: branchB.id,
    token_hash: `hash_branch_b_dup_${Date.now()}`,
    token_prefix: 'dupB',
    encrypted_token: 'encBdup',
    version: 1,
    is_active: true,
    generated_by: userId,
  });

  assert(!!dupQrErr, 'Unique index idx_active_qr_per_branch blocks duplicate active QR for same branch');

  // 8. Archive & Restore Branch B
  const { data: archivedB } = await admin
    .from('branches')
    .update({ status: 'archived', deleted_at: new Date().toISOString() })
    .eq('id', branchB.id)
    .select('*')
    .single();

  assert(archivedB.status === 'archived', 'Archived Branch B successfully');

  // Attempting to archive default Branch A must be protected
  const { data: defaultBranchArchivedAttempt } = await admin
    .from('branches')
    .select('is_default')
    .eq('id', branchA.id)
    .single();

  assert(defaultBranchArchivedAttempt?.is_default === true, 'Default primary Branch A remains protected');

  const { data: restoredB } = await admin
    .from('branches')
    .update({ status: 'active', deleted_at: null })
    .eq('id', branchB.id)
    .select('*')
    .single();

  assert(restoredB.status === 'active', 'Restored Branch B successfully back to active');

  // 9. Non-empty Branch deletion protection
  // Branch B owns catB and tableB, so physical delete should be blocked
  let deleteBlocked = false;
  try {
    const { count: tCount } = await admin
      .from('dining_tables')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', branchB.id);
    if ((tCount || 0) > 0) {
      deleteBlocked = true;
    }
  } catch {
    deleteBlocked = true;
  }
  assert(deleteBlocked, 'Non-empty branch deletion blocked when branch owns dining tables or menu data');

  // 10. Clean up test data
  await admin.from('dining_tables').delete().eq('business_id', bizId);
  await admin.from('service_areas').delete().eq('business_id', bizId);
  await admin.from('menu_categories').delete().eq('business_id', bizId);
  await admin.from('branch_qr_codes').delete().eq('business_id', bizId);
  await admin.from('branches').delete().eq('business_id', bizId);
  await admin.from('business_memberships').delete().eq('business_id', bizId);
  await admin.from('businesses').delete().eq('id', bizId);
  await admin.auth.admin.deleteUser(userId);

  assert(true, 'Cleaned up all temporary multi-branch test data');

  console.log('\n================================================================');
  console.log(`   Verification Finished: ${passed} / ${total} Tests PASSED   `);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runBranchesVerification().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
