export type SetupStageTier = 'required' | 'recommended' | 'optional';
export type SetupStageStatus = 'completed' | 'in_progress' | 'not_started' | 'blocked';
export type SetupStageScope = 'ORGANIZATION' | 'BRANCH';

export interface SetupSubstep {
  id: string;
  label: string;
  isCompleted: boolean;
  href: string;
  description?: string;
}

export interface SetupStageConfig {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  icon: string;
  tier: SetupStageTier;
  scope: SetupStageScope;
  href: string;
  ctaLabel: string;
  dependencyStageId?: string;
  requiredPermission?: string | string[];
}

export interface SetupStageState extends SetupStageConfig {
  status: SetupStageStatus;
  isCompleted: boolean;
  completionDetail: string;
  substeps?: SetupSubstep[];
  nextActionHref: string;
  nextActionLabel: string;
}

export interface SetupJourneyReport {
  businessId: string;
  businessName: string;
  branchId: string;
  branchName: string;
  totalRequired: number;
  completedRequired: number;
  totalRecommended: number;
  completedRecommended: number;
  totalOptional: number;
  completedOptional: number;
  isCoreSetupComplete: boolean;
  overallPercentage: number;
  nextStage: SetupStageState | null;
  stages: SetupStageState[];
}

/**
 * Canonical 10-Stage Setup Sequence for WSNexa Progressive Onboarding.
 */
export const CANONICAL_SETUP_STAGES: SetupStageConfig[] = [
  {
    id: 'business_basics',
    title: '1. Business Basics & Defaults',
    shortTitle: 'Business Basics',
    description: 'Verify your business name, primary currency, operating timezone, and country defaults.',
    icon: '🏢',
    tier: 'required',
    scope: 'ORGANIZATION',
    href: '/dashboard/business',
    ctaLabel: 'Review Profile',
    requiredPermission: ['business.view', 'business.manage'],
  },
  {
    id: 'location',
    title: '2. Primary Branch Outlet',
    shortTitle: 'Branch Outlet',
    description: 'Configure your active outlet branch, street address, and contact details.',
    icon: '📍',
    tier: 'required',
    scope: 'BRANCH',
    href: '/dashboard/branches',
    ctaLabel: 'Manage Branches',
    requiredPermission: ['branches.view', 'branches.manage'],
  },
  {
    id: 'dining_qr',
    title: '3. Dining Areas & QR Tables',
    shortTitle: 'Dining & QR',
    description: 'Set up service areas (Indoor/Outdoor), add dining tables, and generate guest QR codes with security PINs.',
    icon: '🪑',
    tier: 'required',
    scope: 'BRANCH',
    href: '/dashboard/areas',
    ctaLabel: 'Set Up Dining',
    dependencyStageId: 'location',
    requiredPermission: ['tables.view', 'tables.manage', 'qr.view', 'qr.generate'],
  },
  {
    id: 'menu',
    title: '4. Build Your Menu Catalog',
    shortTitle: 'Menu & Items',
    description: 'Create menu categories and add your food & beverage items with pricing and descriptions.',
    icon: '🍽️',
    tier: 'required',
    scope: 'BRANCH',
    href: '/dashboard/menu/categories',
    ctaLabel: 'Build Menu',
    requiredPermission: ['menu.view', 'menu.manage', 'menu.items.create'],
  },
  {
    id: 'ordering_security',
    title: '5. Order Security & Payments',
    shortTitle: 'Order Security',
    description: 'Configure waiter approval rules before kitchen dispatch and active payment methods (Cash, Card, Online).',
    icon: '🔒',
    tier: 'required',
    scope: 'BRANCH',
    href: '/dashboard/settings/order-security',
    ctaLabel: 'Configure Security',
    requiredPermission: ['order_security.view', 'order_security.manage'],
  },
  {
    id: 'team',
    title: '6. Staff & Team Roles',
    shortTitle: 'Team & Staff',
    description: 'Invite your branch managers, cashiers, kitchen staff, and waiters with role-based access.',
    icon: '👔',
    tier: 'recommended',
    scope: 'ORGANIZATION',
    href: '/dashboard/team/invites',
    ctaLabel: 'Invite Staff',
    requiredPermission: ['staff.invite', 'roles.view'],
  },
  {
    id: 'venue_profile',
    title: '7. Public Venue Discovery Profile',
    shortTitle: 'Venue Profile',
    description: 'Publish your guest-facing venue profile with photos, cuisine tags, and public contact information.',
    icon: '🌐',
    tier: 'recommended',
    scope: 'ORGANIZATION',
    href: '/dashboard/venue-profile',
    ctaLabel: 'Edit Venue Profile',
    requiredPermission: ['business.manage'],
  },
  {
    id: 'operations_inventory',
    title: '8. Operations, Inventory & Recipes',
    shortTitle: 'Operations Hub',
    description: 'Track raw stock ingredients, configure recipes (BOM), manage suppliers, and issue purchase orders.',
    icon: '📦',
    tier: 'optional',
    scope: 'BRANCH',
    href: '/dashboard/inventory',
    ctaLabel: 'Explore Inventory',
    requiredPermission: ['inventory.view', 'inventory.manage'],
  },
  {
    id: 'test_order',
    title: '9. Place a Real Test Order',
    shortTitle: 'Test Live Order',
    description: 'Scan your QR menu or open the waiter terminal to place a test order and verify kitchen & cashier dispatch.',
    icon: '🧪',
    tier: 'required',
    scope: 'BRANCH',
    href: '/dashboard/orders',
    ctaLabel: 'Review Orders',
    dependencyStageId: 'dining_qr',
    requiredPermission: ['orders.view', 'kitchen.access', 'cashier.access'],
  },
  {
    id: 'launch_ready',
    title: '10. Core Setup Summary',
    shortTitle: 'Setup Summary',
    description: 'Review your complete venue setup checklist across all modules.',
    icon: '🚀',
    tier: 'recommended',
    scope: 'BRANCH',
    href: '/dashboard/setup',
    ctaLabel: 'View Checklist',
    dependencyStageId: 'test_order',
  },
];