import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Parse .env.local safely
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

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

async function runMigration() {
  if (!dbUrl) {
    console.log('DATABASE_URL or POSTGRES_URL not set in environment.');
    return;
  }

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected to PostgreSQL database.');

  const sqlPath = path.join(process.cwd(), 'supabase/migrations/20260910140000_qa11_item_cancellation_fix.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Applying QA-11 migration...');
  await client.query(sql);
  console.log('✅ Migration 20260910140000_qa11_item_cancellation_fix.sql applied successfully.');
  await client.end();
}

runMigration().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
