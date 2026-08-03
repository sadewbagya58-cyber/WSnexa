import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Validates whether a redirect path is a safe internal relative path.
 * Prevents Open Redirect vulnerabilities.
 */
function getSafeRedirectUrl(next: string | null, origin: string): string {
  if (!next) {
    return `${origin}/dashboard`;
  }

  // Reject external protocols, protocol-relative URLs, and path traversal
  if (
    next.startsWith('//') ||
    next.includes(':\\') ||
    next.includes('://') ||
    !next.startsWith('/')
  ) {
    return `${origin}/dashboard`;
  }

  return `${origin}${next}`;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const safeRedirect = getSafeRedirectUrl(next, origin);
      return NextResponse.redirect(safeRedirect);
    }
  }

  // Return to login with error if code exchange fails or is invalid
  return NextResponse.redirect(`${origin}/login?error=Invalid+or+expired+auth+link`);
}
