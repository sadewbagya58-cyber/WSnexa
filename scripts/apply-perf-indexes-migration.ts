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
    console.error('DATABASE_URL or POSTGRES_URL not set in environment.');
    process.exit(1);
  }

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected to PostgreSQL database.');

  const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '20260830000000_performance_indexes.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Applying performance indexes migration...');
  await client.query(sql);
  console.log('✅ Migration 20260830000000_performance_indexes.sql applied successfully.');
  await client.end();
}

runMigration().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
