import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { env } from '@/lib/validation/env';

/**
 * Creates a server-side Supabase client for Server Components, Route Handlers, and Server Actions.
 * Employs official @supabase/ssr cookie handler pattern with Next.js headers cookies API.
 */
export async function createClient() {
  try {
    const cookieStore = await cookies();

    return createServerClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if middleware is refreshing user sessions.
            }
          },
        },
      }
    );
  } catch {
    // Return a fallback client if called outside Next.js request scope (e.g., CLI test script context)
    return createServerClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return [];
          },
          setAll() {},
        },
      }
    );
  }
}

/**
 * Creates a service-role Supabase client that bypasses RLS for system operations.
 */
export function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is missing.');
  }

  return createSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    serviceKey,
    { auth: { persistSession: false } }
  );
}
