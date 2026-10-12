import type { MetadataRoute } from 'next';
import { PRODUCTION_CANONICAL_URL } from '@/lib/utils/canonical-url';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || PRODUCTION_CANONICAL_URL;

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard/',
          '/admin/',
          '/customer/',
          '/m/',
          '/onboarding/',
          '/account/',
          '/api/',
          '/venues/*/reserve/confirmation/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
