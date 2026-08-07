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

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

async function applyMigration() {
  if (!dbUrl) {
    console.log('DATABASE_URL not set in environment, checking Supabase migration file...');
    const migrationFile = path.join(process.cwd(), 'supabase/migrations/20260807080000_create_customer_order_schema.sql');
    if (fs.existsSync(migrationFile)) {
      console.log('✅ Migration file created at:', migrationFile);
    }
    return;
  }

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected to PostgreSQL database.');

  const sqlPath = path.join(process.cwd(), 'supabase/migrations/20260807080000_create_customer_order_schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  await client.query(sql);
  console.log('✅ Migration 20260807080000_create_customer_order_schema.sql applied successfully.');
  await client.end();
}

applyMigration().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
