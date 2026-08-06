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

async function inspectSchema() {
  console.log('================================================================');
  console.log('         Live Database Schema Contract Inspection               ');
  console.log('================================================================\n');

  // Check business_memberships columns
  const { data: mem, error: memErr } = await admin.from('business_memberships').select('*').limit(1);
  if (memErr) console.log('business_memberships error:', memErr.message);
  else console.log('business_memberships columns:', Object.keys(mem[0] || {}));

  // Check dining_tables columns
  const { data: dt, error: dtErr } = await admin.from('dining_tables').select('*').limit(1);
  if (dtErr) console.log('dining_tables error:', dtErr.message);
  else console.log('dining_tables columns:', Object.keys(dt[0] || {}));

  // Check branches columns
  const { data: br, error: brErr } = await admin.from('branches').select('*').limit(1);
  if (brErr) console.log('branches error:', brErr.message);
  else console.log('branches columns:', Object.keys(br[0] || {}));

  // Check businesses columns
  const { data: biz, error: bizErr } = await admin.from('businesses').select('*').limit(1);
  if (bizErr) console.log('businesses error:', bizErr.message);
  else console.log('businesses columns:', Object.keys(biz[0] || {}));

  // Check if Phase 10 tables exist
  const [{ data: o }, { data: oi }, { data: oim }, { data: osh }, { data: boc }] = await Promise.all([
    admin.from('orders').select('id').limit(1),
    admin.from('order_items').select('id').limit(1),
    admin.from('order_item_modifiers').select('id').limit(1),
    admin.from('order_status_history').select('id').limit(1),
    admin.from('branch_order_counters').select('branch_id').limit(1),
  ]);

  console.log('\nPhase 10 Table Existence Status:');
  console.log('  - orders:', o !== null ? 'EXISTS' : 'NOT FOUND');
  console.log('  - order_items:', oi !== null ? 'EXISTS' : 'NOT FOUND');
  console.log('  - order_item_modifiers:', oim !== null ? 'EXISTS' : 'NOT FOUND');
  console.log('  - order_status_history:', osh !== null ? 'EXISTS' : 'NOT FOUND');
  console.log('  - branch_order_counters:', boc !== null ? 'EXISTS' : 'NOT FOUND');

  console.log('\n================================================================');
}

inspectSchema();
