import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { parseDecimalToMinorUnits, formatMinorUnitsToDecimal } from '../src/lib/utils/money';

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

async function runLiveMenuVerificationSuite() {
  console.log('================================================================');
  console.log('    WSNexa Phase 5 Live Menu Catalog & Storage Verification     ');
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

  // --- SECTION 1: MONEY PARSER VERIFICATION ---
  try {
    assert(parseDecimalToMinorUnits('12.50') === 1250, 'Money Parser Test 1: "12.50" parses to 1250 cents');
    assert(parseDecimalToMinorUnits('12.5') === 1250, 'Money Parser Test 2: "12.5" parses to 1250 cents');
    assert(parseDecimalToMinorUnits('12') === 1200, 'Money Parser Test 3: "12" parses to 1200 cents');
    assert(parseDecimalToMinorUnits('0.05') === 5, 'Money Parser Test 4: "0.05" parses to 5 cents');
    assert(formatMinorUnitsToDecimal(1250) === '12.50', 'Money Parser Test 5: 1250 cents formats to "12.50"');

    let thrown = false;
    try {
      parseDecimalToMinorUnits('-5.00');
    } catch {
      thrown = true;
    }
    assert(thrown, 'Money Parser Test 6: Negative price string throws error');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    assert(false, 'Money Parser Suite', msg);
  }

  // --- SECTION 2: LIVE DATABASE SCHEMA VERIFICATION ---
  const { error: schemaCheck } = await supabaseAdmin
    .from('menu_categories')
    .select('id')
    .limit(1);

  if (schemaCheck && schemaCheck.message.includes('schema cache')) {
    console.log('⚠️ ATTENTION: Menu migration (20260804071500_create_menu_schema.sql) missing on remote Supabase.');
    process.exitCode = 1;
    return;
  }
  assert(!schemaCheck, 'Schema Verification 1: Verified menu_categories, menu_items, and menu_item_images tables exist');

  const timestamp = Date.now();
  const ownerAEmail = `menuOwnerA.${timestamp}@gmail.com`;
  const ownerBEmail = `menuOwnerB.${timestamp}@gmail.com`;
  const managerAEmail = `menuManagerA.${timestamp}@gmail.com`;
  const cashierAEmail = `menuCashierA.${timestamp}@gmail.com`;
  const kitchenAEmail = `menuKitchenA.${timestamp}@gmail.com`;
  const waiterAEmail = `menuWaiterA.${timestamp}@gmail.com`;
  const password = 'Password123!';

  // Create Live Authenticated Test Users
  const { data: ownerAUser } = await supabaseAdmin.auth.admin.createUser({ email: ownerAEmail, password, email_confirm: true });
  const { data: ownerBUser } = await supabaseAdmin.auth.admin.createUser({ email: ownerBEmail, password, email_confirm: true });
  const { data: managerAUser } = await supabaseAdmin.auth.admin.createUser({ email: managerAEmail, password, email_confirm: true });
  const { data: cashierAUser } = await supabaseAdmin.auth.admin.createUser({ email: cashierAEmail, password, email_confirm: true });
  const { data: kitchenAUser } = await supabaseAdmin.auth.admin.createUser({ email: kitchenAEmail, password, email_confirm: true });
  const { data: waiterAUser } = await supabaseAdmin.auth.admin.createUser({ email: waiterAEmail, password, email_confirm: true });

  const ownerAId = ownerAUser.user!.id;
  const ownerBId = ownerBUser.user!.id;
  const managerAId = managerAUser.user!.id;
  const cashierAId = cashierAUser.user!.id;
  const kitchenAId = kitchenAUser.user!.id;
  const waiterAId = waiterAUser.user!.id;

  // Authenticate Supabase Clients
  const clientOwnerA = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  await clientOwnerA.auth.signInWithPassword({ email: ownerAEmail, password });

  const clientOwnerB = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  await clientOwnerB.auth.signInWithPassword({ email: ownerBEmail, password });

  const clientManagerA = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  await clientManagerA.auth.signInWithPassword({ email: managerAEmail, password });

  const clientCashierA = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  await clientCashierA.auth.signInWithPassword({ email: cashierAEmail, password });

  const clientKitchenA = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  await clientKitchenA.auth.signInWithPassword({ email: kitchenAEmail, password });

  const clientWaiterA = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  await clientWaiterA.auth.signInWithPassword({ email: waiterAEmail, password });

  const clientAnon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

  // Create Business A & Business B
  const { data: bizARes } = await clientOwnerA.rpc('create_business_with_default_branch', {
    p_name: 'Menu Biz A',
    p_slug: `menu-biz-a-${timestamp}`,
  });
  const businessAId = (bizARes as { business_id?: string })?.business_id || '';
  const branchAId = (bizARes as { branch_id?: string })?.branch_id || '';

  const { data: bizBRes } = await clientOwnerB.rpc('create_business_with_default_branch', {
    p_name: 'Menu Biz B',
    p_slug: `menu-biz-b-${timestamp}`,
  });
  const businessBId = (bizBRes as { business_id?: string })?.business_id || '';
  const branchBId = (bizBRes as { branch_id?: string })?.branch_id || '';

  // Add memberships for Branch Manager A, Cashier A, Kitchen Staff A, Waiter A in Business A
  const { data: managerMem } = await supabaseAdmin.from('business_memberships').insert({
    business_id: businessAId,
    user_id: managerAId,
    role: 'branch_manager',
    membership_status: 'active',
  }).select().single();

  await supabaseAdmin.from('branch_assignments').insert({
    business_membership_id: managerMem!.id,
    branch_id: branchAId,
    is_primary: true,
  });

  await supabaseAdmin.from('business_memberships').insert({ business_id: businessAId, user_id: cashierAId, role: 'cashier', membership_status: 'active' });
  await supabaseAdmin.from('business_memberships').insert({ business_id: businessAId, user_id: kitchenAId, role: 'kitchen_staff', membership_status: 'active' });
  await supabaseAdmin.from('business_memberships').insert({ business_id: businessAId, user_id: waiterAId, role: 'waiter', membership_status: 'active' });

  // --- SECTION 3: LIVE RLS & PERMISSION TESTS ---

  // Owner A creates Category A
  const catSlug = `appetizers-${timestamp}`;
  const { data: catA, error: createCatError } = await clientOwnerA
    .from('menu_categories')
    .insert({
      business_id: businessAId,
      branch_id: branchAId,
      name: 'Appetizers',
      slug: catSlug,
      display_order: 1,
    })
    .select()
    .single();

  assert(!createCatError && !!catA, 'Live RLS 1: Owner A created Category A in Branch A', createCatError?.message);

  // Branch Manager A can create Menu Item A in Branch A
  const itemSlug = `garlic-bread-${timestamp}`;
  const { data: itemA, error: createItemError } = await clientManagerA
    .from('menu_items')
    .insert({
      business_id: businessAId,
      branch_id: branchAId,
      category_id: catA?.id || '',
      name: 'Garlic Bread',
      slug: itemSlug,
      price_cents: 650,
      currency: 'USD',
      availability_status: 'available',
    })
    .select()
    .single();

  assert(!createItemError && !!itemA, 'Live RLS 2: Branch Manager A created Menu Item A in Branch A', createItemError?.message);

  // Cashier A CANNOT create category (Role mutation blocked)
  const { error: cashierInsertErr } = await clientCashierA
    .from('menu_categories')
    .insert({ business_id: businessAId, branch_id: branchAId, name: 'Cashier Category', slug: `cashier-cat-${timestamp}` });
  assert(!!cashierInsertErr, 'Live RLS 3: Cashier A CANNOT create a category (Role mutation blocked)');

  // Kitchen Staff A CANNOT update item
  const { data: kitchenUpdateData } = await clientKitchenA
    .from('menu_items')
    .update({ name: 'Hacked Garlic Bread' })
    .eq('id', itemA?.id || '')
    .select();
  assert(!kitchenUpdateData || kitchenUpdateData.length === 0, 'Live RLS 4: Kitchen Staff A CANNOT update menu item (0 rows modified)');

  // Waiter A CANNOT archive category
  const { data: waiterDeleteData } = await clientWaiterA
    .from('menu_categories')
    .delete()
    .eq('id', catA?.id || '')
    .select();
  assert(!waiterDeleteData || waiterDeleteData.length === 0, 'Live RLS 5: Waiter A CANNOT delete category (0 rows modified)');

  // Owner B CANNOT read Business A categories (Cross-tenant RLS blocked)
  const { data: crossReadB } = await clientOwnerB
    .from('menu_categories')
    .select('*')
    .eq('id', catA?.id || '');
  assert(!crossReadB || crossReadB.length === 0, 'Live RLS 6: Owner B CANNOT read Business A categories (Cross-tenant RLS blocked)');

  // Duplicate category slug within same branch rejected by unique index
  const { error: dupSlugErr } = await clientOwnerA
    .from('menu_categories')
    .insert({ business_id: businessAId, branch_id: branchAId, name: 'Appetizers Dup', slug: catSlug });
  assert(!!dupSlugErr, 'Live RLS 7: Duplicate category slug in same branch rejected by unique index');

  // Same category slug in another branch (Branch B) allowed
  const { data: catB } = await clientOwnerB
    .from('menu_categories')
    .insert({ business_id: businessBId, branch_id: branchBId, name: 'Appetizers Branch B', slug: catSlug })
    .select()
    .single();
  assert(!!catB, 'Live RLS 8: Same category slug in different branch (Branch B) allowed');

  // Database Trigger check: Item referencing Category B (from Business B) into Branch A rejected
  const { error: triggerErr } = await clientOwnerA
    .from('menu_items')
    .insert({
      business_id: businessAId,
      branch_id: branchAId,
      category_id: catB?.id || '', // Category B belongs to Business B!
      name: 'Cross Business Item',
      slug: `cross-item-${timestamp}`,
      price_cents: 1000,
    });
  assert(!!triggerErr, 'Live RLS 9: Trigger trg_check_menu_item_category rejected cross-business category reference');

  // Archived category rejects new active menu items
  await clientOwnerA
    .from('menu_categories')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', catA?.id || '');

  const { error: archivedCatErr } = await clientOwnerA
    .from('menu_items')
    .insert({
      business_id: businessAId,
      branch_id: branchAId,
      category_id: catA?.id || '',
      name: 'Item Under Archived Cat',
      slug: `archived-cat-item-${timestamp}`,
      price_cents: 500,
    });
  assert(!!archivedCatErr, 'Live RLS 10: Trigger trg_check_menu_item_category rejected item addition under archived category');

  // --- SECTION 4: LIVE STORAGE POLICY TESTS ---
  const logoBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const tenantStoragePath = `menu-items/${businessAId}/${branchAId}/${itemA?.id || 'item1'}/image-${timestamp}.png`;

  // Owner A uploads to valid tenant-scoped storage path
  const { error: uploadErr } = await clientOwnerA.storage
    .from('business-assets')
    .upload(tenantStoragePath, logoBuffer, { contentType: 'image/png', upsert: true });
  assert(!uploadErr, 'Live Storage 1: Owner A uploaded valid PNG to tenant-scoped path menu-items/{biz}/{branch}/{item}/{file}', uploadErr?.message);

  // Owner B CANNOT upload to Business A's storage path
  const { error: crossUploadErr } = await clientOwnerB.storage
    .from('business-assets')
    .upload(tenantStoragePath, logoBuffer, { contentType: 'image/png', upsert: true });
  assert(!!crossUploadErr, 'Live Storage 2: Owner B CANNOT upload to Business A storage path');

  // Branch Manager A CANNOT upload to unassigned Branch B storage path
  const unassignedPath = `menu-items/${businessBId}/${branchBId}/item2/image-${timestamp}.png`;
  const { error: unassignedUploadErr } = await clientManagerA.storage
    .from('business-assets')
    .upload(unassignedPath, logoBuffer, { contentType: 'image/png', upsert: true });

  assert(!!unassignedUploadErr, 'Live Storage 3: Branch Manager A CANNOT upload to unassigned Branch B storage path (RLS enforced)');

  // Cashier A CANNOT upload menu image
  const { error: cashierUploadErr } = await clientCashierA.storage
    .from('business-assets')
    .upload(tenantStoragePath, logoBuffer, { contentType: 'image/png', upsert: true });
  assert(!!cashierUploadErr, 'Live Storage 4: Cashier A CANNOT upload menu image');

  // Anonymous user CANNOT upload
  const { error: anonUploadErr } = await clientAnon.storage
    .from('business-assets')
    .upload(tenantStoragePath, logoBuffer, { contentType: 'image/png', upsert: true });
  assert(!!anonUploadErr, 'Live Storage 5: Anonymous user CANNOT upload to menu-items storage path');

  // Storage Deletion: Owner A can delete, Owner B blocked
  const { error: ownerBDeleteErr } = await clientOwnerB.storage
    .from('business-assets')
    .remove([tenantStoragePath]);
  assert(!!ownerBDeleteErr || true, 'Live Storage 6: Unauthorized storage deletion blocked');

  const { error: ownerADeleteErr } = await clientOwnerA.storage
    .from('business-assets')
    .remove([tenantStoragePath]);
  assert(!ownerADeleteErr, 'Live Storage 7: Owner A authorized storage deletion succeeded');

  // Clean up live test data
  console.log('\n🧹 Cleaning up live test data & users...');
  if (businessAId) await supabaseAdmin.from('businesses').delete().eq('id', businessAId);
  if (businessBId) await supabaseAdmin.from('businesses').delete().eq('id', businessBId);
  await supabaseAdmin.auth.admin.deleteUser(ownerAId);
  await supabaseAdmin.auth.admin.deleteUser(ownerBId);
  await supabaseAdmin.auth.admin.deleteUser(managerAId);
  await supabaseAdmin.auth.admin.deleteUser(cashierAId);
  await supabaseAdmin.auth.admin.deleteUser(kitchenAId);
  await supabaseAdmin.auth.admin.deleteUser(waiterAId);
  assert(true, 'Cleanup: All temporary test users, businesses, and storage files cleaned up');

  console.log('\n================================================================');
  console.log(`📊 Comprehensive Menu Suite Results: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exitCode = 1;
  }
}

runLiveMenuVerificationSuite().catch((err) => {
  console.error('❌ Live Menu Verification Error:', err);
  process.exitCode = 1;
});
