import { HelpArticle } from '../types';

export const TROUBLESHOOTING_ARTICLES: HelpArticle[] = [
  {
    slug: 'troubleshooting-qr-code-issues',
    title: 'Troubleshooting: My QR Code Is Not Working or Scanning',
    description: 'Practical steps to diagnose and fix QR code camera scan issues, expired tokens, or wrong table redirects.',
    category: 'troubleshooting',
    keywords: ['qr not working', 'camera scan error', 'invalid qr', 'qr session expired', 'qr token', 'troubleshoot qr'],
    troubleshooting: true,
    popular: true,
    estimatedReadMinutes: 3,
    steps: [
      {
        number: 1,
        title: 'Check Print Quality & Lighting',
        instruction: 'Ensure the QR code print is clean, unblurred, and well-lit. Smudged acrylic stands or reflective glossy paper can interfere with phone camera autofocus.',
      },
      {
        number: 2,
        title: 'Verify Table Exists & Is Active',
        instruction: 'Go to "/dashboard/dining" and verify that the table corresponding to the QR code has not been deleted or reassigned to a deleted branch.',
      },
      {
        number: 3,
        title: 'Regenerate QR Token if Tampered',
        instruction: 'If a QR token shows "QR Session Expired" or was reset, visit "/dashboard/tables/qr" and click "Regenerate QR Codes" to print a fresh, secure batch.',
      },
      {
        number: 4,
        title: 'Test Direct URL Scan',
        instruction: 'Scan the QR code with your phone camera. It should open a URL formatted like `https://your-domain/m/[token]`. If it fails, check your mobile Wi-Fi or data connection.',
      },
    ],
    notes: [
      'Guests do not need to download an app; standard iOS Camera and Android Lens scan WSNexa QR codes natively.',
    ],
    relatedArticles: ['generating-and-printing-qr-codes', 'understanding-table-security-and-pins', 'troubleshooting-guest-cannot-place-order'],
    directAction: {
      label: 'Open QR Generator',
      href: '/dashboard/tables/qr',
    },
  },
  {
    slug: 'troubleshooting-guest-cannot-place-order',
    title: 'Troubleshooting: Customer Cannot Place an Order at Checkout',
    description: 'Why guest checkout might be blocked: table PIN requirement, customer sign-in gate, or device location check.',
    category: 'troubleshooting',
    keywords: ['cannot place order', 'checkout blocked', 'submit order failed', 'order blocked', 'location error', 'sign in required'],
    troubleshooting: true,
    popular: true,
    estimatedReadMinutes: 3,
    steps: [
      {
        number: 1,
        title: 'Check If Customer Account Is Required',
        instruction: 'If your branch operates on Balanced or High Security, guests must create or log into a customer account before placing orders. The checkout button will prompt "Sign in Required to Place Order".',
      },
      {
        number: 2,
        title: 'Check Table Access Verification',
        instruction: 'If "Require Table Selection / Table PIN" is enabled, verify the guest entered the 4-digit PIN for their physical table.',
      },
      {
        number: 3,
        title: 'Check Device Location Verification',
        instruction: 'If "Require Location Verification" is enabled, the guest must grant browser GPS permissions and be within the configured meter radius of the venue.',
        tip: 'If a guest has GPS issues on an older phone, a waiter can take the order directly using the Waiter POS tablet.',
      },
      {
        number: 4,
        title: 'Review Active Order Security Settings',
        instruction: 'Managers can adjust or relax security rules under "/dashboard/settings/order-security".',
      },
    ],
    notes: [
      'Orders placed by staff via Waiter POS bypass all guest security barriers.',
    ],
    relatedArticles: ['understanding-order-security-levels', 'device-location-verification-guide', 'taking-table-orders-as-a-waiter'],
    directAction: {
      label: 'Review Order Security',
      href: '/dashboard/settings/order-security',
    },
  },
  {
    slug: 'troubleshooting-order-not-reaching-kitchen',
    title: 'Troubleshooting: Order Is Not Reaching the Kitchen Display',
    description: 'Diagnose why a customer\'s placed order is not appearing on the kitchen queue screen.',
    category: 'troubleshooting',
    keywords: ['order not reaching kitchen', 'kitchen missing order', 'waiter approval missing', 'kds not updating', 'ticket delayed'],
    troubleshooting: true,
    popular: true,
    estimatedReadMinutes: 3,
    steps: [
      {
        number: 1,
        title: 'Check if Waiter Approval Is Required',
        instruction: 'The most common cause: if "Require Waiter Approval" is enabled in Order Security, the order is currently sitting in the Waiter\'s "Pending Approvals" list. It will NOT appear in the kitchen until the waiter clicks "Approve".',
      },
      {
        number: 2,
        title: 'Check Active Branch Filter in Kitchen Display',
        instruction: 'Ensure the kitchen display monitor is set to the correct branch outlet matching the table where the order was placed.',
      },
      {
        number: 3,
        title: 'Verify Internet Connection',
        instruction: 'Check if the kitchen tablet or monitor has an active network connection. The realtime connection indicator at the top should show "Connected".',
      },
    ],
    notes: [
      'Once a waiter approves an order, it appears on the kitchen display in less than 1 second.',
    ],
    relatedArticles: ['approving-and-rejecting-guest-orders', 'kitchen-queue-overview', 'understanding-order-security-levels'],
    directAction: {
      label: 'Open Waiter Approvals',
      href: '/dashboard/waiter',
    },
  },
  {
    slug: 'troubleshooting-waiter-cannot-see-request',
    title: 'Troubleshooting: Waiter Cannot See Table Requests or Approvals',
    description: 'Why a waiter\'s screen might not display a seated guest\'s assistance call or order approval notification.',
    category: 'troubleshooting',
    keywords: ['waiter cannot see requests', 'area assignment issue', 'missing approvals', 'waiter routing', 'zone filter'],
    troubleshooting: true,
    estimatedReadMinutes: 3,
    steps: [
      {
        number: 1,
        title: 'Check Waiter Service Area Filter',
        instruction: 'On the Waiter dashboard (/dashboard/waiter), look at the Area Filter dropdown at the top. If it is set to a specific zone (e.g. "Patio"), the waiter will not see alerts from "Main Dining". Set it to "All Areas".',
      },
      {
        number: 2,
        title: 'Verify Staff Service Area Assignment',
        instruction: 'Managers can check "/dashboard/tables/areas" to verify which service areas the waiter is assigned to.',
      },
      {
        number: 3,
        title: 'Check Table Area Assignment',
        instruction: 'Ensure the table that scanned the QR code belongs to a valid service area in "/dashboard/dining".',
      },
    ],
    notes: [
      'Waiters with no assigned areas receive notifications for all tables in the branch by default.',
    ],
    relatedArticles: ['assigning-waiters-to-service-areas', 'understanding-roles-vs-service-areas', 'waiter-dashboard-overview'],
    directAction: {
      label: 'Check Service Areas',
      href: '/dashboard/tables/areas',
    },
  },
  {
    slug: 'troubleshooting-staff-invitation-issues',
    title: 'Troubleshooting: Staff Member Cannot Accept Invitation or Login',
    description: 'How to handle expired invitation links, duplicate accounts, or branch permission access errors.',
    category: 'troubleshooting',
    keywords: ['invitation expired', 'staff cannot login', 'invite link error', 'resend invite', 'permission denied'],
    troubleshooting: true,
    estimatedReadMinutes: 3,
    steps: [
      {
        number: 1,
        title: 'Check Invitation Status',
        instruction: 'Go to "/dashboard/team/invites" and find the staff member\'s email. If the status is "Expired" or "Cancelled", click "Resend Invitation".',
      },
      {
        number: 2,
        title: 'Share Direct Link',
        instruction: 'Copy the direct invitation URL and send it to the employee via chat or messaging app in case their email provider marked the email as spam.',
      },
      {
        number: 3,
        title: 'Verify Correct Email Address',
        instruction: 'Ensure the employee registers or logs in with the EXACT same email address where the invitation was issued.',
      },
      {
        number: 4,
        title: 'Check Member Status',
        instruction: 'If the user accepted the invite but cannot access features, check "/dashboard/team" to ensure their account is not "Suspended".',
      },
    ],
    notes: [
      'Staff invitations expire after 7 days for security.',
    ],
    relatedArticles: ['inviting-and-managing-staff-members', 'understanding-roles-vs-service-areas'],
    directAction: {
      label: 'Open Staff Invites',
      href: '/dashboard/team/invites',
    },
  },
  {
    slug: 'troubleshooting-venue-publication',
    title: 'Troubleshooting: Venue Cannot Be Published (Location Gate)',
    description: 'Resolve missing address, city, country, or coordinate errors that prevent public venue publishing.',
    category: 'troubleshooting',
    keywords: ['cannot publish venue', 'publication gate error', 'missing coordinates', 'location missing', 'publish error'],
    troubleshooting: true,
    estimatedReadMinutes: 3,
    steps: [
      {
        number: 1,
        title: 'Inspect Missing Location Fields',
        instruction: 'When you attempt to publish, WSNexa verifies 5 mandatory fields: Address Line 1, City, Country, Latitude, and Longitude.',
      },
      {
        number: 2,
        title: 'Set Location Coordinates',
        instruction: 'On the Venue Profile page (/dashboard/venue-profile), click "Use Current Location" or click on the map to place your pin.',
      },
      {
        number: 3,
        title: 'Save Profile & Toggle Publish',
        instruction: 'Click "Save Profile", then toggle the "Publish Venue" switch. Your venue will now successfully go live.',
      },
    ],
    notes: [
      'Super Admin platform safety requires valid branch coordinates to prevent ghost venues from polluting the public discovery engine.',
    ],
    relatedArticles: ['publishing-your-venue-checklist', 'setting-up-public-venue-profile'],
    directAction: {
      label: 'Open Venue Profile',
      href: '/dashboard/venue-profile',
    },
  },
  {
    slug: 'troubleshooting-location-verification',
    title: 'Troubleshooting: Guest Location Verification Failing',
    description: 'Resolve GPS accuracy errors, permission denials, or radius mismatches during customer checkout.',
    category: 'troubleshooting',
    keywords: ['location failed', 'gps denied', 'outside radius', 'location error checkout', 'accuracy issue'],
    troubleshooting: true,
    estimatedReadMinutes: 3,
    steps: [
      {
        number: 1,
        title: 'Check Browser Location Permissions',
        instruction: 'Ensure the guest allows browser location access when prompted. On iOS Safari: Settings -> Safari -> Location -> Allow. On Android Chrome: Site Settings -> Location -> Allow.',
      },
      {
        number: 2,
        title: 'Verify Geolocation Radius Setting',
        instruction: 'In "/dashboard/settings/order-security", check the allowed radius. If your venue is large or has thick concrete walls, increase the radius to 200m–300m.',
      },
      {
        number: 3,
        title: 'Verify Branch Pin Accuracy',
        instruction: 'Check that your branch map pin in "/dashboard/venue-profile" is placed directly on your dining building, not miles away.',
      },
    ],
    notes: [
      'If a guest cannot enable GPS on their phone, waitstaff can place their order immediately via the Waiter POS screen.',
    ],
    relatedArticles: ['device-location-verification-guide', 'understanding-order-security-levels', 'taking-table-orders-as-a-waiter'],
    directAction: {
      label: 'Configure Order Security',
      href: '/dashboard/settings/order-security',
    },
  },
];
