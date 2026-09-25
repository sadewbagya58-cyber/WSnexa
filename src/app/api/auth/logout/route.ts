import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCanonicalAppUrl } from '@/lib/utils/canonical-url';

/**
 * POST /api/auth/logout — Canonical server-side sign-out.
 * All UI logout controls must use a <form method="POST"> to hit this endpoint.
 */
export async function POST(request: Request) {
  const canonicalOrigin = getCanonicalAppUrl(request);
  const supabase = await createClient();

  await supabase.auth.signOut();

  return NextResponse.redirect(`${canonicalOrigin}/login`, {
    status: 303, // See Other: forces GET request on redirect
  });
}

/**
 * GET /api/auth/logout — Safety-net redirect.
 * No UI should navigate here via GET, but if it does (e.g. stale bookmark,
 * cached link) we sign the user out and redirect cleanly instead of 405-ing.
 */
export async function GET(request: Request) {
  const canonicalOrigin = getCanonicalAppUrl(request);
  const supabase = await createClient();

  await supabase.auth.signOut();

  return NextResponse.redirect(`${canonicalOrigin}/login`, {
    status: 303,
  });
}

