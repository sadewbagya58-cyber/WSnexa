import { HelpArticle } from '../types';

export const CASHIER_PAYMENTS_ARTICLES: HelpArticle[] = [
  {
    slug: 'cashier-pos-dashboard-overview',
    title: 'Understanding the Cashier POS Dashboard',
    description: 'Learn how cashiers locate open dining tickets, review itemized bills, split or discount totals, and settle orders.',
    category: 'cashier-payments',
    keywords: ['cashier', 'pos', 'register', 'unpaid orders', 'bill settlement', 'checkout', 'counter'],
    allowedRoles: ['business_owner', 'branch_manager', 'cashier'],
    requiredPermissions: ['cashier.access'],
    contextRoutes: ['/dashboard/cashier'],
    popular: true,
    estimatedReadMinutes: 4,
    steps: [
      {
        number: 1,
        title: 'Open Cashier POS',
        instruction: 'From the dashboard sidebar under "OPERATIONS", click "Cashier POS" (/dashboard/cashier).',
      },
      {
        number: 2,
        title: 'Find Open Dining Orders',
        instruction: 'The active orders view displays all unpaid tickets organized by Table Number, Order ID, and Guest Name. You can filter by table or search by customer name.',
      },
      {
        number: 3,
        title: 'Review Itemized Totals & Taxes',
        instruction: 'Click on any order card to inspect the item breakdown, subtotal, tax amount, and service charge in LKR.',
      },
      {
        number: 4,
        title: 'Proceed to Payment Settlement',
        instruction: 'Click "Settle Payment" to open the payment recording modal.',
      },
    ],
    notes: [
      'Cashier POS displays live updates when waiters add extra items or drinks to an active table bill.',
    ],
    relatedArticles: ['recording-cash-and-card-payments', 'printing-customer-receipts', 'configuring-payment-methods'],
    directAction: {
      label: 'Open Cashier POS',
      href: '/dashboard/cashier',
    },
  },
  {
    slug: 'recording-cash-and-card-payments',
    title: 'Recording Cash, Card & Counter Payments',
    description: 'How to record physical cash collections, credit/debit card card-terminal transactions, and complete orders.',
    category: 'cashier-payments',
    keywords: ['record payment', 'cash payment', 'card payment', 'settle bill', 'tender cash', 'change calculation'],
    allowedRoles: ['business_owner', 'branch_manager', 'cashier'],
    requiredPermissions: ['payments.record'],
    contextRoutes: ['/dashboard/cashier'],
    popular: true,
    estimatedReadMinutes: 3,
    steps: [
      {
        number: 1,
        title: 'Open Payment Modal for Order',
        instruction: 'In Cashier POS (/dashboard/cashier), click "Record Payment" on the customer\'s bill.',
      },
      {
        number: 2,
        title: 'Select Tender Method',
        instruction: 'Choose "Cash", "Card", or "Pay at Counter" based on how the guest is paying.',
      },
      {
        number: 3,
        title: 'Enter Cash Tendered (For Cash Payments)',
        instruction: 'If Cash is selected, input the cash amount received (e.g. 5000 LKR). WSNexa automatically computes the exact change due.',
      },
      {
        number: 4,
        title: 'Confirm Payment & Complete Order',
        instruction: 'Click "Confirm Payment & Settle". The order status is updated to `completed` and `paid`, freeing the table for the next guests.',
      },
    ],
    notes: [
      'Only payment methods that are enabled in your branch settings are selectable by the cashier.',
    ],
    relatedArticles: ['cashier-pos-dashboard-overview', 'printing-customer-receipts', 'configuring-payment-methods'],
    directAction: {
      label: 'Settle Orders in POS',
      href: '/dashboard/cashier',
    },
  },
  {
    slug: 'printing-customer-receipts',
    title: 'Printing Customer Receipts & Tax Invoices',
    description: 'Generate clean, branded 80mm thermal receipts or full-page tax invoices with business details, tax breakdown, and items.',
    category: 'cashier-payments',
    keywords: ['receipt', 'print receipt', 'thermal printer', 'tax invoice', 'bill print', '80mm receipt'],
    allowedRoles: ['business_owner', 'branch_manager', 'cashier'],
    requiredPermissions: ['receipts.print'],
    contextRoutes: ['/dashboard/cashier'],
    estimatedReadMinutes: 3,
    steps: [
      {
        number: 1,
        title: 'Click "Print Receipt" on Order Card',
        instruction: 'From the Cashier POS order view, click the "Print Receipt" icon or button.',
      },
      {
        number: 2,
        title: 'Inspect Thermal Receipt Preview',
        instruction: 'WSNexa opens a clean, standard 80mm receipt dialog showing your Business Logo, Branch Address, Order Number, Date/Time, Table, Item List with Modifiers, Subtotal, Tax, Service Charge, and Total.',
      },
      {
        number: 3,
        title: 'Send to POS Thermal Printer',
        instruction: 'Click "Print" to trigger your browser\'s native print dialog. Select your USB, Bluetooth, or Network thermal receipt printer.',
      },
    ],
    notes: [
      'Receipts can be reprinted at any time from historical completed orders.',
    ],
    relatedArticles: ['cashier-pos-dashboard-overview', 'recording-cash-and-card-payments', 'setting-up-your-business'],
    directAction: {
      label: 'Open Cashier POS',
      href: '/dashboard/cashier',
    },
  },
  {
    slug: 'configuring-payment-methods',
    title: 'Configuring Branch Payment Methods',
    description: 'Enable or disable accepted payment methods (Cash, Card, Pay at Counter, QR Pay, Online) per branch outlet.',
    category: 'cashier-payments',
    keywords: ['payment methods', 'enable cash', 'enable card', 'payment settings', 'counter pay', 'branch payments'],
    allowedRoles: ['business_owner', 'branch_manager'],
    requiredPermissions: ['branches.manage'],
    contextRoutes: ['/dashboard/settings/payments'],
    popular: true,
    gettingStarted: true,
    estimatedReadMinutes: 3,
    steps: [
      {
        number: 1,
        title: 'Navigate to Payment Settings',
        instruction: 'In the dashboard sidebar under "SETTINGS", click "Payment Methods" (/dashboard/settings/payments).',
      },
      {
        number: 2,
        title: 'Review Available Payment Methods',
        instruction: 'WSNexa supports "Cash", "Card (POS Terminal)", "Pay at Counter", "QR Payment", and "Online Card Payment".',
      },
      {
        number: 3,
        title: 'Toggle Allowed Methods',
        instruction: 'Toggle the switch beside each payment method you accept at this branch. For example, if you do not accept cash, turn Cash off.',
      },
      {
        number: 4,
        title: 'Save Payment Configuration',
        instruction: 'Click "Save Payment Methods". The changes immediately update the payment options shown to guests during QR checkout and cashiers in POS.',
      },
    ],
    notes: [
      'At least one payment method must remain active for guests to checkout.',
    ],
    relatedArticles: ['cashier-pos-dashboard-overview', 'recording-cash-and-card-payments', 'setting-up-your-business'],
    directAction: {
      label: 'Configure Payment Methods',
      href: '/dashboard/settings/payments',
    },
  },
];
