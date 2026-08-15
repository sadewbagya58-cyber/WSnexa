import { PermissionKey } from '@/lib/validation/permission';

export interface HelpCategory {
  id: string;
  title: string;
  description: string;
  icon: string;
  order: number;
}

export interface HelpArticleStep {
  number: number;
  title: string;
  instruction: string;
  tip?: string;
}

export interface HelpArticle {
  slug: string;
  title: string;
  description: string;
  category: string;
  keywords: string[];
  allowedRoles?: string[]; // e.g. ['business_owner', 'branch_manager', 'waiter']
  requiredPermissions?: PermissionKey[];
  contextRoutes?: string[]; // e.g. ['/dashboard/menu', '/dashboard/menu/items']
  popular?: boolean;
  gettingStarted?: boolean;
  troubleshooting?: boolean;
  comingSoon?: boolean;
  estimatedReadMinutes?: number;
  steps: HelpArticleStep[];
  notes?: string[];
  relatedArticles?: string[]; // List of article slugs
  directAction?: {
    label: string;
    href: string;
  };
}

export interface QuickStartStep {
  id: string;
  title: string;
  description: string;
  route: string;
  guideSlug: string;
  isCompleted: boolean;
  requiredPermission?: PermissionKey;
}

export interface QuickStartProgress {
  totalSteps: number;
  completedSteps: number;
  percentage: number;
  steps: QuickStartStep[];
}
