import React from 'react';
import Link from 'next/link';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { QuickStartService } from '@/server/services/quick-start.service';
import {
  getAllCategories,
  getArticlesByCategory,
  getPopularArticles,
  getRecommendedArticles,
  getTroubleshootingArticles,
} from '@/content/help/registry';
import { HelpSearchBar } from '@/components/help/help-search-bar';
import { QuickStartChecklist } from '@/components/help/quick-start-checklist';
import { HelpCategoryCard } from '@/components/help/help-category-card';
import { HelpArticleCard } from '@/components/help/help-article-card';
import { SupportFallbackCard } from '@/components/help/support-fallback-card';
import { HelpLanguageToggle } from '@/components/help/help-language-toggle';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function HelpCenterPage() {
  const context = await resolveActiveBusinessContext();

  const businessId = context?.business?.id || '';
  const branchId = context?.activeBranch?.id || undefined;
  const userRole = context?.membership?.role || 'business_owner';

  // Evaluate genuine database readiness progress
  const progress = businessId
    ? await QuickStartService.getReadinessProgress(businessId, branchId)
    : { totalSteps: 11, completedSteps: 0, percentage: 0, steps: [] };

  const categories = getAllCategories();
  const recommendedGuides = getRecommendedArticles(userRole);
  const popularGuides = getPopularArticles();
  const troubleshootingGuides = getTroubleshootingArticles();

  function formatRoleLabel(role: string): string {
    switch (role) {
      case 'business_owner': return 'Business Owner';
      case 'branch_manager': return 'Branch Manager';
      case 'cashier': return 'Cashier';
      case 'kitchen_staff': return 'Kitchen Team';
      case 'waiter': return 'Waitstaff';
      default: return role.replace(/_/g, ' ');
    }
  }

  return (
    <div className="space-y-10 max-w-6xl mx-auto pb-12">
      {/* Hero Header, Language Selector & Search */}
      <div className="text-center space-y-6 pt-2 sm:pt-4">
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Badge variant="neutral" className="font-extrabold text-[10px] uppercase tracking-wider px-3 py-1">
              WSNexa Knowledge Base & User Guides
            </Badge>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight">
            Help Center & Guides
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-zinc-500 max-w-lg mx-auto">
            Learn how to configure dining areas, manage menus, process live orders, and troubleshoot your venue.
          </p>

          {/* Bilingual Language Switcher (English vs Sinhala + English Mix) */}
          <div className="pt-2 flex justify-center">
            <HelpLanguageToggle />
          </div>
        </div>

        {/* Prominent Search Bar */}
        <HelpSearchBar userRole={userRole} />
      </div>

      {/* Quick Start Readiness Checklist (For Owners & Managers) */}
      {(userRole === 'business_owner' || userRole === 'branch_manager') && (
        <QuickStartChecklist progress={progress} />
      )}

      {/* Recommended for You (Role-Aware) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg select-none">⭐</span>
            <div>
              <h2 className="text-base font-extrabold text-zinc-950">
                Recommended for You ({formatRoleLabel(userRole)})
              </h2>
              <p className="text-[11px] text-zinc-500 font-medium">
                Tailored guides suited to your operational workspace and permissions.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recommendedGuides.map((article) => (
            <HelpArticleCard key={article.slug} article={article} />
          ))}
        </div>
      </div>

      {/* Popular Guides */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg select-none">🔥</span>
            <div>
              <h2 className="text-base font-extrabold text-zinc-950">
                Popular Guides & Core Workflows
              </h2>
              <p className="text-[11px] text-zinc-500 font-medium">
                Essential setup steps and operational guides across the platform.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {popularGuides.slice(0, 6).map((article) => (
            <HelpArticleCard key={article.slug} article={article} />
          ))}
        </div>
      </div>

      {/* Browse by Category */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg select-none">📚</span>
            <div>
              <h2 className="text-base font-extrabold text-zinc-950">
                Browse by Category
              </h2>
              <p className="text-[11px] text-zinc-500 font-medium">
                Explore all {categories.length} structured knowledge sections.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {categories.map((cat) => (
            <HelpCategoryCard
              key={cat.id}
              category={cat}
              articleCount={getArticlesByCategory(cat.id).length}
            />
          ))}
        </div>
      </div>

      {/* Troubleshooting Center */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg select-none">🔧</span>
            <div>
              <h2 className="text-base font-extrabold text-zinc-950">
                Troubleshooting Center
              </h2>
              <p className="text-[11px] text-zinc-500 font-medium">
                Step-by-step diagnostic solutions for operational, QR, and network challenges.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/help/troubleshooting"
            className="text-xs font-bold text-zinc-700 hover:text-zinc-950 underline"
          >
            View All ({troubleshootingGuides.length}) →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {troubleshootingGuides.slice(0, 6).map((article) => (
            <HelpArticleCard key={article.slug} article={article} />
          ))}
        </div>
      </div>

      {/* Support Fallback Footer */}
      <SupportFallbackCard />
    </div>
  );
}
