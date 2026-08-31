import { HelpArticle, HelpCategory } from './types';
import { HELP_CATEGORIES } from './categories';
import { GETTING_STARTED_ARTICLES } from './articles/getting-started';
import { BUSINESS_BRANCHES_ARTICLES } from './articles/business-branches';
import { MENU_MANAGEMENT_ARTICLES } from './articles/menu-management';
import { SERVICE_AREAS_TABLES_QR_ARTICLES } from './articles/service-areas-tables-qr';
import { ORDERS_ARTICLES } from './articles/orders';
import { STAFF_ROLES_PERMISSIONS_ARTICLES } from './articles/staff-roles-permissions';
import { WAITER_OPERATIONS_ARTICLES } from './articles/waiter-operations';
import { KITCHEN_OPERATIONS_ARTICLES } from './articles/kitchen-operations';
import { CASHIER_PAYMENTS_ARTICLES } from './articles/cashier-payments';
import { ORDER_SECURITY_ARTICLES } from './articles/order-security';
import { VENUE_PROFILE_DISCOVERY_ARTICLES } from './articles/venue-profile-discovery';
import { inventoryArticles } from './articles/inventory';
import { TROUBLESHOOTING_ARTICLES } from './articles/troubleshooting';
import { COMING_SOON_ARTICLES } from './articles/coming-soon';
import { ACCOUNT_SETTINGS_ARTICLES } from './articles/account-settings';

// ── Master Article Collection ────────────────────────────────────────────────

const ALL_ARTICLES: HelpArticle[] = [
  ...GETTING_STARTED_ARTICLES,
  ...BUSINESS_BRANCHES_ARTICLES,
  ...SERVICE_AREAS_TABLES_QR_ARTICLES,
  ...MENU_MANAGEMENT_ARTICLES,
  ...ORDERS_ARTICLES,
  ...KITCHEN_OPERATIONS_ARTICLES,
  ...WAITER_OPERATIONS_ARTICLES,
  ...CASHIER_PAYMENTS_ARTICLES,
  ...ORDER_SECURITY_ARTICLES,
  ...STAFF_ROLES_PERMISSIONS_ARTICLES,
  ...inventoryArticles,
  ...VENUE_PROFILE_DISCOVERY_ARTICLES,
  ...TROUBLESHOOTING_ARTICLES,
  ...COMING_SOON_ARTICLES,
  ...ACCOUNT_SETTINGS_ARTICLES,
];


// ── Query Methods ────────────────────────────────────────────────────────────

export function getAllCategories(): HelpCategory[] {
  return [...HELP_CATEGORIES].sort((a, b) => a.order - b.order);
}

export function getCategoryById(id: string): HelpCategory | undefined {
  return HELP_CATEGORIES.find((c) => c.id === id);
}

export function getAllArticles(): HelpArticle[] {
  return ALL_ARTICLES;
}

export function getComingSoonArticles(): HelpArticle[] {
  return ALL_ARTICLES.filter((a) => a.comingSoon);
}


const SLUG_ALIASES: Record<string, string> = {
  'understanding-order-security-levels': 'order-security-overview',
  'setting-up-public-venue-profile': 'publishing-your-venue-profile',
  'creating-menu-categories': 'create-categories',
  'adding-menu-items': 'add-menu-items',
  'generate-qr-codes': 'generating-and-printing-qr-codes',
  'generating-table-qr-codes': 'generating-and-printing-qr-codes',
  'inviting-staff-and-assigning-roles': 'invite-staff-members',
  'welcome-to-wsnexa': 'what-is-wsnexa',
  'setting-up-your-business': 'complete-business-setup',
  'setting-up-your-first-branch': 'add-manage-branches',
  'creating-service-areas': 'create-service-areas',
  'adding-dining-tables': 'add-dining-tables',
  'configuring-table-pins': 'configure-table-pins',
  'order-processing-lifecycle': 'how-customer-orders-flow',
  'kitchen-display-system-guide': 'kitchen-queue-kds-overview',
  'understanding-roles-and-permissions': 'roles-and-permissions-guide',
  'inventory-quick-start': 'inventory-basics-stock-items',
  'adding-inventory-items-and-units': 'inventory-basics-stock-items',
  'taking-table-orders': 'taking-table-orders-as-a-waiter',
  'order-not-appearing-in-kitchen': 'troubleshooting-order-not-reaching-kitchen',
};

export function getArticleBySlug(slug: string): HelpArticle | undefined {
  const direct = ALL_ARTICLES.find((a) => a.slug === slug);
  if (direct) return direct;
  const targetSlug = SLUG_ALIASES[slug];
  if (targetSlug) {
    return ALL_ARTICLES.find((a) => a.slug === targetSlug);
  }
  return undefined;
}


export function getArticlesByCategory(categoryId: string): HelpArticle[] {
  return ALL_ARTICLES.filter((a) => a.category === categoryId);
}

export function getPopularArticles(): HelpArticle[] {
  return ALL_ARTICLES.filter((a) => a.popular);
}

export function getGettingStartedArticles(): HelpArticle[] {
  return ALL_ARTICLES.filter((a) => a.gettingStarted);
}

export function getTroubleshootingArticles(): HelpArticle[] {
  return ALL_ARTICLES.filter((a) => a.troubleshooting);
}

/**
 * Resolves context-sensitive Help articles matching a specific dashboard route.
 */
export function getArticlesForRoute(route: string): HelpArticle[] {
  if (!route) return [];
  return ALL_ARTICLES.filter((a) => {
    if (!a.contextRoutes || a.contextRoutes.length === 0) return false;
    return a.contextRoutes.some((cr) => route === cr || route.startsWith(`${cr}/`));
  });
}

/**
 * Returns role-aware recommendations tailored to the user's operational role.
 */
export function getRecommendedArticles(
  userRole?: string,
  userPermissions: string[] = []
): HelpArticle[] {
  const role = userRole?.toLowerCase() || 'business_owner';

  if (role === 'waiter') {
    return ALL_ARTICLES.filter(
      (a) =>
        a.category === 'waiter-operations' ||
        a.slug === 'waiter-terminal-overview' ||
        a.slug === 'taking-table-orders-as-a-waiter' ||
        a.slug === 'approving-guest-qr-orders'
    ).slice(0, 5);
  }


  if (role === 'kitchen_staff') {
    return ALL_ARTICLES.filter(
      (a) =>
        a.category === 'kitchen-operations' ||
        a.slug === 'kitchen-queue-kds-overview' ||
        a.slug === 'updating-preparation-status' ||
        a.slug === 'troubleshooting-order-not-reaching-kitchen'
    ).slice(0, 5);
  }

  if (role === 'cashier') {
    return ALL_ARTICLES.filter(
      (a) =>
        a.category === 'cashier-payments' ||
        a.slug === 'cashier-pos-overview' ||
        a.slug === 'settling-table-bills' ||
        a.slug === 'payment-types-cash-card-online'
    ).slice(0, 5);
  }

  if (role === 'branch_manager' || role === 'supervisor') {
    return ALL_ARTICLES.filter(
      (a) =>
        a.slug === 'setting-up-your-business' ||
        a.slug === 'complete-business-setup' ||
        a.slug === 'create-service-areas' ||
        a.slug === 'add-menu-items' ||
        a.slug === 'how-customer-orders-flow' ||
        a.slug === 'invite-staff-members'
    ).slice(0, 6);
  }

  // If user has specific granted permissions, surface related setup guides
  if (userPermissions.length > 0 && !userPermissions.includes('*')) {
    const permGuides = ALL_ARTICLES.filter((a) =>
      a.requiredPermissions?.some((p) => userPermissions.includes(p))
    );
    if (permGuides.length > 0) {
      return permGuides.slice(0, 6);
    }
  }

  // Default: Business Owner (High-level launch, setup, security, revenue)
  return ALL_ARTICLES.filter(
    (a) =>
      a.slug === 'what-is-wsnexa' ||
      a.slug === 'complete-business-setup' ||
      a.slug === 'create-service-areas' ||
      a.slug === 'generating-and-printing-qr-codes' ||
      a.slug === 'add-menu-items' ||
      a.slug === 'order-security-overview'
  ).slice(0, 6);
}



/**
 * High-performance search with bilingual multi-field scoring and synonym resolution.
 */
export function searchHelpArticles(
  query: string,
  userRole?: string,
  userPermissions: string[] = []
): { article: HelpArticle; score: number }[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const terms = q.split(/\s+/).filter(Boolean);
  const results: { article: HelpArticle; score: number }[] = [];

  for (const article of ALL_ARTICLES) {
    let score = 0;
    const titleLower = article.title.toLowerCase();
    const titleSiEnLower = (article.titleSiEn || '').toLowerCase();
    const descLower = article.description.toLowerCase();
    const descSiEnLower = (article.descriptionSiEn || '').toLowerCase();
    const catLower = article.category.toLowerCase();
    const keywordsLower = article.keywords.map((k) => k.toLowerCase());

    // 1. Exact match bonus
    if (article.slug === q || titleLower === q || titleSiEnLower === q) score += 200;
    else if (titleLower.includes(q) || titleSiEnLower.includes(q)) score += 60;

    if (descLower.includes(q) || descSiEnLower.includes(q)) score += 25;

    // 2. Keyword exact / substring matches
    for (const kw of keywordsLower) {
      if (kw === q) score += 150;
      else if (kw.includes(q) || q.includes(kw)) score += 35;
    }


    // 3. Category match
    if (catLower.includes(q)) score += 15;

    // 4. Term-by-term scoring
    for (const term of terms) {
      if (titleLower.includes(term) || titleSiEnLower.includes(term)) score += 12;
      if (descLower.includes(term) || descSiEnLower.includes(term)) score += 6;
      if (keywordsLower.some((k) => k.includes(term))) score += 10;

      // Check inside step instructions
      for (const step of article.steps) {
        if (step.title.toLowerCase().includes(term) || (step.titleSiEn && step.titleSiEn.toLowerCase().includes(term))) score += 4;
        if (step.instruction.toLowerCase().includes(term) || (step.instructionSiEn && step.instructionSiEn.toLowerCase().includes(term))) score += 3;
      }
    }

    // 5. Role or permission alignment subtle boost
    if (article.allowedRoles && userRole && article.allowedRoles.includes(userRole)) {
      score += 5;
    }
    if (
      article.requiredPermissions &&
      userPermissions.length > 0 &&
      article.requiredPermissions.some((p) => userPermissions.includes(p))
    ) {
      score += 5;
    }

    if (score > 0) {
      results.push({ article, score });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}
