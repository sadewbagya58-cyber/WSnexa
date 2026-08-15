import { HelpArticle } from '../types';

export const BUSINESS_BRANCHES_ARTICLES: HelpArticle[] = [
  {
    slug: 'setting-up-your-first-branch',
    title: 'Setting Up & Managing Multi-Branch Outlets',
    description: 'Learn how to create physical branch locations, assign branch managers, and manage location details.',
    category: 'business-branches',
    keywords: ['branches', 'multi branch', 'outlets', 'locations', 'add branch', 'branch code'],
    allowedRoles: ['business_owner', 'branch_manager'],
    requiredPermissions: ['branches.manage'],
    contextRoutes: ['/dashboard/branches'],
    popular: true,
    gettingStarted: true,
    estimatedReadMinutes: 4,
    steps: [
      {
        number: 1,
        title: 'Open Branches Management',
        instruction: 'Navigate to "Branches" under "VENUE SETUP" in the dashboard sidebar (/dashboard/branches).',
      },
      {
        number: 2,
        title: 'Create or Edit a Branch',
        instruction: 'Click "+ Add Branch" or select an existing branch card. Enter Branch Name, Unique Branch Code, Phone Number, and Street Address.',
      },
      {
        number: 3,
        title: 'Designate Default Branch',
        instruction: 'If you have multiple outlets, designate one branch as your primary default. New staff and customers will default to this outlet unless specified.',
      },
      {
        number: 4,
        title: 'Configure Branch Service Settings',
        instruction: 'Set whether this branch enforces table PIN verification, waiter approval, or guest location verification under branch settings.',
      },
    ],
    notes: [
      'Each branch maintains isolated tables, service areas, active orders, and kitchen queues while sharing the central business menu catalog.',
    ],
    relatedArticles: ['setting-up-your-business', 'choosing-an-ordering-mode', 'creating-service-areas-and-tables'],
    directAction: {
      label: 'Manage Branches',
      href: '/dashboard/branches',
    },
  },
  {
    slug: 'managing-branch-operating-hours',
    title: 'Configuring Branch Operating Hours & Contact Info',
    description: 'Set opening and closing schedules and contact channels for customer discovery and operational awareness.',
    category: 'business-branches',
    keywords: ['operating hours', 'opening hours', 'schedule', 'phone', 'contact', 'branch info'],
    allowedRoles: ['business_owner', 'branch_manager'],
    requiredPermissions: ['branches.manage'],
    contextRoutes: ['/dashboard/branches'],
    estimatedReadMinutes: 3,
    steps: [
      {
        number: 1,
        title: 'Select Your Target Branch',
        instruction: 'Go to "/dashboard/branches" and click on the branch you wish to edit.',
      },
      {
        number: 2,
        title: 'Update Contact Information',
        instruction: 'Ensure the public contact telephone number and street address are accurate.',
      },
      {
        number: 3,
        title: 'Review Venue Discovery Synchronization',
        instruction: 'Branch details are used by the Public Venue Profile to calculate proximity search results and display directions on Google Maps.',
      },
    ],
    notes: [
      'Accurate branch address information is required to publish your venue to customer discovery.',
    ],
    relatedArticles: ['setting-up-your-first-branch', 'setting-up-public-venue-profile', 'publishing-your-venue-checklist'],
    directAction: {
      label: 'Open Branches',
      href: '/dashboard/branches',
    },
  },
];
