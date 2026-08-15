import { HelpArticle } from '../types';

export const GETTING_STARTED_ARTICLES: HelpArticle[] = [
  {
    slug: 'welcome-to-wsnexa',
    title: 'Welcome to WSNexa — Smart Hospitality. Simplified.',
    description: 'An introductory overview of WSNexa and how the platform powers contactless ordering, kitchen displays, waiter management, and payments.',
    category: 'getting-started',
    keywords: ['welcome', 'overview', 'introduction', 'getting started', 'hospitality', 'features'],
    popular: true,
    gettingStarted: true,
    estimatedReadMinutes: 3,
    steps: [
      {
        number: 1,
        title: 'Understand the Unified Digital Hospitality Architecture',
        instruction: 'WSNexa unifies your entire restaurant workflow into a single realtime platform. You configure your menu and floor plan once, and WSNexa automatically powers QR customer menus, waiter mobile ordering, kitchen ticket displays, and cashier settlement.',
        tip: 'Any changes made to menu prices or sold-out items update instantly across all customer and staff screens without reloading.',
      },
      {
        number: 2,
        title: 'Explore the Role-Based Workspaces',
        instruction: 'Each team member accesses a tailored workspace suited to their responsibilities: Business Owners manage venues and settings; Managers oversee branches and staff; Waiters take orders and respond to assistance calls; Kitchen staff view live prep queues; Cashiers record payments.',
      },
      {
        number: 3,
        title: 'Follow the Quick Start Checklist',
        instruction: 'On the main Help Center page, use the live Quick Start Checklist to complete your business profile, add menu items, generate QR codes, and publish your venue to the discovery directory.',
      },
    ],
    notes: [
      'WSNexa runs in modern mobile and desktop web browsers without requiring hardware terminals or app downloads.',
    ],
    relatedArticles: ['understanding-your-dashboard', 'setting-up-your-business', 'choosing-an-ordering-mode'],
    directAction: {
      label: 'Open Dashboard Overview',
      href: '/dashboard',
    },
  },
  {
    slug: 'understanding-your-dashboard',
    title: 'Understanding Your Dashboard & Navigation',
    description: 'Learn how to navigate the WSNexa dashboard sidebar, switch active branches, and inspect operational metrics.',
    category: 'getting-started',
    keywords: ['dashboard', 'sidebar', 'navigation', 'overview', 'branches', 'switch branch'],
    gettingStarted: true,
    contextRoutes: ['/dashboard'],
    estimatedReadMinutes: 4,
    steps: [
      {
        number: 1,
        title: 'Access the Left Sidebar Navigation',
        instruction: 'The sidebar is organized into clean operational sections: Overview, Venue Setup, Menu, Operations, Growth & Guests, Settings, and Support. Click any item to immediately navigate.',
      },
      {
        number: 2,
        title: 'Switch Active Branches',
        instruction: 'If your business operates multiple locations, use the Branch Selector in the sidebar header to quickly toggle your active outlet context. All menus, tables, and reports will switch to the selected branch.',
      },
      {
        number: 3,
        title: 'Inspect Realtime Business Health',
        instruction: 'The main Dashboard Overview displays today\'s gross sales, active order count, table utilization, and quick action shortcuts for adding items or viewing live orders.',
      },
    ],
    notes: [
      'Your visible navigation links dynamically adapt based on your assigned staff permissions.',
    ],
    relatedArticles: ['welcome-to-wsnexa', 'setting-up-your-first-branch', 'reports-and-analytics-guide'],
    directAction: {
      label: 'View Dashboard',
      href: '/dashboard',
    },
  },
  {
    slug: 'setting-up-your-business',
    title: 'Setting Up Your Business Profile & Financials',
    description: 'Configure your restaurant name, default currency, tax rate, service charge percentage, and operational time zone.',
    category: 'getting-started',
    keywords: ['business', 'profile', 'tax', 'service charge', 'currency', 'time zone', 'setup'],
    allowedRoles: ['business_owner', 'branch_manager'],
    requiredPermissions: ['business.settings.manage'],
    contextRoutes: ['/dashboard/business'],
    gettingStarted: true,
    popular: true,
    estimatedReadMinutes: 4,
    steps: [
      {
        number: 1,
        title: 'Navigate to Business Profile',
        instruction: 'From the dashboard sidebar under "VENUE SETUP", click "Business Profile" (/dashboard/business).',
      },
      {
        number: 2,
        title: 'Enter Legal & Display Information',
        instruction: 'Set your Business Name, Category Type (Restaurant, Cafe, Bar, Hotel, etc.), and Contact Email.',
      },
      {
        number: 3,
        title: 'Configure Tax & Service Charges',
        instruction: 'Specify your local Value-Added Tax percentage and dine-in Service Charge percentage. WSNexa will automatically calculate and display these transparently on guest checkouts and cashier receipts.',
        tip: 'If taxes are already included in your menu item prices, you can set Tax Percentage to 0%.',
      },
      {
        number: 4,
        title: 'Save Business Configuration',
        instruction: 'Click "Save Changes" at the bottom of the page to apply your settings across all branches.',
      },
    ],
    notes: [
      'Changes to tax and service charge percentages will apply to new orders placed after saving.',
    ],
    relatedArticles: ['setting-up-your-first-branch', 'configuring-payment-methods', 'setting-up-public-venue-profile'],
    directAction: {
      label: 'Open Business Profile',
      href: '/dashboard/business',
    },
  },
  {
    slug: 'choosing-an-ordering-mode',
    title: 'Choosing an Ordering Mode (QR, Waiter, or Hybrid)',
    description: 'Select how guests and staff interact with your digital menu across self-service QR codes and waiter ordering.',
    category: 'getting-started',
    keywords: ['ordering mode', 'qr ordering', 'waiter ordering', 'hybrid', 'self service', 'dine in'],
    allowedRoles: ['business_owner', 'branch_manager'],
    requiredPermissions: ['branches.manage'],
    contextRoutes: ['/dashboard/branches'],
    gettingStarted: true,
    estimatedReadMinutes: 3,
    steps: [
      {
        number: 1,
        title: 'Open Branches Management',
        instruction: 'From the dashboard sidebar, select "Branches" (/dashboard/branches) and choose the branch you wish to configure.',
      },
      {
        number: 2,
        title: 'Select Operating Mode',
        instruction: 'Choose one of three modes for your branch: "QR Ordering Only" (contactless guest self-service), "Waiter Ordering Only" (traditional staff-assisted ordering), or "QR & Waiter (Hybrid)" (guests can order directly or ask staff to place orders).',
      },
      {
        number: 3,
        title: 'Configure Table Selection Requirement',
        instruction: 'Toggle "Require Table Selection" if guests must select or verify their table before placing orders.',
      },
    ],
    notes: [
      'You can customize ordering modes per branch to support different operating styles (e.g., fast-casual vs fine dining).',
    ],
    relatedArticles: ['setting-up-your-first-branch', 'understanding-order-security-levels', 'waiter-dashboard-overview'],
    directAction: {
      label: 'Configure Branches',
      href: '/dashboard/branches',
    },
  },
];
