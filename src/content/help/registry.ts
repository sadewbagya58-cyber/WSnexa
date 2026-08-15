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
import { ACCOUNT_SETTINGS_ARTICLES } from './articles/account-settings';
import { TROUBLESHOOTING_ARTICLES } from './articles/troubleshooting';
import { COMING_SOON_ARTICLES } from './articles/coming-soon';

// ── Master Article Collection ────────────────────────────────────────────────

const ALL_ARTICLES: HelpArticle[] = [
  ...GETTING_STARTED_ARTICLES,
  ...BUSINESS_BRANCHES_ARTICLES,
  ...MENU_MANAGEMENT_ARTICLES,
  ...SERVICE_AREAS_TABLES_QR_ARTICLES,
  ...ORDERS_ARTICLES,
  ...STAFF_ROLES_PERMISSIONS_ARTICLES,
  ...WAITER_OPERATIONS_ARTICLES,
  ...KITCHEN_OPERATIONS_ARTICLES,
  ...CASHIER_PAYMENTS_ARTICLES,
  ...ORDER_SECURITY_ARTICLES,
  ...VENUE_PROFILE_DISCOVERY_ARTICLES,
  ...ACCOUNT_SETTINGS_ARTICLES,
  ...TROUBLESHOOTING_ARTICLES,
  ...COMING_SOON_ARTICLES,
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

export function getArticleBySlug(slug: string): HelpArticle | undefined {
  return ALL_ARTICLES.find((a) => a.slug === slug);
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

export function getComingSoonArticles(): HelpArticle[] {
  return ALL_ARTICLES.filter((a) => a.comingSoon);
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
        a.slug === 'troubleshooting-waiter-cannot-see-request' ||
        a.slug === 'order-processing-lifecycle'
    ).slice(0, 5);
  }

  if (role === 'kitchen_staff') {
    return ALL_ARTICLES.filter(
      (a) =>
        a.category === 'kitchen-operations' ||
        a.slug === 'managing-sold-out-and-availability' ||
        a.slug === 'troubleshooting-order-not-reaching-kitchen'
    ).slice(0, 5);
  }

  if (role === 'cashier') {
    return ALL_ARTICLES.filter(
      (a) =>
        a.category === 'cashier-payments' ||
        a.slug === 'order-processing-lifecycle' ||
        a.slug === 'cancelling-and-voiding-orders'
    ).slice(0, 5);
  }

  if (role === 'branch_manager' || role === 'supervisor') {
    return ALL_ARTICLES.filter(
      (a) =>
        a.category === 'orders' ||
        a.category === 'staff-roles-permissions' ||
        a.category === 'service-areas-tables-qr' ||
        a.category === 'menu-management'
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
      a.slug === 'welcome-to-wsnexa' ||
      a.slug === 'setting-up-your-business' ||
      a.slug === 'creating-menu-categories' ||
      a.slug === 'generating-and-printing-qr-codes' ||
      a.slug === 'understanding-order-security-levels' ||
      a.slug === 'publishing-your-venue-checklist'
  ).slice(0, 6);
}

/**
 * High-performance search with multi-field scoring and synonym resolution.
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
    const descLower = article.description.toLowerCase();
    const catLower = article.category.toLowerCase();
    const keywordsLower = article.keywords.map((k) => k.toLowerCase());

    // 1. Exact match bonus
    if (titleLower === q) score += 100;
    else if (titleLower.includes(q)) score += 50;

    if (descLower.includes(q)) score += 25;

    // 2. Keyword exact / substring matches
    for (const kw of keywordsLower) {
      if (kw === q) score += 40;
      else if (kw.includes(q) || q.includes(kw)) score += 20;
    }

    // 3. Category match
    if (catLower.includes(q)) score += 15;

    // 4. Term-by-term scoring
    for (const term of terms) {
      if (titleLower.includes(term)) score += 10;
      if (descLower.includes(term)) score += 5;
      if (keywordsLower.some((k) => k.includes(term))) score += 8;

      // Check inside step instructions
      for (const step of article.steps) {
        if (step.title.toLowerCase().includes(term)) score += 3;
        if (step.instruction.toLowerCase().includes(term)) score += 2;
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
