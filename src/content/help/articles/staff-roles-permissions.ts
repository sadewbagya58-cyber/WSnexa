import { HelpArticle } from '../types';

export const STAFF_ROLES_PERMISSIONS_ARTICLES: HelpArticle[] = [
  {
    slug: 'inviting-and-managing-staff-members',
    title: 'Inviting Staff Members & Assigning Roles',
    description: 'Invite managers, waiters, chefs, and cashiers via email, assign primary branch outlets, and manage account statuses.',
    category: 'staff-roles-permissions',
    keywords: ['staff', 'invite staff', 'team', 'roles', 'members', 'add employee', 'permissions'],
    allowedRoles: ['business_owner', 'branch_manager'],
    requiredPermissions: ['staff.invite', 'staff.view'],
    contextRoutes: ['/dashboard/team', '/dashboard/team/invites'],
    popular: true,
    gettingStarted: true,
    estimatedReadMinutes: 4,
    steps: [
      {
        number: 1,
        title: 'Open Staff Invitations',
        instruction: 'Navigate to "Team & Members" (/dashboard/team) in the sidebar and click "+ Invite Member" or go directly to "/dashboard/team/invites".',
      },
      {
        number: 2,
        title: 'Enter Staff Email & Select Role',
        instruction: 'Enter the staff member\'s email address and choose their role: Branch Manager, Supervisor, Cashier, Kitchen Staff, Waiter, or a Custom Role.',
      },
      {
        number: 3,
        title: 'Assign Branch & Service Areas',
        instruction: 'Select which Branch outlet the member can access. For Waiters, you can pre-assign specific Service Areas (e.g. "Main Dining" or "Patio").',
      },
      {
        number: 4,
        title: 'Send Invitation Link',
        instruction: 'Click "Send Invitation". WSNexa creates a secure invitation token. You can also copy the direct invitation link to send via WhatsApp or SMS.',
      },
      {
        number: 5,
        title: 'Accepting the Invitation',
        instruction: 'When the staff member clicks the link, they create their WSNexa login or sign in, and their role is automatically activated.',
      },
    ],
    notes: [
      'You can revoke or resend pending invitations at any time from the Staff Invitations page.',
    ],
    relatedArticles: ['understanding-roles-vs-service-areas', 'custom-roles-and-permissions-management', 'assigning-waiters-to-service-areas'],
    directAction: {
      label: 'Invite Staff Member',
      href: '/dashboard/team/invites',
    },
  },
  {
    slug: 'understanding-roles-vs-service-areas',
    title: 'Understanding Roles vs Service Areas (WHAT vs WHERE)',
    description: 'Learn the difference between permissions (what actions a user can take) and service areas (which physical tables they manage).',
    category: 'staff-roles-permissions',
    keywords: ['roles vs areas', 'what vs where', 'permissions', 'waiter routing', 'zone assignment', 'authority'],
    allowedRoles: ['business_owner', 'branch_manager'],
    estimatedReadMinutes: 3,
    steps: [
      {
        number: 1,
        title: 'Roles & Permissions Define WHAT Someone Can Do',
        instruction: 'A role (like "Waiter" or "Cashier") defines access rights across dashboard routes: e.g. taking orders, viewing kitchen queues, recording payments, editing menus, or viewing sales reports.',
      },
      {
        number: 2,
        title: 'Service Areas Define WHERE Someone Operates',
        instruction: 'Service areas (like "Rooftop" or "Section B") partition your physical floor plan. When a waiter is assigned to the "Rooftop" area, their tablet only receives assistance notifications and approval alerts for tables in that zone.',
      },
      {
        number: 3,
        title: 'Combining Roles and Areas for High Operational Efficiency',
        instruction: 'A staff member can have the "Waiter" role while being stationed at "Indoor Dining" during the lunch shift and "Patio" during dinner service, all without changing their security permissions.',
      },
    ],
    notes: [
      'Staff members can be assigned to multiple service areas or all areas if they oversee the entire floor.',
    ],
    relatedArticles: ['inviting-and-managing-staff-members', 'assigning-waiters-to-service-areas', 'waiter-dashboard-overview'],
    directAction: {
      label: 'View Team Members',
      href: '/dashboard/team',
    },
  },
  {
    slug: 'custom-roles-and-permissions-management',
    title: 'Custom Roles, Permission Toggles & Role Templates',
    description: 'Create bespoke roles with granular permissions or customize default role capabilities for shift leaders and head chefs.',
    category: 'staff-roles-permissions',
    keywords: ['custom roles', 'permission toggles', 'role templates', 'granular permissions', 'access control'],
    allowedRoles: ['business_owner'],
    requiredPermissions: ['roles.view', 'staff.role.assign'],
    contextRoutes: ['/dashboard/team/roles'],
    estimatedReadMinutes: 4,
    steps: [
      {
        number: 1,
        title: 'Open Roles & Permissions Hub',
        instruction: 'Go to "/dashboard/team" and click the "Roles & Permissions" tab or navigate to "/dashboard/team/roles".',
      },
      {
        number: 2,
        title: 'Inspect Default Role Templates',
        instruction: 'Review standard role capabilities for Business Owner, Branch Manager, Cashier, Kitchen Staff, and Waiter.',
      },
      {
        number: 3,
        title: 'Create a Custom Role',
        instruction: 'Click "+ Create Custom Role". Choose a base template (e.g. "Supervisor" or "Head Bartender") and customize specific permission toggles for Menu, Orders, Tables, Staff, or Reports.',
      },
      {
        number: 4,
        title: 'Assign Custom Role to Staff',
        instruction: 'When inviting or editing a team member, select your new custom role from the role dropdown.',
      },
    ],
    notes: [
      'Only Business Owners have the authority to create custom roles and modify permission boundaries.',
    ],
    relatedArticles: ['inviting-and-managing-staff-members', 'understanding-roles-vs-service-areas'],
    directAction: {
      label: 'Manage Roles',
      href: '/dashboard/team/roles',
    },
  },
];
