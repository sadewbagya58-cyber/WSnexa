import React from 'react';
import Link from 'next/link';
import { HelpArticle } from '@/content/help/types';
import { Badge } from '@/components/ui/badge';

interface HelpArticleCardProps {
  article: HelpArticle;
  compact?: boolean;
}

export const HelpArticleCard: React.FC<HelpArticleCardProps> = ({
  article,
  compact = false,
}) => {
  return (
    <Link
      href={`/dashboard/help/${article.slug}`}
      className={`group block rounded-2xl border border-zinc-200 bg-white transition-all hover:border-zinc-300 hover:shadow-xs active:scale-[0.98] cursor-pointer ${
        compact ? 'p-4' : 'p-5 space-y-3'
      }`}
    >
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-base shrink-0">
            {article.troubleshooting ? '🔧' : article.comingSoon ? '✨' : '📖'}
          </span>
          <h4 className="text-xs sm:text-sm font-extrabold text-zinc-950 group-hover:text-amber-600 transition-colors truncate flex-1">
            {article.title}
          </h4>
          {article.troubleshooting && (
            <Badge variant="warning" className="text-[9px] px-1.5 py-0 shrink-0">
              Fix
            </Badge>
          )}
          {article.comingSoon && (
            <Badge variant="neutral" className="text-[9px] px-1.5 py-0 shrink-0">
              Soon
            </Badge>
          )}
        </div>

        {!compact && (
          <p className="text-[11px] font-medium text-zinc-500 line-clamp-2 leading-relaxed pl-6">
            {article.description}
          </p>
        )}

        <div className="flex items-center gap-3 pt-1 text-[10px] font-bold text-zinc-400 pl-6">
          <span>{article.steps.length} Steps</span>
          <span>•</span>
          <span>{article.estimatedReadMinutes || 3} min read</span>
        </div>
      </div>
    </Link>
  );
};
