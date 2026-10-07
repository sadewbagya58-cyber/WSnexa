/**
 * Image Optimizer Utility for WSNexa Public Menus
 *
 * Prevents mobile devices from downloading original 4K/multi-megabyte
 * imagery for 80-160px card thumbnails during scroll.
 */

/**
 * Resolves any menu image representation (absolute URL, Supabase storage path, etc.)
 * into a safe, valid browser-loadable URL.
 */
export function resolveMenuImageUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Case 1: Already an absolute HTTP/HTTPS URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    // If it was inadvertently saved or formatted with the forbidden /render/image/ endpoint,
    // normalize back to the working /object/public/ endpoint.
    if (trimmed.includes('/storage/v1/render/image/public/')) {
      return trimmed.replace('/storage/v1/render/image/public/', '/storage/v1/object/public/').split('?')[0];
    }
    return trimmed;
  }

  // Case 2: Supabase Storage relative path (e.g. "menu-items/..." or "/menu-items/...")
  const cleanPath = trimmed.replace(/^\/+/, '');
  if (cleanPath.startsWith('menu-items/') || cleanPath.startsWith('logos/')) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wfdzjyhgcrcgnjtfgoef.supabase.co';
    return `${supabaseUrl}/storage/v1/object/public/business-assets/${cleanPath}`;
  }

  // Case 3: Leading /storage/v1/ path
  if (trimmed.startsWith('/storage/v1/')) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wfdzjyhgcrcgnjtfgoef.supabase.co';
    return `${supabaseUrl}${trimmed}`;
  }

  return null;
}

export function getMenuThumbnailUrl(url: string | null | undefined, targetWidth: number = 160): string | null {
  const resolved = resolveMenuImageUrl(url);
  if (!resolved) return null;

  try {
    // Unsplash
    if (resolved.includes('images.unsplash.com')) {
      const u = new URL(resolved);
      u.searchParams.set('w', String(targetWidth));
      u.searchParams.set('q', '75');
      u.searchParams.set('auto', 'format');
      return u.toString();
    }

    // Pexels
    if (resolved.includes('images.pexels.com')) {
      const u = new URL(resolved);
      u.searchParams.set('auto', 'compress');
      u.searchParams.set('cs', 'tinysrgb');
      u.searchParams.set('w', String(targetWidth));
      return u.toString();
    }

    // Cloudinary
    if (resolved.includes('res.cloudinary.com') && resolved.includes('/upload/')) {
      return resolved.replace('/upload/', `/upload/w_${targetWidth},c_limit,q_auto,f_auto/`);
    }

    // NOTE: On Supabase Storage, transformation via /storage/v1/render/image/public/
    // requires a paid Pro plan add-on. If disabled, it returns 403 Forbidden.
    // We serve the authoritative public object URL directly, which returns 200 OK.
    return resolved;
  } catch {
    return resolved;
  }
}
