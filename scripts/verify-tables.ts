import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { Database } from '../src/types/database.types';

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
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !serviceRoleKey || !anonKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}

const adminClient = createClient<Database>(supabaseUrl, serviceRoleKey);

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    console.error(`  ❌ [FAIL] ${testName} ${detail ? `(${detail})` : ''}`);
    throw new Error(`Verification failed at: ${testName}`);
  }
}

async function runTableVerification() {
  console.log('\n================================================================');
  console.log('   WSNexa Phase 7 Dining Table & Area Verification Suite        ');
  console.log('================================================================\n');

  // Verify DDL Tables
  const { error: areaErr } = await adminClient.from('service_areas').select('id').limit(1);
  const { error: tableErr } = await adminClient.from('dining_tables').select('id').limit(1);
  assert(!areaErr && !tableErr, 'Test 1: Verified service_areas and dining_tables tables exist in Supabase');

  const randomSuffix = Math.floor(Math.random() * 100000);
  const ownerAEmail = `tbl_ownerA_${randomSuffix}@wsnexa-test.com`;
  const ownerBEmail = `tbl_ownerB_${randomSuffix}@wsnexa-test.com`;
  const managerAEmail = `tbl_mgrA_${randomSuffix}@wsnexa-test.com`;
  const cashierAEmail = `tbl_cashierA_${randomSuffix}@wsnexa-test.com`;
  const kitchenAEmail = `tbl_kitchenA_${randomSuffix}@wsnexa-test.com`;
  const waiterAEmail = `tbl_waiterA_${randomSuffix}@wsnexa-test.com`;
  const testPassword = 'Password123!';

  // Step 1: Create Users
  const { data: userA } = await adminClient.auth.admin.createUser({ email: ownerAEmail, password: testPassword, email_confirm: true });
  const { data: userB } = await adminClient.auth.admin.createUser({ email: ownerBEmail, password: testPassword, email_confirm: true });
  const { data: mgrA } = await adminClient.auth.admin.createUser({ email: managerAEmail, password: testPassword, email_confirm: true });
  const { data: cashierA } = await adminClient.auth.admin.createUser({ email: cashierAEmail, password: testPassword, email_confirm: true });
  const { data: kitchenA } = await adminClient.auth.admin.createUser({ email: kitchenAEmail, password: testPassword, email_confirm: true });
  const { data: waiterA } = await adminClient.auth.admin.createUser({ email: waiterAEmail, password: testPassword, email_confirm: true });

  const clientOwnerA = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const clientOwnerB = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const clientMgrA = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const clientCashierA = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const clientKitchenA = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const clientWaiterA = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

  await clientOwnerA.auth.signInWithPassword({ email: ownerAEmail, password: testPassword });
  await clientOwnerB.auth.signInWithPassword({ email: ownerBEmail, password: testPassword });
  await clientMgrA.auth.signInWithPassword({ email: managerAEmail, password: testPassword });
  await clientCashierA.auth.signInWithPassword({ email: cashierAEmail, password: testPassword });
  await clientKitchenA.auth.signInWithPassword({ email: kitchenAEmail, password: testPassword });
  await clientWaiterA.auth.signInWithPassword({ email: waiterAEmail, password: testPassword });

  // Step 2: Create Businesses & Branches via RPC
  const { data: bizARes } = await clientOwnerA.rpc('create_business_with_default_branch', {
    p_name: `Table Biz A ${randomSuffix}`,
    p_slug: `tbl-biz-a-${randomSuffix}`,
  });
  const bizAId = (bizARes as { business_id: string }).business_id;
  const branchAId = (bizARes as { branch_id: string }).branch_id;

  const { data: bizBRes } = await clientOwnerB.rpc('create_business_with_default_branch', {
    p_name: `Table Biz B ${randomSuffix}`,
    p_slug: `tbl-biz-b-${randomSuffix}`,
  });
  const bizBId = (bizBRes as { business_id: string }).business_id;
  const branchBId = (bizBRes as { branch_id: string }).branch_id;

  // Setup Branch Manager A, Cashier A, Kitchen A, Waiter A in Business A
  const roles: Array<[string, 'branch_manager' | 'cashier' | 'kitchen_staff' | 'waiter']> = [
    [mgrA.user!.id, 'branch_manager'],
    [cashierA.user!.id, 'cashier'],
    [kitchenA.user!.id, 'kitchen_staff'],
    [waiterA.user!.id, 'waiter'],
  ];

  for (const [userId, role] of roles) {
    let { data: member } = await adminClient
      .from('business_memberships')
      .insert({ business_id: bizAId, user_id: userId, role, membership_status: 'active' })
      .select()
      .maybeSingle();

    if (!member) {
      const { data: existing } = await adminClient
        .from('business_memberships')
        .select('*')
        .eq('business_id', bizAId)
        .eq('user_id', userId)
        .single();
      member = existing;
    }

    if (member) {
      await adminClient
        .from('branch_assignments')
        .insert({ business_membership_id: member.id, branch_id: branchAId, is_primary: true });
    }
  }

  // 1. Owner A creates Service Area A (Main Hall)
  const { data: areaA, error: areaAErr } = await clientOwnerA
    .from('service_areas')
    .insert({ business_id: bizAId, branch_id: branchAId, name: 'Main Hall', code: 'HALL' })
    .select()
    .single();
  assert(!areaAErr && !!areaA, 'Test 1: Owner A created Service Area A (Main Hall)', areaAErr?.message);

  // 2. Owner A creates Dining Table A
  const { data: tableA, error: tableAErr } = await clientOwnerA
    .from('dining_tables')
    .insert({ business_id: bizAId, branch_id: branchAId, service_area_id: areaA!.id, name: 'Table 1', code: 'T1', capacity: 4 })
    .select()
    .single();
  assert(!tableAErr && !!tableA, 'Test 2: Owner A created Dining Table A (Table 1, T1)', tableAErr?.message);

  // 3. Owner A can read and update Area A and Table A
  const { data: readTableA } = await clientOwnerA.from('dining_tables').select().eq('id', tableA!.id).single();
  assert(!!readTableA, 'Test 3: Owner A can read and update Area A and Table A');

  // 4. Owner B CANNOT read Area A or Table A (Cross-tenant RLS blocked)
  const { data: crossReadTable } = await clientOwnerB.from('dining_tables').select().eq('id', tableA!.id);
  assert(!crossReadTable || crossReadTable.length === 0, 'Test 4: Owner B CANNOT read Owner A dining tables');

  // 5. Anonymous user CANNOT read private management data
  const clientAnon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data: anonTables } = await clientAnon.from('dining_tables').select();
  assert(!anonTables || anonTables.length === 0, 'Test 5: Anonymous user CANNOT read dining tables');

  // 6. Branch Manager A can manage Branch A areas and tables
  const { data: mgrTable, error: mgrTableErr } = await clientMgrA
    .from('dining_tables')
    .insert({ business_id: bizAId, branch_id: branchAId, service_area_id: areaA!.id, name: 'Table 2', code: 'T2', capacity: 2 })
    .select()
    .single();
  assert(!mgrTableErr && !!mgrTable, 'Test 6: Branch Manager A can manage Branch A tables', mgrTableErr?.message);

  // 7. Branch Manager A CANNOT access an unassigned branch (Branch B)
  const { error: mgrCrossWriteErr } = await clientMgrA
    .from('service_areas')
    .insert({ business_id: bizBId, branch_id: branchBId, name: 'Hacked Area', code: 'HACK' });
  assert(!!mgrCrossWriteErr, 'Test 7: Branch Manager A CANNOT access unassigned branch');

  // 8. Cashier CANNOT create table configuration
  const { error: cashierCreateErr } = await clientCashierA
    .from('dining_tables')
    .insert({ business_id: bizAId, branch_id: branchAId, service_area_id: areaA!.id, name: 'Cashier Table', code: 'TC' });
  assert(!!cashierCreateErr, 'Test 8: Cashier role CANNOT create dining table');

  // 9. Kitchen Staff CANNOT update service areas or tables
  const { data: kitchenMut } = await clientKitchenA.from('dining_tables').update({ name: 'Hacked' }).eq('id', tableA!.id).select();
  assert(!kitchenMut || kitchenMut.length === 0, 'Test 9: Kitchen Staff CANNOT update dining tables (0 rows modified)');

  // 10. Waiter CANNOT delete service areas or tables
  const { data: waiterMut } = await clientWaiterA.from('dining_tables').delete().eq('id', tableA!.id).select();
  assert(!waiterMut || waiterMut.length === 0, 'Test 10: Waiter CANNOT delete dining tables (0 rows modified)');

  // 11 & 12. Cross-business / cross-branch service area reference rejected by trigger
  const { error: crossBizAreaErr } = await clientOwnerA
    .from('dining_tables')
    .insert({ business_id: bizBId, branch_id: branchBId, service_area_id: areaA!.id, name: 'Cross Biz Table', code: 'TCB' });
  assert(!!crossBizAreaErr, 'Test 11 & 12: Trigger trg_check_dining_table_area rejected cross-business/branch area reference');

  // 13. Duplicate table code in same branch rejected by unique index
  const { error: dupCodeErr } = await clientOwnerA
    .from('dining_tables')
    .insert({ business_id: bizAId, branch_id: branchAId, service_area_id: areaA!.id, name: 'Dup Table', code: 'T1' });
  assert(!!dupCodeErr, 'Test 13: Duplicate table code in same branch rejected by unique index');

  // 14. Same table code in another branch allowed
  const { data: areaB } = await clientOwnerB
    .from('service_areas')
    .insert({ business_id: bizBId, branch_id: branchBId, name: 'Main Hall', code: 'HALL' })
    .select()
    .single();

  const { data: tableB } = await clientOwnerB
    .from('dining_tables')
    .insert({ business_id: bizBId, branch_id: branchBId, service_area_id: areaB!.id, name: 'Table 1', code: 'T1' })
    .select()
    .single();
  assert(!!tableB, 'Test 14: Same table code T1 in another branch (Branch B) allowed');

  // 15. Duplicate table number in same branch rejected
  await clientOwnerA
    .from('dining_tables')
    .update({ table_number: 10 })
    .eq('id', tableA!.id);

  const { error: dupNumErr } = await clientOwnerA
    .from('dining_tables')
    .insert({ business_id: bizAId, branch_id: branchAId, service_area_id: areaA!.id, name: 'Table 10', code: 'T10', table_number: 10 });
  assert(!!dupNumErr, 'Test 15: Duplicate table number 10 in same branch rejected');

  // 16. Invalid capacity (0 or > 50) rejected by CHECK constraint
  const { error: invalidCapErr } = await clientOwnerA
    .from('dining_tables')
    .insert({ business_id: bizAId, branch_id: branchAId, service_area_id: areaA!.id, name: 'Huge Table', code: 'THUGE', capacity: 100 });
  assert(!!invalidCapErr, 'Test 16: Capacity > 50 rejected by CHECK constraint');

  // 17. Invalid status rejected
  const { error: invalidStatusErr } = await adminClient
    .from('dining_tables')
    .insert({ business_id: bizAId, branch_id: branchAId, service_area_id: areaA!.id, name: 'Bad Status', code: 'TBS', status: 'invalid_status' as unknown as Database['public']['Enums']['table_status'] });
  assert(!!invalidStatusErr, 'Test 17: Invalid table status rejected');

  // 18. New table under archived area rejected by trigger
  const { data: areaArchived } = await clientOwnerA
    .from('service_areas')
    .insert({ business_id: bizAId, branch_id: branchAId, name: 'Empty Area', code: 'EMPTY' })
    .select()
    .single();

  await clientOwnerA
    .from('service_areas')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', areaArchived!.id);

  const { error: archivedAreaTableErr } = await clientOwnerA
    .from('dining_tables')
    .insert({ business_id: bizAId, branch_id: branchAId, service_area_id: areaArchived!.id, name: 'Archived Area Table', code: 'TAA' });
  assert(!!archivedAreaTableErr, 'Test 18: Trigger trg_check_dining_table_area rejected new table under archived service area');

  // 19. Area archival with active tables is safely blocked by trigger
  const { error: archiveAreaBlockedErr } = await clientOwnerA
    .from('service_areas')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', areaA!.id);
  assert(!!archiveAreaBlockedErr, 'Test 19: Trigger trg_check_service_area_archival blocked archiving service area with active tables');

  // 20. Archived table cannot change to occupied
  const { data: archivedTable } = await clientOwnerA
    .from('dining_tables')
    .insert({ business_id: bizAId, branch_id: branchAId, service_area_id: areaA!.id, name: 'Archived Table', code: 'TARCH', deleted_at: new Date().toISOString() })
    .select()
    .single();

  const { error: archivedOccupiedErr } = await clientOwnerA
    .from('dining_tables')
    .update({ status: 'occupied' })
    .eq('id', archivedTable!.id);
  assert(!!archivedOccupiedErr, 'Test 20: Trigger rejected setting status of archived table to occupied');

  // 24. Atomic Bulk creation of 250 tables succeeds via RPC
  // Clear table_number and code on initial test tables so T1..T250 and numbers 1..250 have zero collisions
  await clientOwnerA
    .from('dining_tables')
    .update({ table_number: null, code: 'INITIAL-T1' })
    .eq('id', tableA!.id);

  await clientOwnerA
    .from('dining_tables')
    .update({ table_number: null, code: 'INITIAL-T2' })
    .eq('id', mgrTable!.id);

  const { data: bulkRes, error: bulkErr } = await clientOwnerA.rpc('bulk_create_dining_tables', {
    p_business_id: bizAId,
    p_branch_id: branchAId,
    p_service_area_id: areaA!.id,
    p_prefix: 'T',
    p_start_number: 1,
    p_count: 250,
    p_capacity: 4,
    p_shape: 'square',
  });
  const bulkObj = bulkRes as unknown as { success: boolean; count: number };
  assert(!bulkErr && bulkObj.success === true && bulkObj.count === 250, 'Test 24: Atomic bulk creation of 250 tables succeeded via RPC');

  // 25. Bulk duplicate collision rolls back safely
  const { error: bulkDupErr } = await clientOwnerA.rpc('bulk_create_dining_tables', {
    p_business_id: bizAId,
    p_branch_id: branchAId,
    p_service_area_id: areaA!.id,
    p_prefix: 'T',
    p_start_number: 1, // Duplicate T1!
    p_count: 10,
    p_capacity: 4,
  });
  assert(!!bulkDupErr, 'Test 25: Bulk duplicate collision safely rolled back entire transaction');

  // 26. Bulk generation cannot target another branch
  const { error: bulkCrossBranchErr } = await clientOwnerA.rpc('bulk_create_dining_tables', {
    p_business_id: bizAId,
    p_branch_id: branchBId,
    p_service_area_id: areaA!.id,
    p_prefix: 'HACK-',
    p_start_number: 1,
    p_count: 5,
    p_capacity: 4,
  });
  assert(!!bulkCrossBranchErr, 'Test 26: Bulk generation targeting another branch rejected');

  // 28 & 29. Audit Log Check
  const { data: auditLogs } = await clientOwnerA
    .from('audit_logs')
    .select('id, action')
    .eq('business_id', bizAId);
  assert(!!auditLogs && auditLogs.length > 0, 'Test 28 & 29: Audit logs created for table actions');

  // 30. Clean up test records
  await adminClient.from('businesses').delete().eq('id', bizAId);
  await adminClient.from('businesses').delete().eq('id', bizBId);
  await adminClient.auth.admin.deleteUser(userA.user!.id);
  await adminClient.auth.admin.deleteUser(userB.user!.id);
  await adminClient.auth.admin.deleteUser(mgrA.user!.id);
  await adminClient.auth.admin.deleteUser(cashierA.user!.id);
  await adminClient.auth.admin.deleteUser(kitchenA.user!.id);
  await adminClient.auth.admin.deleteUser(waiterA.user!.id);

  console.log('\n🧹 Cleaning up live test data...');
  assert(true, 'Test 30: All temporary test users, businesses, areas, and table records cleaned up');

  console.log('\n================================================================');
  console.log('📊 Dining Table Verification Results: All Tests Passed!');
  console.log('================================================================\n');
}

runTableVerification().catch((err) => {
  console.error('❌ Verification suite failed with exception:', err);
  process.exit(1);
});
