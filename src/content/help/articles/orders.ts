import { HelpArticle } from '../types';

export const ORDERS_ARTICLES: HelpArticle[] = [
  {
    slug: 'order-processing-lifecycle',
    title: 'The WSNexa Order Processing Lifecycle (A to Z)',
    description: 'Understand every stage of an order: submission, waiter approval, kitchen preparation, expediting, cashier payment, and completion.',
    category: 'orders',
    keywords: ['order lifecycle', 'order stages', 'status', 'pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'],
    popular: true,
    estimatedReadMinutes: 4,
    steps: [
      {
        number: 1,
        title: 'Stage 1: Order Placement (Guest or Waiter)',
        instruction: 'A guest places an order via Table QR or a waiter inputs an order via the Waiter POS tablet. An idempotency key ensures no order is duplicated.',
      },
      {
        number: 2,
        title: 'Stage 2: Waiter Approval (Optional Gate)',
        instruction: 'If your branch requires Waiter Approval, the order enters `pending_waiter_approval`. The assigned area waiter reviews and approves or rejects the ticket. Once approved, it advances to `confirmed`.',
        tip: 'Orders requiring approval do NOT appear in the kitchen display until the waiter explicitly approves them.',
      },
      {
        number: 3,
        title: 'Stage 3: Kitchen Display Queue (KDS)',
        instruction: 'Kitchen staff see the confirmed ticket, click "Start Preparing" (status: `preparing`), prepare the items according to modifiers and notes, and click "Mark Ready" (status: `ready`) when plated.',
      },
      {
        number: 4,
        title: 'Stage 4: Serving & Cashier Settlement',
        instruction: 'Waiters deliver the food (status: `served`). When the guest is ready to settle, the cashier pulls up the ticket on Cashier POS, collects cash/card, prints the receipt, and marks the order `completed` + `paid`.',
      },
    ],
    notes: [
      'Orders can be reviewed historically under Reports & Analytics or Cashier Order History.',
    ],
    relatedArticles: ['approving-and-rejecting-guest-orders', 'reading-kitchen-tickets-and-modifiers', 'recording-cash-and-card-payments'],
    directAction: {
      label: 'View Reports & Orders',
      href: '/dashboard/reports',
    },
  },
  {
    slug: 'cancelling-and-voiding-orders',
    title: 'Cancelling Orders & Handling Voids Safely',
    description: 'How to cancel pending tickets, handle customer changes, and maintain audit logs for cancelled orders.',
    category: 'orders',
    keywords: ['cancel order', 'void', 'delete order', 'wrong order', 'refund', 'audit trail'],
    allowedRoles: ['business_owner', 'branch_manager', 'cashier', 'waiter'],
    requiredPermissions: ['orders.cancel'],
    estimatedReadMinutes: 3,
    steps: [
      {
        number: 1,
        title: 'Cancelling Unapproved Guest Orders',
        instruction: 'If a guest entered an incorrect item, the waiter can click "Reject Order" directly from the Waiter Assistance screen. The guest\'s screen immediately updates with the rejection reason.',
      },
      {
        number: 2,
        title: 'Voiding Kitchen Orders',
        instruction: 'If food preparation has already begun, notify the kitchen before cancelling the order in Cashier POS or Waiter dashboard to prevent food waste.',
      },
      {
        number: 3,
        title: 'Audit Logging',
        instruction: 'All order cancellations record the cancelling staff member\'s user ID, timestamp, and reason in the immutable platform audit log.',
      },
    ],
    notes: [
      'Completed and paid orders cannot be cancelled directly without recording an official cashier void/refund transaction.',
    ],
    relatedArticles: ['order-processing-lifecycle', 'approving-and-rejecting-guest-orders', 'cashier-pos-dashboard-overview'],
    directAction: {
      label: 'Open Cashier POS',
      href: '/dashboard/cashier',
    },
  },
];
