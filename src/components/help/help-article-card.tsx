'use client';

import React from 'react';
import Link from 'next/link';
import { HelpArticle } from '@/content/help/types';
import { Badge } from '@/components/ui/badge';
import { useHelpLanguage } from './help-language-context';

interface HelpArticleCardProps {
  article: HelpArticle;
  compact?: boolean;
}

export const HelpArticleCard: React.FC<HelpArticleCardProps> = ({
  article,
  compact = false,
}) => {
  const { t } = useHelpLanguage();

  const title = t(article.title, article.titleSiEn);
  const description = t(article.description, article.descriptionSiEn);

  return (
    <Link
      href={`/dashboard/help/${article.slug}`}
      className={`group block rounded-2xl border border-zinc-200 bg-white transition-all hover:border-zinc-300 hover:shadow-xs active:scale-[0.98] cursor-pointer ${
        compact ? 'p-4' : 'p-5 space-y-3'
      }`}
    >
      <div className="space-y-1.5">
        <div className="flex items-start gap-2.5">
          <span className="text-base shrink-0 pt-0.5 select-none">
            {article.troubleshooting ? '🔧' : article.comingSoon ? '✨' : '📖'}
          </span>
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="text-xs sm:text-sm font-extrabold text-zinc-950 group-hover:text-amber-600 transition-colors leading-snug break-words">
                {title}
              </h4>
              {article.troubleshooting && (
                <Badge variant="warning" className="text-[9px] px-1.5 py-0 shrink-0">
                  Fix
                </Badge>
              )}
            </div>
            {!compact && (
              <p className="text-[11px] font-medium text-zinc-500 line-clamp-2 leading-relaxed break-words">
                {description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1 text-[10px] font-bold text-zinc-400 pl-6 sm:pl-7">
          <span>{article.steps.length} Steps</span>
          <span>•</span>
          <span>{article.estimatedReadMinutes || 3} min read</span>
        </div>
      </div>
    </Link>
  );
};
