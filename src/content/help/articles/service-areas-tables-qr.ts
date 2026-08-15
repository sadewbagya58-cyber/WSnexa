import { HelpArticle } from '../types';

export const SERVICE_AREAS_TABLES_QR_ARTICLES: HelpArticle[] = [
  {
    slug: 'creating-service-areas-and-tables',
    title: 'Creating Service Areas, Floor Plans & Tables',
    description: 'Structure your physical dining layout into distinct areas (Main Dining, Terrace, Bar, Rooftop) and add numbered tables.',
    category: 'service-areas-tables-qr',
    keywords: ['service areas', 'areas', 'tables', 'floor plan', 'dining setup', 'add tables', 'bulk generator'],
    allowedRoles: ['business_owner', 'branch_manager'],
    requiredPermissions: ['areas.manage', 'tables.create'],
    contextRoutes: ['/dashboard/dining', '/dashboard/tables/areas', '/dashboard/tables/new', '/dashboard/tables/bulk'],
    popular: true,
    gettingStarted: true,
    estimatedReadMinutes: 4,
    steps: [
      {
        number: 1,
        title: 'Open Dining Setup',
        instruction: 'Navigate to "Dining Setup" under "VENUE SETUP" in the dashboard sidebar (/dashboard/dining).',
      },
      {
        number: 2,
        title: 'Create Your Service Areas',
        instruction: 'Click "Manage Areas" (/dashboard/tables/areas) and add your physical zones: e.g., "Ground Floor Dining", "Outdoor Patio", "VIP Lounge".',
        tip: 'Service Areas allow you to route waiter calls and kitchen dispatch specifically to the staff stationed in that zone.',
      },
      {
        number: 3,
        title: 'Add Dining Tables',
        instruction: 'You can add individual tables with "+ New Table" (/dashboard/tables/new) specifying Table Number, Seating Capacity, and Assigned Area, or use the "Bulk Generator" (/dashboard/tables/bulk) to generate 10–50 tables at once (e.g. Tables 1 to 20).',
      },
      {
        number: 4,
        title: 'Configure Optional Table PINs',
        instruction: 'If you want guests to verify physical table presence, you can assign a 4-digit PIN to each table.',
      },
    ],
    notes: [
      'Tables can be moved between service areas at any time without invalidating active QR codes.',
    ],
    relatedArticles: ['generating-and-printing-qr-codes', 'assigning-waiters-to-service-areas', 'understanding-table-security-and-pins'],
    directAction: {
      label: 'Open Dining Setup',
      href: '/dashboard/dining',
    },
  },
  {
    slug: 'generating-and-printing-qr-codes',
    title: 'Generating, Downloading & Printing QR Code Sheets',
    description: 'Generate high-resolution printable QR codes for individual tables, service zones, or branch-wide contactless ordering.',
    category: 'service-areas-tables-qr',
    keywords: ['qr code', 'generate qr', 'print qr', 'table qr', 'branch qr', 'stickers', 'download qr', 'pdf'],
    allowedRoles: ['business_owner', 'branch_manager'],
    requiredPermissions: ['qr.generate'],
    contextRoutes: ['/dashboard/tables/qr', '/dashboard/dining'],
    popular: true,
    gettingStarted: true,
    estimatedReadMinutes: 4,
    steps: [
      {
        number: 1,
        title: 'Open QR Generator Hub',
        instruction: 'Go to "Dining Setup" (/dashboard/dining) and click "QR Codes" or visit "/dashboard/tables/qr".',
      },
      {
        number: 2,
        title: 'Choose QR Code Type',
        instruction: 'Select between "Table-Specific QR Codes" (each table gets its own unique token that auto-selects the table for the guest) or "Branch General QR" (guests scan one central code and pick their table number).',
      },
      {
        number: 3,
        title: 'Preview QR Graphics',
        instruction: 'WSNexa provides clean, branded QR graphics with your venue name, table numbers, and "Scan to Order & Pay" guidance.',
      },
      {
        number: 4,
        title: 'Download or Print QR Sheets',
        instruction: 'Click "Print All Tables" or download individual high-resolution PNG/SVG files for custom acrylic stands or table stickers.',
        tip: 'Laminate your table QR cards or place them in transparent table-top acrylic holders to protect them from food and liquid spills.',
      },
    ],
    notes: [
      'If you ever suspect a QR code token has been compromised, you can regenerate security tokens from the QR generator hub.',
    ],
    relatedArticles: ['creating-service-areas-and-tables', 'understanding-table-security-and-pins', 'troubleshooting-qr-code-issues'],
    directAction: {
      label: 'Open QR Generator',
      href: '/dashboard/tables/qr',
    },
  },
  {
    slug: 'understanding-table-security-and-pins',
    title: 'Understanding Table Access PINs & Anti-Fake Ordering',
    description: 'How table access proofs prevent remote prank orders while maintaining friction-free dining.',
    category: 'service-areas-tables-qr',
    keywords: ['table pin', 'table proof', 'anti tamper', 'fake orders', 'security token', 'pin verification'],
    allowedRoles: ['business_owner', 'branch_manager'],
    requiredPermissions: ['order_security.view'],
    contextRoutes: ['/dashboard/settings/order-security', '/dashboard/dining'],
    estimatedReadMinutes: 4,
    steps: [
      {
        number: 1,
        title: 'How Table Verification Works',
        instruction: 'When a guest scans a table QR code, WSNexa establishes a cryptographic visit session. If Table PIN verification is enabled, the guest enters the 4-digit PIN printed on their table stand.',
      },
      {
        number: 2,
        title: 'Single-Entry Verification Proof',
        instruction: 'Guests only enter the PIN once per dining session. WSNexa securely signs the table access proof in browser storage, allowing seamless multi-item additions and checkouts without asking for the PIN again.',
      },
      {
        number: 3,
        title: 'Preventing Remote Table Hijacking',
        instruction: 'If someone screenshots the QR code and shares it online, remote users cannot order food to the table without knowing the physical PIN.',
      },
    ],
    notes: [
      'Table PINs are optional and can be toggled on or off under Order Security settings.',
    ],
    relatedArticles: ['understanding-order-security-levels', 'generating-and-printing-qr-codes', 'creating-service-areas-and-tables'],
    directAction: {
      label: 'Order Security Settings',
      href: '/dashboard/settings/order-security',
    },
  },
];
