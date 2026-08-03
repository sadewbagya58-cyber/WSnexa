import { createBrowserClient } from '@supabase/ssr';
import { env } from '@/lib/validation/env';

/**
 * Creates a browser-side Supabase client for Client Components.
 * Uses cookie storage provided automatically by @supabase/ssr in browser contexts.
 */
export function createClient() {
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
