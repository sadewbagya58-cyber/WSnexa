'use client';

import React from 'react';
import Link from 'next/link';
import { HelpCategory, HelpArticle } from '@/content/help/types';
import { HelpArticleCard } from './help-article-card';
import { HelpLanguageToggle } from './help-language-toggle';
import { SupportFallbackCard } from './support-fallback-card';
import { useHelpLanguage } from './help-language-context';

interface HelpCategoryViewProps {
  category: HelpCategory;
  articles: HelpArticle[];
}

export const HelpCategoryView: React.FC<HelpCategoryViewProps> = ({
  category,
  articles,
}) => {
  const { t } = useHelpLanguage();

  const title = t(category.title, category.titleSiEn);
  const description = t(category.description, category.descriptionSiEn);

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Breadcrumbs & Language Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-3">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-bold text-zinc-500 flex-wrap">
          <Link href="/dashboard/help" className="hover:text-zinc-950 transition-colors">
            Help Center
          </Link>
          <span>/</span>
          <span className="text-zinc-900 truncate max-w-[240px]">{title}</span>
        </nav>

        <HelpLanguageToggle showLabel={false} />
      </div>

      {/* Category Header */}
      <div className="border-b border-zinc-200 pb-5 space-y-2">
        <div className="flex items-start gap-3">
          <span className="text-3xl select-none pt-0.5">{category.icon}</span>
          <div className="space-y-1 min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight leading-tight break-words">
              {title}
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-zinc-500 leading-relaxed break-words">
              {description}
            </p>
          </div>
        </div>
      </div>

      {/* Articles Grid */}
      <div className="space-y-4">
        <h2 className="text-sm font-extrabold text-zinc-400 uppercase tracking-wider">
          {articles.length} Available Guide{articles.length === 1 ? '' : 's'}
        </h2>

        {articles.length === 0 ? (
          <div className="p-8 text-center rounded-3xl border border-zinc-200 bg-white">
            <p className="text-xs text-zinc-500 font-semibold">No guides published in this category yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {articles.map((article) => (
              <HelpArticleCard key={article.slug} article={article} />
            ))}
          </div>
        )}
      </div>

      {/* Support Fallback */}
      <SupportFallbackCard />
    </div>
  );
};
