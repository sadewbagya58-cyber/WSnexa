import { HelpArticle } from '../types';

export const ACCOUNT_SETTINGS_ARTICLES: HelpArticle[] = [
  {
    slug: 'managing-your-user-profile',
    title: 'Managing Your Profile, Name & Credentials',
    description: 'Update your display name, contact email, avatar, and password security credentials in WSNexa.',
    category: 'account-settings',
    keywords: ['profile', 'account', 'name', 'password', 'change password', 'email', 'avatar'],
    contextRoutes: ['/customer/profile'],
    estimatedReadMinutes: 2,
    steps: [
      {
        number: 1,
        title: 'Open Profile Settings',
        instruction: 'Click your user avatar in the upper right corner of the dashboard or go to your account profile.',
      },
      {
        number: 2,
        title: 'Update Display Name',
        instruction: 'Edit your First Name and Last Name. These appear on waiter order tickets and cashier receipts when you perform actions.',
      },
      {
        number: 3,
        title: 'Update Password & Security',
        instruction: 'To change your password, enter your current password followed by your new secure password (minimum 8 characters with numbers and symbols).',
      },
      {
        number: 4,
        title: 'Save Profile',
        instruction: 'Click "Update Profile" to commit your changes.',
      },
    ],
    notes: [
      'If you forget your password, you can trigger a secure reset email from the login screen.',
    ],
    relatedArticles: ['welcome-to-wsnexa', 'understanding-your-dashboard'],
    directAction: {
      label: 'Open Dashboard',
      href: '/dashboard',
    },
  },
  {
    slug: 'reports-and-analytics-guide',
    title: 'Generating Sales Reports & Exporting Business Analytics',
    description: 'Track daily gross revenue, average order value, top-selling dishes, and export clean CSV/PDF reports.',
    category: 'account-settings',
    keywords: ['reports', 'analytics', 'revenue', 'export csv', 'sales report', 'top items', 'order volume'],
    allowedRoles: ['business_owner', 'branch_manager'],
    requiredPermissions: ['reports.view'],
    contextRoutes: ['/dashboard/reports'],
    popular: true,
    estimatedReadMinutes: 4,
    steps: [
      {
        number: 1,
        title: 'Navigate to Reports & Analytics',
        instruction: 'In the sidebar under "OVERVIEW", click "Reports & Analytics" (/dashboard/reports).',
      },
      {
        number: 2,
        title: 'Select Date Range',
        instruction: 'Choose your desired analysis timeframe: "Today", "Last 7 Days", "Last 30 Days", or a custom calendar range.',
      },
      {
        number: 3,
        title: 'Inspect Revenue & Volume Trends',
        instruction: 'Review Gross Sales, Net Revenue, Tax Collected, Service Charge Collected, and Total Orders completed.',
      },
      {
        number: 4,
        title: 'Review Top-Selling Menu Items',
        instruction: 'Inspect the item performance chart to identify your most popular and highest-margin dishes.',
      },
      {
        number: 5,
        title: 'Export Financial Data',
        instruction: 'Click "Export CSV" to download an accounting-ready spreadsheet of all transactions for your bookkeeper.',
      },
    ],
    notes: [
      'Reports update in realtime as cashiers settle completed orders.',
    ],
    relatedArticles: ['cashier-pos-dashboard-overview', 'setting-up-your-business'],
    directAction: {
      label: 'View Reports',
      href: '/dashboard/reports',
    },
  },
];
