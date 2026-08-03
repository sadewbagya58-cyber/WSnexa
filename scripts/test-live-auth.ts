import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

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

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

async function runLiveTest() {
  console.log('📡 Testing Live Supabase Project Connection via Admin API...');
  console.log('URL:', supabaseUrl);

  const testEmail = `live.test.${Date.now()}@gmail.com`;
  const testPassword = 'Password123!';

  console.log('\n--- 1. Testing Admin User Registration (Bypasses rate limit) ---');
  console.log(`Creating test user: ${testEmail}`);

  const { data: signUpData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: {
      first_name: 'TestFirst',
      last_name: 'TestLast',
    },
  });

  if (signUpError) {
    console.error('❌ Admin CreateUser Error:', signUpError.message);
    return;
  }

  const userId = signUpData.user?.id;
  console.log('✅ Admin CreateUser successful! Auth User ID:', userId);

  console.log('\n--- 2. Testing user_profiles table existence & Trigger ---');
  if (userId) {
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.log('⚠️ user_profiles query response:', profileError.message);
      if (profileError.message.includes('does not exist') || profileError.message.includes('schema cache')) {
        console.log('🔴 user_profiles table needs to be created in Supabase database!');
      }
    } else {
      console.log('🎉 Profile automatically created by PostgreSQL trigger!');
      console.log('Profile details:', profile);
    }

    // Clean up test user
    console.log('\n--- Cleaning up test user ---');
    await supabaseAdmin.auth.admin.deleteUser(userId);
    console.log('✅ Test user cleaned up.');
  }
}

runLiveTest().catch(console.error);
