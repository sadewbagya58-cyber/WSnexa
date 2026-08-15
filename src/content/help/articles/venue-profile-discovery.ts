import { HelpArticle } from '../types';

export const VENUE_PROFILE_DISCOVERY_ARTICLES: HelpArticle[] = [
  {
    slug: 'setting-up-public-venue-profile',
    title: 'Setting Up Your Public Venue Profile & Photos',
    description: 'Showcase your restaurant on WSNexa Explore with high-resolution logos, cover banners, culinary descriptions, and booking links.',
    category: 'venue-profile-discovery',
    keywords: ['venue profile', 'public profile', 'logo upload', 'cover photo', 'branding', 'booking url', 'discovery page'],
    allowedRoles: ['business_owner', 'branch_manager'],
    requiredPermissions: ['venue_profile.manage'],
    contextRoutes: ['/dashboard/venue-profile'],
    popular: true,
    gettingStarted: true,
    estimatedReadMinutes: 4,
    steps: [
      {
        number: 1,
        title: 'Open Public Venue Profile',
        instruction: 'Navigate to "Public Venue Profile" under "VENUE SETUP" in the dashboard sidebar (/dashboard/venue-profile).',
      },
      {
        number: 2,
        title: 'Upload Brand Logo & Cover Banner',
        instruction: 'Upload a square Logo (PNG/JPG/WEBP, up to 5MB) and an attractive wide Cover Banner that represents your dining ambiance.',
      },
      {
        number: 3,
        title: 'Write Venue Description & Features',
        instruction: 'Highlight your culinary style, signature drinks, dietary offerings (vegan, gluten-free, halal), and atmosphere.',
      },
      {
        number: 4,
        title: 'Attach External Booking Links (Optional)',
        instruction: 'Add your direct reservation URL, Booking.com link, or Agoda page if you operate within a hotel or resort.',
      },
      {
        number: 5,
        title: 'Save Profile Changes',
        instruction: 'Click "Save Profile". You can preview your live public venue page at `/venues/[your-slug]`.',
      },
    ],
    notes: [
      'Your venue slug is automatically generated from your venue name and can be customized.',
    ],
    relatedArticles: ['publishing-your-venue-checklist', 'managing-customer-reviews', 'how-customers-discover-venues'],
    directAction: {
      label: 'Open Venue Profile',
      href: '/dashboard/venue-profile',
    },
  },
  {
    slug: 'publishing-your-venue-checklist',
    title: 'Publishing Your Venue to the Discovery Directory',
    description: 'Understand the location validation gate (Address, City, Coordinates) and how to publish or unpublish your venue.',
    category: 'venue-profile-discovery',
    keywords: ['publish venue', 'unpublish', 'location gate', 'coordinates', 'google maps', 'discovery directory', 'launch'],
    allowedRoles: ['business_owner', 'branch_manager'],
    requiredPermissions: ['venue_profile.manage'],
    contextRoutes: ['/dashboard/venue-profile'],
    popular: true,
    gettingStarted: true,
    estimatedReadMinutes: 4,
    steps: [
      {
        number: 1,
        title: 'Understand the Publication Gate Requirements',
        instruction: 'To protect customer discovery quality and enable map search, WSNexa strictly requires 5 location fields before a venue can be published: Street Address, City, Country, Latitude, and Longitude.',
      },
      {
        number: 2,
        title: 'Use Interactive Map or Device Location',
        instruction: 'On the Venue Profile page (/dashboard/venue-profile), click "Use Current Location" to auto-fill your exact coordinates, or drag the Google Maps pin directly to your restaurant entrance.',
      },
      {
        number: 3,
        title: 'Toggle Publication Status',
        instruction: 'Once location coordinates are verified, click the "Publish Venue" toggle switch.',
      },
      {
        number: 4,
        title: 'Verify on Customer Explore Directory',
        instruction: 'Your restaurant will now appear in local nearby searches on `/explore` and customers can bookmark it to their favorites.',
      },
    ],
    notes: [
      'If you need to close temporarily for renovations, you can toggle your status to Unpublished without deleting any menu or table data.',
    ],
    relatedArticles: ['setting-up-public-venue-profile', 'how-customers-discover-venues', 'troubleshooting-venue-publication'],
    directAction: {
      label: 'Publish Venue',
      href: '/dashboard/venue-profile',
    },
  },
  {
    slug: 'managing-customer-reviews',
    title: 'Managing Verified Customer Reviews & Responses',
    description: 'Read reviews submitted by verified patrons who completed table orders and post official management replies.',
    category: 'venue-profile-discovery',
    keywords: ['reviews', 'ratings', 'customer feedback', 'verified reviews', 'owner response', 'reputation'],
    allowedRoles: ['business_owner', 'branch_manager'],
    requiredPermissions: ['reviews.respond'],
    contextRoutes: ['/dashboard/reviews', '/dashboard/reputation'],
    estimatedReadMinutes: 3,
    steps: [
      {
        number: 1,
        title: 'Open Customer Reviews Hub',
        instruction: 'Navigate to "Customer Reviews" under "GROWTH & GUESTS" in the sidebar (/dashboard/reviews).',
      },
      {
        number: 2,
        title: 'Inspect Verified Visit Reviews',
        instruction: 'WSNexa only permits reviews from authenticated customers who have a confirmed, completed dining order at your venue, completely eliminating fake review spam.',
      },
      {
        number: 3,
        title: 'Post an Official Management Response',
        instruction: 'Click "Respond to Review" on any patron review card. Enter your thoughtful reply and click "Post Response". Your reply will appear publicly under the review on your venue profile.',
      },
    ],
    notes: [
      'Average rating scores and review counts update automatically on your public venue page.',
    ],
    relatedArticles: ['setting-up-public-venue-profile', 'how-customers-discover-venues'],
    directAction: {
      label: 'View Reviews',
      href: '/dashboard/reviews',
    },
  },
  {
    slug: 'how-customers-discover-venues',
    title: 'How Customers Discover Venues & Save Favorites',
    description: 'How patrons explore nearby restaurants, filter by culinary category, view digital menus, and place orders.',
    category: 'venue-profile-discovery',
    keywords: ['explore', 'discovery', 'favorites', 'search venues', 'patron discovery', 'nearby restaurants'],
    estimatedReadMinutes: 3,
    steps: [
      {
        number: 1,
        title: 'Proximity-Based Nearby Search',
        instruction: 'When diners open `/explore`, WSNexa calculates distance using verified branch coordinates, highlighting the closest dining spots.',
      },
      {
        number: 2,
        title: 'Category & Cuisine Filtering',
        instruction: 'Guests filter by venue type (Cafe, Restaurant, Rooftop, Beach Bar) and dietary options.',
      },
      {
        number: 3,
        title: 'Customer Favorites Roster',
        instruction: 'Diners can tap the Heart icon on your venue card to save your restaurant to their personal Favorites list for quick re-ordering.',
      },
    ],
    notes: [
      'Keeping your menu up to date with mouth-watering photos increases engagement on the discovery page.',
    ],
    relatedArticles: ['setting-up-public-venue-profile', 'publishing-your-venue-checklist', 'managing-customer-reviews'],
    directAction: {
      label: 'Explore Directory',
      href: '/explore',
    },
  },
];
