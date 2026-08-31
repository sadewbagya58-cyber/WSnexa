import { PermissionKey } from '@/lib/validation/permission';

export interface HelpCategory {
  id: string;
  title: string;
  titleSiEn?: string;
  description: string;
  descriptionSiEn?: string;
  icon: string;
  order: number;
}

export interface HelpArticleStep {
  number: number;
  title: string;
  titleSiEn?: string;
  instruction: string;
  instructionSiEn?: string;
  tip?: string;
  tipSiEn?: string;
}

export interface TroubleshootingCheck {
  check: string;
  checkSiEn?: string;
  action: string;
  actionSiEn?: string;
}

export interface HelpArticle {
  slug: string;
  title: string;
  titleSiEn?: string;
  description: string;
  descriptionSiEn?: string;
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
  notesSiEn?: string[];
  troubleshootingChecks?: TroubleshootingCheck[];
  relatedArticles?: string[]; // List of article slugs
  directAction?: {
    label: string;
    labelSiEn?: string;
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

