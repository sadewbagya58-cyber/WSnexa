import React from 'react';
import Link from 'next/link';
import { getTroubleshootingArticles } from '@/content/help/registry';
import { HelpArticleCard } from '@/components/help/help-article-card';
import { HelpSearchBar } from '@/components/help/help-search-bar';
import { HelpLanguageToggle } from '@/components/help/help-language-toggle';
import { SupportFallbackCard } from '@/components/help/support-fallback-card';

export default function TroubleshootingDirectoryPage() {
  const troubleshootingGuides = getTroubleshootingArticles();

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Breadcrumbs & Language Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-3">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-bold text-zinc-500">
          <Link href="/dashboard/help" className="hover:text-zinc-950 transition-colors">
            Help Center
          </Link>
          <span>/</span>
          <span className="text-zinc-900">Troubleshooting</span>
        </nav>
        <HelpLanguageToggle showLabel={false} />
      </div>

      {/* Header */}
      <div className="space-y-4 text-center border-b border-zinc-200 pb-8">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-3xl mx-auto shadow-2xs select-none">
          🔧
        </div>
        <div className="space-y-1 max-w-lg mx-auto">
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
            Troubleshooting Center
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-zinc-500">
            Diagnose common operational questions, QR scan errors, network status, and approval workflows.
          </p>
        </div>

        {/* Focused Troubleshooting Search */}
        <div className="pt-2">
          <HelpSearchBar placeholder="Search for your issue (e.g. order not reaching kitchen, camera scan, location error...)" />
        </div>
      </div>

      {/* Troubleshooting Guides Grid */}
      <div className="space-y-4">
        <h2 className="text-sm font-extrabold text-zinc-400 uppercase tracking-wider">
          All Problem-Solving Guides ({troubleshootingGuides.length})
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {troubleshootingGuides.map((article) => (
            <HelpArticleCard key={article.slug} article={article} />
          ))}
        </div>
      </div>

      {/* Support Fallback */}
      <SupportFallbackCard />
    </div>
  );
}
