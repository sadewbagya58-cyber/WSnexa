import { HelpArticle } from '../types';

export const WAITER_OPERATIONS_ARTICLES: HelpArticle[] = [
  {
    slug: 'waiter-dashboard-overview',
    title: 'Understanding the Waiter Assistance Dashboard',
    description: 'Learn how to monitor real-time guest assistance calls, bill requests, water refills, and pending customer order approvals.',
    category: 'waiter-operations',
    keywords: ['waiter', 'waiter assistance', 'calls', 'requests', 'bill request', 'water request', 'service alerts'],
    allowedRoles: ['business_owner', 'branch_manager', 'waiter'],
    requiredPermissions: ['waiter.requests.view'],
    contextRoutes: ['/dashboard/waiter'],
    popular: true,
    estimatedReadMinutes: 3,
    steps: [
      {
        number: 1,
        title: 'Open Waiter Assistance',
        instruction: 'From the dashboard sidebar under "OPERATIONS", click "Waiter Assistance" (/dashboard/waiter).',
      },
      {
        number: 2,
        title: 'Filter by Service Area',
        instruction: 'If you oversee a specific dining zone (e.g. "Patio"), use the Area Filter at the top to focus exclusively on your assigned tables.',
      },
      {
        number: 3,
        title: 'Respond to Live Assistance Calls',
        instruction: 'When a seated guest clicks "Call Waiter", "Request Bill", or "Request Water" on their phone, an instant card appears with the table number, timestamp, and request type.',
      },
      {
        number: 4,
        title: 'Mark Request as Handled',
        instruction: 'Once you assist the guest, click "Resolve" or "Acknowledge" on the request card to dismiss the notification.',
      },
    ],
    notes: [
      'The Waiter Assistance screen updates automatically via realtime web sockets without requiring manual page refreshes.',
    ],
    relatedArticles: ['taking-table-orders-as-a-waiter', 'approving-and-rejecting-guest-orders', 'assigning-waiters-to-service-areas'],
    directAction: {
      label: 'Open Waiter Screen',
      href: '/dashboard/waiter',
    },
  },
  {
    slug: 'taking-table-orders-as-a-waiter',
    title: 'Taking Table Orders on Mobile / Tablet POS',
    description: 'Step-by-step guide for waiters to select dining tables, browse the food and drink catalog, attach modifier options, and send orders to the kitchen.',
    category: 'waiter-operations',
    keywords: ['take order', 'waiter menu', 'waiter order', 'pos tablet', 'table selection', 'add modifiers', 'guest notes'],
    allowedRoles: ['business_owner', 'branch_manager', 'waiter'],
    requiredPermissions: ['waiter.orders.create'],
    contextRoutes: ['/dashboard/waiter/order', '/dashboard/waiter/menu'],
    popular: true,
    estimatedReadMinutes: 4,
    steps: [
      {
        number: 1,
        title: 'Select Dining Table',
        instruction: 'Navigate to "Waiter Menu" (/dashboard/waiter/menu) or click "Take New Order" from the Waiter dashboard. Choose the target Table Number from the visual floor selector.',
      },
      {
        number: 2,
        title: 'Browse Menu & Add Items',
        instruction: 'Use category tabs or the search bar to find dishes and drinks. Tap any item card to open details.',
      },
      {
        number: 3,
        title: 'Select Modifiers & Guest Preferences',
        instruction: 'Configure sizes, meat temperatures, or add-ons. Add custom kitchen instructions (e.g. "No onions, extra spicy") in the item notes field.',
      },
      {
        number: 4,
        title: 'Review Cart & Submit to Kitchen',
        instruction: 'Open the Order Summary, verify item quantities and subtotal with the guest, and click "Submit Order". The ticket is immediately dispatched to the Kitchen Display.',
      },
    ],
    notes: [
      'Orders placed directly by authenticated waiters are automatically confirmed and bypass guest security approval gates.',
    ],
    relatedArticles: ['waiter-dashboard-overview', 'approving-and-rejecting-guest-orders', 'reading-kitchen-tickets-and-modifiers'],
    directAction: {
      label: 'Take Waiter Order',
      href: '/dashboard/waiter/menu',
    },
  },
  {
    slug: 'approving-and-rejecting-guest-orders',
    title: 'Approving & Rejecting Pending Guest Orders',
    description: 'How to review incoming self-service QR orders, confirm table presence, and dispatch approved tickets to the kitchen queue.',
    category: 'waiter-operations',
    keywords: ['approvals', 'pending orders', 'approve order', 'reject order', 'guest orders', 'waiter gate'],
    allowedRoles: ['business_owner', 'branch_manager', 'waiter'],
    requiredPermissions: ['waiter.requests.view', 'orders.update_status'],
    contextRoutes: ['/dashboard/waiter'],
    popular: true,
    estimatedReadMinutes: 3,
    steps: [
      {
        number: 1,
        title: 'Locate Pending Approval Orders',
        instruction: 'On the Waiter Assistance dashboard (/dashboard/waiter), incoming QR orders requiring staff validation appear under the "Pending Approvals" section highlighted in amber.',
      },
      {
        number: 2,
        title: 'Inspect Order Details',
        instruction: 'Click on the order card to inspect the Table Number, guest items, modifier selections, and guest notes.',
      },
      {
        number: 3,
        title: 'Approve Order for Kitchen',
        instruction: 'Click "Approve & Send to Kitchen". The status transitions to `confirmed` and immediately appears on kitchen preparation screens.',
      },
      {
        number: 4,
        title: 'Rejecting Fraudulent or Mistaken Orders',
        instruction: 'If the table is unoccupied or the guest made an error, click "Reject Order" and select a reason (e.g. "Table unoccupied" or "Item unavailable"). The guest will see the cancellation notice on their phone.',
      },
    ],
    notes: [
      'If your venue operates on Low Security, orders skip the approval gate and dispatch to the kitchen immediately upon customer submission.',
    ],
    relatedArticles: ['waiter-dashboard-overview', 'understanding-order-security-levels', 'order-processing-lifecycle'],
    directAction: {
      label: 'View Pending Approvals',
      href: '/dashboard/waiter',
    },
  },
  {
    slug: 'assigning-waiters-to-service-areas',
    title: 'Assigning Waiters to Specific Service Areas',
    description: 'How managers route assistance calls and table approvals to specific waitstaff stationed in designated dining zones.',
    category: 'waiter-operations',
    keywords: ['assign waiter', 'service area routing', 'station assignment', 'waiter zones', 'shift setup'],
    allowedRoles: ['business_owner', 'branch_manager'],
    requiredPermissions: ['areas.manage', 'staff.edit'],
    contextRoutes: ['/dashboard/tables/areas', '/dashboard/team'],
    estimatedReadMinutes: 3,
    steps: [
      {
        number: 1,
        title: 'Open Service Areas Management',
        instruction: 'Navigate to "Dining Setup" -> "Manage Areas" (/dashboard/tables/areas).',
      },
      {
        number: 2,
        title: 'Edit Target Service Area',
        instruction: 'Click "Edit" on the area you wish to configure (e.g., "Rooftop Terrace").',
      },
      {
        number: 3,
        title: 'Assign Waitstaff Members',
        instruction: 'In the Assigned Staff dropdown, select the waiters who are covering this zone during the current shift.',
      },
      {
        number: 4,
        title: 'Save Area Configuration',
        instruction: 'Click "Update Area". The assigned waiters will now receive notifications specifically for tables in this zone.',
      },
    ],
    notes: [
      'A waiter with no specific area assignments will monitor all tables across the entire branch by default.',
    ],
    relatedArticles: ['understanding-roles-vs-service-areas', 'creating-service-areas-and-tables', 'waiter-dashboard-overview'],
    directAction: {
      label: 'Manage Service Areas',
      href: '/dashboard/tables/areas',
    },
  },
];
