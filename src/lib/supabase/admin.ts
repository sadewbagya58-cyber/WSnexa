import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/validation/env';

/**
 * Admin / Service-Role Supabase Client with full database access.
 * MUST NEVER BE IMPORTED IN CLIENT COMPONENTS.
 * Enforced at compile-time via `import 'server-only'`.
 */
export function createAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is missing.');
  }

  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}
