import { PRODUCTION_CANONICAL_URL } from '@/lib/utils/canonical-url';
import { OFFICIAL_BUSINESS_INFO } from '@/content/legal/registry';
import { SUBSCRIPTION_PRICING_CONFIG } from '@/lib/config/subscription-plans';
import { VenuePublicProfileRecord } from '@/server/services/venue-discovery.service';

/**
 * Creates Schema.org Organization structured data for WSNexa.
 */
export function createOrganizationSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: OFFICIAL_BUSINESS_INFO.brand,
    url: PRODUCTION_CANONICAL_URL,
    logo: `${PRODUCTION_CANONICAL_URL}/brand/wsnexa-full-logo.png`,
    description: `${OFFICIAL_BUSINESS_INFO.tagline} Multi-tenant hospitality operating system.`,
    email: OFFICIAL_BUSINESS_INFO.supportEmail,
    telephone: OFFICIAL_BUSINESS_INFO.phone,
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Panawewa',
      addressLocality: 'Bingiriya',
      addressCountry: 'LK',
    },
    slogan: OFFICIAL_BUSINESS_INFO.tagline,
  };
}

/**
 * Creates Schema.org SoftwareApplication structured data for WSNexa SaaS.
 */
export function createSoftwareApplicationSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: OFFICIAL_BUSINESS_INFO.brand,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web, Android',
    description:
      'Multi-tenant Hospitality Operating System for restaurants, cafes, resorts, food courts, and hospitality venues.',
    offers: {
      '@type': 'Offer',
      price: String(SUBSCRIPTION_PRICING_CONFIG.starterMonthlyLkr),
      priceCurrency: 'LKR',
      category: 'Subscription',
      availability: 'https://schema.org/InStock',
    },
  };
}

/**
 * Maps database venue_type to appropriate Schema.org LocalBusiness subtype.
 */
function resolveSchemaVenueType(venueType?: string): string {
  switch (venueType) {
    case 'restaurant':
      return 'Restaurant';
    case 'cafe':
      return 'CafeOrCoffeeShop';
    case 'hotel':
      return 'Hotel';
    case 'resort':
      return 'Resort';
    case 'villa':
      return 'LodgingBusiness';
    case 'guest_house':
      return 'BedAndBreakfast';
    case 'food_court':
    case 'cloud_kitchen':
      return 'FoodEstablishment';
    default:
      return 'LocalBusiness';
  }
}

/**
 * Creates Schema.org LocalBusiness (Restaurant / Cafe / Hotel) structured data for a verified public venue.
 *
 * Strictly adheres to accuracy guidelines: does not fabricate ratings, prices, or missing contact info.
 */
export function createVenueSchema(venue: VenuePublicProfileRecord): Record<string, unknown> {
  const schemaType = resolveSchemaVenueType(venue.venue_type);
  const venueUrl = `${PRODUCTION_CANONICAL_URL}/venues/${venue.slug}`;

  const priceLevelMap: Record<number, string> = {
    1: '$',
    2: '$$',
    3: '$$$',
    4: '$$$$',
  };

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': schemaType,
    name: venue.display_name,
    url: venueUrl,
  };

  if (venue.short_description || venue.description) {
    schema.description = venue.short_description || venue.description;
  }

  if (venue.cover_image_url || venue.logo_url) {
    schema.image = venue.cover_image_url || venue.logo_url;
  }

  if (venue.phone_public) {
    schema.telephone = venue.phone_public;
  }

  if (venue.email_public) {
    schema.email = venue.email_public;
  }

  if (venue.website_url) {
    schema.sameAs = venue.website_url;
  }

  if (venue.price_level && priceLevelMap[venue.price_level]) {
    schema.priceRange = priceLevelMap[venue.price_level];
  }

  // Address
  const address: Record<string, string> = {
    '@type': 'PostalAddress',
    addressLocality: venue.city,
    addressCountry: venue.country || 'LK',
  };
  if (venue.address_public) {
    address.streetAddress = venue.address_public;
  }
  schema.address = address;

  // Geographic coordinates
  if (venue.latitude != null && venue.longitude != null) {
    schema.geo = {
      '@type': 'GeoCoordinates',
      latitude: venue.latitude,
      longitude: venue.longitude,
    };
  }

  // Real aggregate rating (only output if genuine reviews exist)
  if (
    typeof venue.review_count === 'number' &&
    venue.review_count > 0 &&
    typeof venue.average_rating === 'number' &&
    venue.average_rating > 0
  ) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: venue.average_rating,
      reviewCount: venue.review_count,
      bestRating: 5,
      worstRating: 1,
    };
  }

  // Menu link
  if (venue.public_menu_enabled !== false) {
    schema.hasMenu = `${venueUrl}/menu`;
  }

  // Reservations
  if (venue.public_reservations_enabled !== false) {
    schema.acceptsReservations = 'True';
    schema.potentialAction = {
      '@type': 'ReserveAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${venueUrl}/reserve`,
        actionPlatform: [
          'http://schema.org/DesktopWebPlatform',
          'http://schema.org/MobileWebPlatform',
        ],
      },
      result: {
        '@type': 'FoodEstablishmentReservation',
        name: `Table Reservation at ${venue.display_name}`,
      },
    };
  }

  return schema;
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

/**
 * Creates Schema.org BreadcrumbList structured data.
 */
export function createBreadcrumbSchema(items: BreadcrumbItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${PRODUCTION_CANONICAL_URL}${item.url}`,
    })),
  };
}
