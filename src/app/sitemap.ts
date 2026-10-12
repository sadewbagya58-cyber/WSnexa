import type { MetadataRoute } from 'next';
import { PRODUCTION_CANONICAL_URL } from '@/lib/utils/canonical-url';
import { getAllCategories, getAllArticles } from '@/content/help/registry';
import { LEGAL_DOCUMENTS } from '@/content/legal/registry';
import { createAdminClient } from '@/lib/supabase/server';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || PRODUCTION_CANONICAL_URL;
  const now = new Date();

  // 1. Core Public Marketing & Discovery Pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/explore`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/status`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/help`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/legal`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/support/contact`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/support/report-problem`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${baseUrl}/security/report`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
  ];

  // 2. Help Center Categories
  const categoryPages: MetadataRoute.Sitemap = getAllCategories().map((cat) => ({
    url: `${baseUrl}/help/category/${cat.id}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  // 3. Help Center Knowledge Base Articles
  const articlePages: MetadataRoute.Sitemap = getAllArticles().map((article) => ({
    url: `${baseUrl}/help/${article.slug}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  // 4. Legal Compliance Documents
  const legalPages: MetadataRoute.Sitemap = LEGAL_DOCUMENTS.map((doc) => ({
    url: `${baseUrl}/legal/${doc.slug}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.5,
  }));

  // 5. Dynamic Published Venues (Profiles, Public Menus, and Public Table Reservation pages)
  const venuePages: MetadataRoute.Sitemap = [];
  try {
    const admin = createAdminClient();
    const { data: venues, error } = await admin
      .from('venue_public_profiles')
      .select('slug, updated_at, is_published, public_menu_enabled, public_reservations_enabled, businesses!inner(status)')
      .eq('is_published', true)
      .neq('businesses.status', 'suspended');

    if (!error && venues && Array.isArray(venues)) {
      for (const venue of venues) {
        if (!venue.slug) continue;
        const lastMod = venue.updated_at ? new Date(venue.updated_at) : now;

        // Venue Public Profile
        venuePages.push({
          url: `${baseUrl}/venues/${venue.slug}`,
          lastModified: lastMod,
          changeFrequency: 'weekly',
          priority: 0.8,
        });

        // Venue Digital Menu (only if public menu is enabled)
        if (venue.public_menu_enabled !== false) {
          venuePages.push({
            url: `${baseUrl}/venues/${venue.slug}/menu`,
            lastModified: lastMod,
            changeFrequency: 'weekly',
            priority: 0.7,
          });
        }

        // Venue Table Reservation (only if reservations are enabled)
        if (venue.public_reservations_enabled !== false) {
          venuePages.push({
            url: `${baseUrl}/venues/${venue.slug}/reserve`,
            lastModified: lastMod,
            changeFrequency: 'weekly',
            priority: 0.6,
          });
        }
      }
    }
  } catch (err) {
    console.warn('[sitemap] Failed to fetch dynamic venue profiles for sitemap, continuing with static pages:', err);
  }

  return [
    ...staticPages,
    ...categoryPages,
    ...articlePages,
    ...legalPages,
    ...venuePages,
  ];
}
