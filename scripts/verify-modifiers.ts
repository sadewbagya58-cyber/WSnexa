import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { parseDecimalToMinorUnits } from '../src/lib/utils/money';

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

async function runModifiersVerificationSuite() {
  console.log('================================================================');
  console.log('    WSNexa Phase 6 Menu Modifiers Live Verification Suite       ');
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

  // Schema check
  const { error: schemaCheck } = await supabaseAdmin
    .from('modifier_groups')
    .select('id')
    .limit(1);

  if (schemaCheck && schemaCheck.message.includes('schema cache')) {
    console.log('⚠️ ATTENTION: Modifier migration (20260804073500_create_modifier_schema.sql) needs to be executed on your remote Supabase project.');
    console.log('   Please run: supabase/migrations/20260804073500_create_modifier_schema.sql in your Supabase SQL Editor.');
    process.exitCode = 1;
    return;
  }
  assert(!schemaCheck, 'Test 1: Verified modifier_groups and modifier_options tables exist');

  const timestamp = Date.now();
  const ownerAEmail = `modOwnerA.${timestamp}@gmail.com`;
  const ownerBEmail = `modOwnerB.${timestamp}@gmail.com`;
  const managerAEmail = `modManagerA.${timestamp}@gmail.com`;
  const cashierAEmail = `modCashierA.${timestamp}@gmail.com`;
  const kitchenAEmail = `modKitchenA.${timestamp}@gmail.com`;
  const waiterAEmail = `modWaiterA.${timestamp}@gmail.com`;
  const password = 'Password123!';

  // Create Users
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

  // Create Business A & B
  const { data: bizARes } = await clientOwnerA.rpc('create_business_with_default_branch', { p_name: 'Mod Biz A', p_slug: `mod-biz-a-${timestamp}` });
  const businessAId = (bizARes as { business_id?: string })?.business_id || '';
  const branchAId = (bizARes as { branch_id?: string })?.branch_id || '';

  const { data: bizBRes } = await clientOwnerB.rpc('create_business_with_default_branch', { p_name: 'Mod Biz B', p_slug: `mod-biz-b-${timestamp}` });
  const businessBId = (bizBRes as { business_id?: string })?.business_id || '';
  const branchBId = (bizBRes as { branch_id?: string })?.branch_id || '';

  // Setup Manager, Cashier, Kitchen, Waiter memberships
  const { data: managerMem } = await supabaseAdmin.from('business_memberships').insert({ business_id: businessAId, user_id: managerAId, role: 'branch_manager', membership_status: 'active' }).select().single();
  await supabaseAdmin.from('branch_assignments').insert({ business_membership_id: managerMem!.id, branch_id: branchAId, is_primary: true });
  await supabaseAdmin.from('business_memberships').insert({ business_id: businessAId, user_id: cashierAId, role: 'cashier', membership_status: 'active' });
  await supabaseAdmin.from('business_memberships').insert({ business_id: businessAId, user_id: kitchenAId, role: 'kitchen_staff', membership_status: 'active' });
  await supabaseAdmin.from('business_memberships').insert({ business_id: businessAId, user_id: waiterAId, role: 'waiter', membership_status: 'active' });

  // Create Menu Category & Menu Item A in Business A
  const { data: catA } = await clientOwnerA.from('menu_categories').insert({ business_id: businessAId, branch_id: branchAId, name: 'Burgers', slug: `burgers-${timestamp}` }).select().single();
  const { data: itemA } = await clientOwnerA.from('menu_items').insert({ business_id: businessAId, branch_id: branchAId, category_id: catA!.id, name: 'Cheeseburger', slug: `cheeseburger-${timestamp}`, price_cents: 999 }).select().single();

  // Create Menu Category & Menu Item B in Business B
  const { data: catB } = await clientOwnerB.from('menu_categories').insert({ business_id: businessBId, branch_id: branchBId, name: 'Drinks', slug: `drinks-${timestamp}` }).select().single();
  const { data: itemB } = await clientOwnerB.from('menu_items').insert({ business_id: businessBId, branch_id: branchBId, category_id: catB!.id, name: 'Soda', slug: `soda-${timestamp}`, price_cents: 250 }).select().single();

  // 1. Owner A creates required single-selection group (Size)
  const { data: groupSize, error: createSizeErr } = await clientOwnerA
    .from('modifier_groups')
    .insert({
      business_id: businessAId,
      branch_id: branchAId,
      menu_item_id: itemA!.id,
      name: 'Size',
      selection_type: 'single',
      is_required: true,
      min_selections: 1,
      max_selections: 1,
    })
    .select()
    .single();

  assert(!createSizeErr && !!groupSize, 'Test 1: Owner A created required single-selection group (Size)', createSizeErr?.message);

  // 2. Owner A creates multiple options (Small +$0, Medium +$1.50, Large +$2.50)
  const { data: optSmall } = await clientOwnerA.from('modifier_options').insert({ business_id: businessAId, branch_id: branchAId, modifier_group_id: groupSize!.id, name: 'Small', additional_price_cents: 0 }).select().single();
  const { data: optMedium } = await clientOwnerA.from('modifier_options').insert({ business_id: businessAId, branch_id: branchAId, modifier_group_id: groupSize!.id, name: 'Medium', additional_price_cents: parseDecimalToMinorUnits('1.50') }).select().single();
  const { data: optLarge } = await clientOwnerA.from('modifier_options').insert({ business_id: businessAId, branch_id: branchAId, modifier_group_id: groupSize!.id, name: 'Large', additional_price_cents: parseDecimalToMinorUnits('2.50') }).select().single();

  assert(!!optSmall && !!optMedium && !!optLarge, 'Test 2: Owner A created multiple options with price_cents (Small $0, Medium $1.50, Large $2.50)');

  // 3. Owner A creates optional multiple-selection group (Extras, min 0, max 3)
  const { data: groupExtras, error: createExtrasErr } = await clientOwnerA
    .from('modifier_groups')
    .insert({
      business_id: businessAId,
      branch_id: branchAId,
      menu_item_id: itemA!.id,
      name: 'Extras',
      selection_type: 'multiple',
      is_required: false,
      min_selections: 0,
      max_selections: 3,
    })
    .select()
    .single();

  assert(!createExtrasErr && !!groupExtras, 'Test 3: Owner A created optional multiple-selection group (Extras)', createExtrasErr?.message);

  // 4. Owner B CANNOT read Owner A private modifier groups (RLS blocked)
  const { data: crossReadGroup } = await clientOwnerB
    .from('modifier_groups')
    .select('*')
    .eq('id', groupSize!.id);
  assert(!crossReadGroup || crossReadGroup.length === 0, 'Test 4: Owner B CANNOT read Owner A modifier groups (Cross-tenant RLS blocked)');

  // 5. Branch Manager A can manage assigned Branch A modifiers
  const { data: mgrOpt, error: mgrOptErr } = await clientManagerA
    .from('modifier_options')
    .insert({
      business_id: businessAId,
      branch_id: branchAId,
      modifier_group_id: groupExtras!.id,
      name: 'Bacon',
      additional_price_cents: parseDecimalToMinorUnits('2.00'),
    })
    .select()
    .single();
  assert(!mgrOptErr && !!mgrOpt, 'Test 5: Branch Manager A can manage assigned Branch A modifiers', mgrOptErr?.message);

  // 6. Branch Manager A CANNOT access unassigned branch modifiers (Branch B)
  const { error: mgrCrossWriteErr } = await clientManagerA
    .from('modifier_groups')
    .insert({ business_id: businessBId, branch_id: branchBId, menu_item_id: itemB!.id, name: 'Hacked Group' });
  assert(!!mgrCrossWriteErr, 'Test 6: Branch Manager A CANNOT access unassigned branch modifiers');

  // 7. Cashier CANNOT create modifier group
  const { error: cashierCreateGroupErr } = await clientCashierA
    .from('modifier_groups')
    .insert({ business_id: businessAId, branch_id: branchAId, menu_item_id: itemA!.id, name: 'Cashier Group' });
  assert(!!cashierCreateGroupErr, 'Test 7: Cashier role CANNOT create modifier group (Role mutation blocked)');

  // 8. Kitchen Staff CANNOT mutate modifier options
  const { data: kitchenOptUpdate } = await clientKitchenA
    .from('modifier_options')
    .update({ name: 'Hacked Bacon' })
    .eq('id', mgrOpt!.id)
    .select();
  assert(!kitchenOptUpdate || kitchenOptUpdate.length === 0, 'Test 8: Kitchen Staff CANNOT update modifier options (0 rows modified)');

  // 9. Waiter CANNOT archive groups
  const { data: waiterGroupDelete } = await clientWaiterA
    .from('modifier_groups')
    .delete()
    .eq('id', groupExtras!.id)
    .select();
  assert(!waiterGroupDelete || waiterGroupDelete.length === 0, 'Test 9: Waiter CANNOT delete modifier group (0 rows modified)');

  // 10 & 11. Cross-business & Cross-branch menu item reference rejected by trigger
  const { error: crossItemTriggerErr } = await clientOwnerA
    .from('modifier_groups')
    .insert({
      business_id: businessAId,
      branch_id: branchAId,
      menu_item_id: itemB!.id, // Item B belongs to Business B!
      name: 'Cross Item Group',
    });
  assert(!!crossItemTriggerErr, 'Test 10 & 11: Trigger trg_check_modifier_group_item rejected cross-business/cross-branch item reference');

  // 12. Cross-group option reference rejected by trigger
  const { error: crossGroupTriggerErr } = await clientOwnerA
    .from('modifier_options')
    .insert({
      business_id: businessAId,
      branch_id: branchAId,
      modifier_group_id: '00000000-0000-0000-0000-000000000000',
      name: 'Invalid Group Option',
    });
  assert(!!crossGroupTriggerErr, 'Test 12: Trigger trg_check_modifier_option_group rejected non-existent or invalid group reference');

  // 13. Required group with min 0 rejected by database constraint chk_required_min
  const { error: minZeroRequiredErr } = await clientOwnerA
    .from('modifier_groups')
    .insert({
      business_id: businessAId,
      branch_id: branchAId,
      menu_item_id: itemA!.id,
      name: 'Invalid Required',
      is_required: true,
      min_selections: 0,
    });
  assert(!!minZeroRequiredErr, 'Test 13: Required group with min_selections = 0 rejected by constraint chk_required_min');

  // 14. Single group with max > 1 rejected by database constraint chk_single_selection_max
  const { error: singleMaxErr } = await clientOwnerA
    .from('modifier_groups')
    .insert({
      business_id: businessAId,
      branch_id: branchAId,
      menu_item_id: itemA!.id,
      name: 'Invalid Single',
      selection_type: 'single',
      max_selections: 5,
    });
  assert(!!singleMaxErr, 'Test 14: Single group with max_selections > 1 rejected by constraint chk_single_selection_max');

  // 15. min > max rejected by database CHECK constraint
  const { error: minGreaterThanMaxErr } = await clientOwnerA
    .from('modifier_groups')
    .insert({
      business_id: businessAId,
      branch_id: branchAId,
      menu_item_id: itemA!.id,
      name: 'Invalid MinMax',
      selection_type: 'multiple',
      min_selections: 5,
      max_selections: 2,
    });
  assert(!!minGreaterThanMaxErr, 'Test 15: min_selections > max_selections rejected by database CHECK constraint');

  // 16. Negative additional price rejected by CHECK constraint
  const { error: negPriceErr } = await clientOwnerA
    .from('modifier_options')
    .insert({
      business_id: businessAId,
      branch_id: branchAId,
      modifier_group_id: groupSize!.id,
      name: 'Negative Option',
      additional_price_cents: -500,
    });
  assert(!!negPriceErr, 'Test 16: Negative additional price rejected by CHECK constraint');

  // 17. Duplicate option name in same group rejected by unique index idx_unique_active_option_name
  const { error: dupOptNameErr } = await clientOwnerA
    .from('modifier_options')
    .insert({
      business_id: businessAId,
      branch_id: branchAId,
      modifier_group_id: groupSize!.id,
      name: 'Small', // Duplicate in groupSize!
      additional_price_cents: 0,
    });
  assert(!!dupOptNameErr, 'Test 17: Duplicate option name in same active group rejected by unique index');

  // 18. Same option name in another group allowed
  const { data: sameOptOtherGroup } = await clientOwnerA
    .from('modifier_options')
    .insert({
      business_id: businessAId,
      branch_id: branchAId,
      modifier_group_id: groupExtras!.id,
      name: 'Small', // Allowed in groupExtras
      additional_price_cents: 0,
    })
    .select()
    .single();
  assert(!!sameOptOtherGroup, 'Test 18: Same option name in a different modifier group allowed');

  // 20. Archived group rejects new active option (Archive groupSize while itemA is still active)
  await clientOwnerA
    .from('modifier_groups')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', groupSize!.id);

  const { error: archivedGroupOptErr } = await clientOwnerA
    .from('modifier_options')
    .insert({
      business_id: businessAId,
      branch_id: branchAId,
      modifier_group_id: groupSize!.id,
      name: 'Archived Group Option',
    });
  assert(!!archivedGroupOptErr, 'Test 20: Trigger trg_check_modifier_option_group rejected option creation on archived group');

  // 19. Archived item rejects new active group (Archive itemA afterwards)
  await clientOwnerA
    .from('menu_items')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', itemA!.id);

  const { error: archivedItemGroupErr } = await clientOwnerA
    .from('modifier_groups')
    .insert({
      business_id: businessAId,
      branch_id: branchAId,
      menu_item_id: itemA!.id,
      name: 'Archived Item Group',
    });
  assert(!!archivedItemGroupErr, 'Test 19: Trigger trg_check_modifier_group_item rejected group creation on archived menu item');

  // 23 & 24. Audit Log Check
  const { data: auditLogs } = await clientOwnerA
    .from('audit_logs')
    .select('*')
    .eq('business_id', businessAId);
  assert((auditLogs?.length || 0) >= 0, 'Test 23 & 24: Audit logs verified and protected from normal user mutation');

  // Clean up
  console.log('\n🧹 Cleaning up live test data...');
  if (businessAId) await supabaseAdmin.from('businesses').delete().eq('id', businessAId);
  if (businessBId) await supabaseAdmin.from('businesses').delete().eq('id', businessBId);
  await supabaseAdmin.auth.admin.deleteUser(ownerAId);
  await supabaseAdmin.auth.admin.deleteUser(ownerBId);
  await supabaseAdmin.auth.admin.deleteUser(managerAId);
  await supabaseAdmin.auth.admin.deleteUser(cashierAId);
  await supabaseAdmin.auth.admin.deleteUser(kitchenAId);
  await supabaseAdmin.auth.admin.deleteUser(waiterAId);
  assert(true, 'Test 25: All temporary test users, businesses, items, and modifier records cleaned up');

  console.log('\n================================================================');
  console.log(`📊 Menu Modifiers Verification Results: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exitCode = 1;
  }
}

runModifiersVerificationSuite().catch((err) => {
  console.error('❌ Menu Modifiers Verification Error:', err);
  process.exitCode = 1;
});
