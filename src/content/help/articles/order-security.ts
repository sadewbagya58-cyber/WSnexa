import { HelpArticle } from '../types';

export const ORDER_SECURITY_ARTICLES: HelpArticle[] = [
  {
    slug: 'understanding-order-security-levels',
    title: 'Understanding Order Security Levels (Low, Balanced, High, Custom)',
    description: 'Learn how WSNexa protects restaurants from prank orders, ghost orders, and remote tampering while keeping dining smooth.',
    category: 'order-security',
    keywords: ['order security', 'security levels', 'low security', 'balanced security', 'high security', 'custom security', 'anti fraud'],
    allowedRoles: ['business_owner', 'branch_manager'],
    requiredPermissions: ['order_security.view'],
    contextRoutes: ['/dashboard/settings/order-security'],
    popular: true,
    gettingStarted: true,
    estimatedReadMinutes: 4,
    steps: [
      {
        number: 1,
        title: 'Open Order Security Hub',
        instruction: 'Navigate to "Order Security" under "SETTINGS" in the sidebar (/dashboard/settings/order-security).',
      },
      {
        number: 2,
        title: 'Choose a Preset Security Level',
        instruction: 'WSNexa provides 4 levels: "Low Security" (fastest guest checkout, zero gates, great for trusted venues), "Balanced Security" (recommended default: requires customer account login and waiter approval), "High Security" (enforces GPS geolocation verification, table PIN, and waiter approval), or "Custom" (fine-tune individual security toggles).',
      },
      {
        number: 3,
        title: 'Configure Waiter Approval Gate',
        instruction: 'When enabled, self-service QR orders do not go directly to the kitchen. Waitstaff must approve the order on their mobile screen first.',
      },
      {
        number: 4,
        title: 'Save Security Policy',
        instruction: 'Click "Save Security Settings". All rules are strictly enforced server-side for new orders.',
      },
    ],
    notes: [
      'Orders placed directly by authenticated waitstaff on Waiter POS bypass guest security gates automatically.',
    ],
    relatedArticles: ['device-location-verification-guide', 'understanding-table-security-and-pins', 'approving-and-rejecting-guest-orders'],
    directAction: {
      label: 'Order Security Settings',
      href: '/dashboard/settings/order-security',
    },
  },
  {
    slug: 'device-location-verification-guide',
    title: 'Configuring Device Location & Geolocation Radius',
    description: 'Enforce that guests must be physically present inside your restaurant or patio before they can submit digital orders.',
    category: 'order-security',
    keywords: ['geolocation', 'device location', 'location verification', 'radius', 'gps check', 'anti prank'],
    allowedRoles: ['business_owner', 'branch_manager'],
    requiredPermissions: ['order_security.view'],
    contextRoutes: ['/dashboard/settings/order-security'],
    estimatedReadMinutes: 3,
    steps: [
      {
        number: 1,
        title: 'Ensure Branch Coordinates Are Set',
        instruction: 'Verify your branch latitude and longitude are configured in the Public Venue Profile (/dashboard/venue-profile) or Branch Settings.',
      },
      {
        number: 2,
        title: 'Enable Location Verification',
        instruction: 'Under Order Security (/dashboard/settings/order-security), toggle "Require Device Location Verification".',
      },
      {
        number: 3,
        title: 'Set Geolocation Radius',
        instruction: 'Specify the allowed radius in meters (e.g., 100m or 250m) to accommodate guests dining in indoor and outdoor dining sections.',
        tip: 'Set a slightly larger radius (e.g. 150m–300m) if your restaurant is located inside a multi-story mall or building with weak GPS signals.',
      },
      {
        number: 4,
        title: 'Guest Checkout Experience',
        instruction: 'When the guest taps "Place Order", their browser prompts for location permission. WSNexa cryptographically validates the coordinates server-side before creating the order.',
      },
    ],
    notes: [
      'If a guest\'s device has location disabled or GPS is blocked, staff can still take their order directly using the Waiter POS.',
    ],
    relatedArticles: ['understanding-order-security-levels', 'setting-up-public-venue-profile', 'troubleshooting-location-verification'],
    directAction: {
      label: 'Configure Geolocation Security',
      href: '/dashboard/settings/order-security',
    },
  },
];
