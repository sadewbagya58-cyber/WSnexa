import { Client } from 'pg';
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

async function runDirectSql() {
  if (process.env.DATABASE_URL) {
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    const sqlPath = path.join(process.cwd(), 'supabase/migrations/20260807080000_create_customer_order_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await client.query(sql);
    console.log('✅ Applied Phase 16 Migration via pg client!');
    await client.end();
  } else {
    console.log('DB URL check complete.');
  }
}

runDirectSql().catch((e) => {
  console.log('Direct SQL error (expected if DATABASE_URL not set in local env):', e.message);
});
