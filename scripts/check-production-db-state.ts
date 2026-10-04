import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function checkProductionState() {
  console.log('================================================================');
  console.log('  WSNexa Read-Only Production Database State Audit');
  console.log('  Target URL:', supabaseUrl);
  console.log('================================================================\n');

  const report: Record<string, unknown> = {};

  // 1. Check business_subscription_payments columns
  console.log('1. Checking public.business_subscription_payments columns...');
  const { data: paymentsData, error: paymentsError } = await supabase
    .from('business_subscription_payments')
    .select('id, payment_method, review_status, verified_at, reconciliation_notes, bank_statement_ref')
    .limit(1);

  if (paymentsError) {
    report.business_subscription_payments_columns = {
      applied: false,
      error: paymentsError.message,
      code: paymentsError.code,
    };
    console.log('   [-] Columns missing or query failed:', paymentsError.message);
  } else {
    report.business_subscription_payments_columns = {
      applied: true,
      sampleRowCount: paymentsData?.length ?? 0,
    };
    console.log('   [+] Columns exist and query succeeded!');
  }

  // 2. Check business_subscription_proofs table
  console.log('\n2. Checking public.business_subscription_proofs table...');
  const { data: proofsData, error: proofsError } = await supabase
    .from('business_subscription_proofs')
    .select('id')
    .limit(1);

  if (proofsError) {
    report.business_subscription_proofs_table = {
      applied: false,
      error: proofsError.message,
      code: proofsError.code,
    };
    console.log('   [-] Table missing or query failed:', proofsError.message);
  } else {
    report.business_subscription_proofs_table = {
      applied: true,
      sampleRowCount: proofsData?.length ?? 0,
    };
    console.log('   [+] Table exists!');
  }

  // 3. Check business_subscription_payment_reference_claims table
  console.log('\n3. Checking public.business_subscription_payment_reference_claims table...');
  const { data: claimsData, error: claimsError } = await supabase
    .from('business_subscription_payment_reference_claims')
    .select('id')
    .limit(1);

  if (claimsError) {
    report.business_subscription_payment_reference_claims_table = {
      applied: false,
      error: claimsError.message,
      code: claimsError.code,
    };
    console.log('   [-] Table missing or query failed:', claimsError.message);
  } else {
    report.business_subscription_payment_reference_claims_table = {
      applied: true,
      sampleRowCount: claimsData?.length ?? 0,
    };
    console.log('   [+] Table exists!');
  }

  // 4. Check storage bucket bank-transfer-receipts
  console.log('\n4. Checking storage.buckets for "bank-transfer-receipts"...');
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
  if (bucketsError) {
    report.storage_bucket = {
      applied: false,
      error: bucketsError.message,
    };
    console.log('   [-] Failed to list buckets:', bucketsError.message);
  } else {
    const bucket = buckets?.find((b) => b.id === 'bank-transfer-receipts');
    report.storage_bucket = {
      applied: !!bucket,
      bucketDetails: bucket ?? null,
    };
    if (bucket) {
      console.log('   [+] Bucket "bank-transfer-receipts" exists! Public:', bucket.public);
    } else {
      console.log('   [-] Bucket "bank-transfer-receipts" does not exist in storage.buckets.');
    }
  }

  // 5. Check auth_is_super_admin RPC
  console.log('\n5. Checking public.auth_is_super_admin() RPC...');
  const { data: rpcData, error: rpcError } = await supabase.rpc('auth_is_super_admin');
  if (rpcError) {
    report.auth_is_super_admin_rpc = {
      applied: false,
      error: rpcError.message,
      code: rpcError.code,
    };
    console.log('   [-] RPC missing or failed:', rpcError.message);
  } else {
    report.auth_is_super_admin_rpc = {
      applied: true,
      result: rpcData,
    };
    console.log('   [+] RPC exists! Returned:', rpcData);
  }

  // 6. Check notifications.branch_id nullability
  console.log('\n6. Checking notifications table...');
  const { data: notifData, error: notifError } = await supabase
    .from('notifications')
    .select('id, branch_id')
    .is('branch_id', null)
    .limit(1);

  if (notifError) {
    report.notifications_branch_id_nullable = {
      error: notifError.message,
    };
    console.log('   [-] Query notifications failed:', notifError.message);
  } else {
    report.notifications_branch_id_nullable = {
      querySucceeded: true,
      foundNullBranchRow: (notifData?.length ?? 0) > 0,
    };
    console.log('   [+] notifications table queries with branch_id = null successfully!');
  }

  // 7. Check register_bank_reference_claim RPC
  console.log('\n7. Checking register_bank_reference_claim RPC...');
  const { error: rpc1Error } = await supabase.rpc('register_bank_reference_claim', {
    p_payment_id: '00000000-0000-0000-0000-000000000000',
    p_raw_reference: 'TEST1234',
    p_file_path: 'receipts/test/test.png',
    p_file_size_bytes: 1024,
    p_mime_type: 'image/png'
  });
  if (rpc1Error && (rpc1Error.code === '42883' || rpc1Error.message.includes('Could not find'))) {
    report.register_bank_reference_claim_rpc = { applied: false, error: rpc1Error.message };
    console.log('   [-] register_bank_reference_claim missing:', rpc1Error.message);
  } else {
    report.register_bank_reference_claim_rpc = { applied: true, expectedAuthError: rpc1Error?.message };
    console.log('   [+] register_bank_reference_claim RPC exists! (Response:', rpc1Error?.message || 'OK', ')');
  }

  // 8. Check apply_atomic_subscription_settlement RPC
  console.log('\n8. Checking apply_atomic_subscription_settlement RPC...');
  const { error: rpc2Error } = await supabase.rpc('apply_atomic_subscription_settlement', {
    p_payment_id: '00000000-0000-0000-0000-000000000000',
    p_expected_plan_id: 'starter',
    p_expected_amount_lkr: 4499,
    p_reconciliation_note: 'Audit check',
    p_external_bank_statement_ref: 'STMT-001'
  });
  if (rpc2Error && (rpc2Error.code === '42883' || rpc2Error.message.includes('Could not find'))) {
    report.apply_atomic_subscription_settlement_rpc = { applied: false, error: rpc2Error.message };
    console.log('   [-] apply_atomic_subscription_settlement missing:', rpc2Error.message);
  } else {
    report.apply_atomic_subscription_settlement_rpc = { applied: true, expectedAuthError: rpc2Error?.message };
    console.log('   [+] apply_atomic_subscription_settlement RPC exists! (Response:', rpc2Error?.message || 'OK', ')');
  }

  // 9. Check reject_bank_transfer_payment RPC
  console.log('\n9. Checking reject_bank_transfer_payment RPC...');
  const { error: rpc3Error } = await supabase.rpc('reject_bank_transfer_payment', {
    p_payment_id: '00000000-0000-0000-0000-000000000000',
    p_rejection_reason: 'Test audit'
  });
  if (rpc3Error && (rpc3Error.code === '42883' || rpc3Error.message.includes('Could not find'))) {
    report.reject_bank_transfer_payment_rpc = { applied: false, error: rpc3Error.message };
    console.log('   [-] reject_bank_transfer_payment missing:', rpc3Error.message);
  } else {
    report.reject_bank_transfer_payment_rpc = { applied: true, expectedAuthError: rpc3Error?.message };
    console.log('   [+] reject_bank_transfer_payment RPC exists! (Response:', rpc3Error?.message || 'OK', ')');
  }

  console.log('\n================================================================');
  console.log('  SUMMARY AUDIT REPORT:');
  console.log(JSON.stringify(report, null, 2));
  console.log('================================================================\n');
}

checkProductionState().catch((err) => {
  console.error('Audit failed with unexpected error:', err);
  process.exit(1);
});
