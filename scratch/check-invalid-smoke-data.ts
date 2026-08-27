import fs from 'fs';
import path from 'path';

// Bypass server-only guard for direct tsx execution
try {
  /* eslint-disable-next-line @typescript-eslint/ban-ts-comment */
  // @ts-ignore
  require.cache[require.resolve('server-only')] = {
    id: require.resolve('server-only'),
    filename: require.resolve('server-only'),
    loaded: true,
    exports: {},
  };
} catch {}

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

async function inspectInvalidSmokeRecords() {
  const { createAdminClient } = await import('@/lib/supabase/server');
  const admin = createAdminClient();

  const { data: rows, error } = await admin
    .from('reservations')
    .select('id, confirmation_code, guest_name, status, reservation_start_at, created_at')
    .or('guest_name.ilike.%Past Reservation Test%,guest_name.ilike.%Smoke Test%,guest_name.ilike.%Invalid Party Test%,guest_name.ilike.%Jane Doe (Staff Test)%')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to query smoke records:', error.message);
    return;
  }

  console.log('\n--- IDENTIFIED SMOKE HARNESS TEST RECORDS ---');
  console.log(`Found ${rows?.length || 0} smoke test reservation records in database:\n`);

  if (rows && rows.length > 0) {
    console.table(rows);
    console.log('\n--- OPTIONAL MANUAL CLEANUP SQL ---');
    console.log(`DELETE FROM public.reservations WHERE id IN (${rows.map((r) => `'${r.id}'`).join(', ')});`);
  } else {
    console.log('No invalid smoke harness records found.');
  }
}

inspectInvalidSmokeRecords().catch(console.error);
