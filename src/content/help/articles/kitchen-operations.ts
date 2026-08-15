import { HelpArticle } from '../types';

export const KITCHEN_OPERATIONS_ARTICLES: HelpArticle[] = [
  {
    slug: 'kitchen-queue-overview',
    title: 'Understanding the Kitchen Display System (KDS)',
    description: 'Learn how kitchen staff monitor incoming live food tickets, filter by active branch, and prioritize orders by preparation time.',
    category: 'kitchen-operations',
    keywords: ['kitchen display', 'kds', 'queue', 'kitchen tickets', 'prep queue', 'chef display', 'order status'],
    allowedRoles: ['business_owner', 'branch_manager', 'kitchen_staff'],
    requiredPermissions: ['kitchen.access'],
    contextRoutes: ['/dashboard/kitchen'],
    popular: true,
    estimatedReadMinutes: 3,
    steps: [
      {
        number: 1,
        title: 'Open Kitchen Queue',
        instruction: 'From the dashboard sidebar under "OPERATIONS", click "Kitchen Queue" (/dashboard/kitchen).',
      },
      {
        number: 2,
        title: 'Inspect Live Ticket Columns',
        instruction: 'The Kitchen Display organizes tickets dynamically by status: "Confirmed" (newly arrived tickets), "Preparing" (cooks actively working on the dish), and "Ready" (plated dishes awaiting runner pickup).',
      },
      {
        number: 3,
        title: 'Monitor Time Elapsed Timers',
        instruction: 'Each ticket displays a live timer showing how many minutes have passed since the order was confirmed. Tickets turn yellow and red as wait times increase, alerting the chef to prioritize delayed items.',
      },
    ],
    notes: [
      'Orders requiring waiter approval will only arrive in the Kitchen Queue after the waiter approves the ticket.',
    ],
    relatedArticles: ['reading-kitchen-tickets-and-modifiers', 'updating-kitchen-ticket-status', 'order-processing-lifecycle'],
    directAction: {
      label: 'Open Kitchen Display',
      href: '/dashboard/kitchen',
    },
  },
  {
    slug: 'reading-kitchen-tickets-and-modifiers',
    title: 'Reading Kitchen Tickets, Modifiers & Guest Notes',
    description: 'How to accurately interpret item variations, allergy notes, cooking instructions, and table numbers on KDS tickets.',
    category: 'kitchen-operations',
    keywords: ['ticket format', 'modifiers on tickets', 'allergy notes', 'guest instructions', 'table number', 'ticket header'],
    allowedRoles: ['business_owner', 'branch_manager', 'kitchen_staff'],
    requiredPermissions: ['kitchen.orders.view'],
    contextRoutes: ['/dashboard/kitchen'],
    estimatedReadMinutes: 3,
    steps: [
      {
        number: 1,
        title: 'Inspect Ticket Header',
        instruction: 'The ticket header shows the Order Number (#10023), Table Number (e.g., Table 4 - Main Dining), and Order Timestamp.',
      },
      {
        number: 2,
        title: 'Read Item List & Quantities',
        instruction: 'Item quantities appear in bold (e.g. "2x Signature Smash Burger").',
      },
      {
        number: 3,
        title: 'Review Modifiers & Custom Choices',
        instruction: 'Modifier choices appear indented directly under each item (e.g. "+ Extra Cheddar", "Cooking: Medium Rare", "No Mayonnaise").',
      },
      {
        number: 4,
        title: 'Check Special Guest Instructions',
        instruction: 'If the guest or waiter entered special dietary or preparation requests (e.g. "Peanut allergy - please prepare separately"), they are highlighted in amber at the bottom of the ticket.',
      },
    ],
    notes: [
      'All modifier options selected by the customer are verified against current menu database records.',
    ],
    relatedArticles: ['kitchen-queue-overview', 'updating-kitchen-ticket-status', 'managing-modifiers-and-options'],
    directAction: {
      label: 'View Kitchen Queue',
      href: '/dashboard/kitchen',
    },
  },
  {
    slug: 'updating-kitchen-ticket-status',
    title: 'Updating Ticket Status (Confirmed → Preparing → Ready → Served)',
    description: 'How kitchen staff communicate progress with runners, waiters, and guests by updating ticket stages.',
    category: 'kitchen-operations',
    keywords: ['preparing', 'mark ready', 'mark served', 'ticket status', 'kitchen progress', 'expediter'],
    allowedRoles: ['business_owner', 'branch_manager', 'kitchen_staff'],
    requiredPermissions: ['kitchen.update'],
    contextRoutes: ['/dashboard/kitchen'],
    popular: true,
    estimatedReadMinutes: 3,
    steps: [
      {
        number: 1,
        title: 'Marking Order as "Preparing"',
        instruction: 'When beginning prep work on an order, tap the "Start Preparing" button on the ticket card. The ticket moves to the active cooking column, and the guest\'s phone updates to show food is being prepared.',
      },
      {
        number: 2,
        title: 'Marking Order as "Ready"',
        instruction: 'Once all dishes on the ticket are plated and placed on the pass, click "Mark Ready". Waiters and floor runners immediately see a ready notification.',
      },
      {
        number: 3,
        title: 'Marking Order as "Served"',
        instruction: 'When food is delivered to the table, clicking "Mark Served" archives the ticket from the active kitchen display while keeping it available for Cashier POS payment.',
      },
    ],
    notes: [
      'Touch targets on the Kitchen Display are designed for quick one-tap operation on wall-mounted touchscreen monitors.',
    ],
    relatedArticles: ['kitchen-queue-overview', 'reading-kitchen-tickets-and-modifiers', 'order-processing-lifecycle'],
    directAction: {
      label: 'Open Kitchen Queue',
      href: '/dashboard/kitchen',
    },
  },
];
