/**
 * Image Optimizer Utility for WSNexa Public Menus
 *
 * Prevents mobile devices from downloading original 4K/multi-megabyte
 * imagery for 80-160px card thumbnails during scroll.
 */

export function getMenuThumbnailUrl(url: string | null | undefined, targetWidth: number = 160): string | null {
  if (!url) return null;

  try {
    // Unsplash
    if (url.includes('images.unsplash.com')) {
      const u = new URL(url);
      u.searchParams.set('w', String(targetWidth));
      u.searchParams.set('q', '75');
      u.searchParams.set('auto', 'format');
      return u.toString();
    }

    // Pexels
    if (url.includes('images.pexels.com')) {
      const u = new URL(url);
      u.searchParams.set('auto', 'compress');
      u.searchParams.set('cs', 'tinysrgb');
      u.searchParams.set('w', String(targetWidth));
      return u.toString();
    }

    // Supabase Storage Render/Transform
    if (url.includes('/storage/v1/object/public/')) {
      return (
        url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/') +
        `?width=${targetWidth}&quality=75&resize=contain`
      );
    }

    // Cloudinary
    if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
      return url.replace('/upload/', `/upload/w_${targetWidth},c_limit,q_auto,f_auto/`);
    }

    return url;
  } catch {
    return url;
  }
}
