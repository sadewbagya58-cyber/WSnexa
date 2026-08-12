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

async function runPgMigration() {
  console.log('--- Executing Phase 23 DDL Migration via pg ---');
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not found in .env.local!');
    process.exit(1);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  await client.query(`
    ALTER TABLE venue_public_profiles ADD COLUMN IF NOT EXISTS booking_url TEXT DEFAULT NULL;
    ALTER TABLE venue_public_profiles ADD COLUMN IF NOT EXISTS agoda_url TEXT DEFAULT NULL;
    ALTER TABLE venue_public_profiles ADD COLUMN IF NOT EXISTS external_booking_url TEXT DEFAULT NULL;
    CREATE INDEX IF NOT EXISTS idx_venue_profiles_coords ON venue_public_profiles(latitude, longitude) WHERE is_published = true;
    CREATE INDEX IF NOT EXISTS idx_branches_coords ON branches(latitude, longitude) WHERE status = 'active';
  `);

  console.log('✅ Phase 23 migration DDL successfully applied to PostgreSQL database!');
  await client.end();
}

runPgMigration().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
