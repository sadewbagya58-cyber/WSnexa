'use client';

import React from 'react';
import Link from 'next/link';
import { HelpArticle, HelpCategory } from '@/content/help/types';
import { Badge } from '@/components/ui/badge';
import { HelpArticleCard } from './help-article-card';
import { HelpLanguageToggle } from './help-language-toggle';
import { SupportFallbackCard } from './support-fallback-card';
import { useHelpLanguage } from './help-language-context';

interface HelpArticleViewProps {
  article: HelpArticle;
  category?: HelpCategory;
  relatedArticles: HelpArticle[];
}

export const HelpArticleView: React.FC<HelpArticleViewProps> = ({
  article,
  category,
  relatedArticles,
}) => {
  const { t, tArray } = useHelpLanguage();

  const title = t(article.title, article.titleSiEn);
  const description = t(article.description, article.descriptionSiEn);
  const notes = tArray(article.notes, article.notesSiEn);

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      {/* Top Header Row: Breadcrumbs & Language Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-3">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-bold text-zinc-500 flex-wrap">
          <Link href="/dashboard/help" className="hover:text-zinc-950 transition-colors">
            Help Center
          </Link>
          <span>/</span>
          {category && (
            <>
              <Link
                href={`/dashboard/help/category/${category.id}`}
                className="hover:text-zinc-950 transition-colors"
              >
                {t(category.title, category.titleSiEn)}
              </Link>
              <span>/</span>
            </>
          )}
          <span className="text-zinc-900 truncate max-w-[200px] sm:max-w-none">
            {title}
          </span>
        </nav>

        <HelpLanguageToggle showLabel={false} />
      </div>

      {/* Article Header */}
      <div className="space-y-4 border-b border-zinc-200 pb-6">
        <div className="flex flex-wrap items-center gap-2">
          {category && (
            <Badge variant="neutral" className="text-[10px] font-extrabold uppercase tracking-wider">
              {category.icon} {t(category.title, category.titleSiEn)}
            </Badge>
          )}
          {article.troubleshooting && (
            <Badge variant="warning" className="text-[10px] font-extrabold">
              🔧 Troubleshooting Guide
            </Badge>
          )}
          <span className="text-xs text-zinc-400 font-semibold">
            • {article.estimatedReadMinutes || 3} min read
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight leading-tight break-words">
          {title}
        </h1>

        <p className="text-sm sm:text-base font-semibold text-zinc-600 leading-relaxed break-words">
          {description}
        </p>

        {article.directAction && (
          <div className="pt-2">
            <Link
              href={article.directAction.href}
              className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-zinc-950 px-5 py-2.5 text-xs font-extrabold text-white shadow-2xs hover:bg-zinc-800 active:scale-[0.97] transition-all cursor-pointer touch-manipulation"
            >
              {t(article.directAction.label, article.directAction.labelSiEn)} →
            </Link>
          </div>
        )}
      </div>

      {/* Procedural Step-by-Step Instructions */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 border-b border-zinc-100 pb-2">
          <span className="text-lg select-none">📋</span>
          <h2 className="text-base font-extrabold text-zinc-950">
            Step-by-Step Guide
          </h2>
        </div>

        <div className="space-y-4">
          {article.steps.map((step) => {
            const stepTitle = t(step.title, step.titleSiEn);
            const stepInstruction = t(step.instruction, step.instructionSiEn);
            const stepTip = step.tip ? t(step.tip, step.tipSiEn) : undefined;

            return (
              <div
                key={step.number}
                className="flex items-start gap-3.5 p-4 sm:p-5 rounded-2xl border border-zinc-200 bg-white shadow-2xs space-y-2"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-white font-black text-xs shadow-xs mt-0.5 select-none">
                  {step.number}
                </span>

                <div className="space-y-1.5 flex-1 min-w-0">
                  <h3 className="text-sm font-extrabold text-zinc-950 leading-snug break-words">
                    {stepTitle}
                  </h3>
                  <p className="text-xs sm:text-sm font-medium text-zinc-600 leading-relaxed break-words">
                    {stepInstruction}
                  </p>

                  {stepTip && (
                    <div className="mt-2 p-3 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-950 text-xs font-medium leading-relaxed">
                      <span className="font-bold">💡 Tip: </span>
                      {stepTip}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Troubleshooting Checks (If Available) */}
      {article.troubleshootingChecks && article.troubleshootingChecks.length > 0 && (
        <div className="space-y-4 p-5 rounded-2xl bg-amber-50/70 border border-amber-200">
          <div className="flex items-center gap-2">
            <span className="text-base select-none">🔍</span>
            <h3 className="text-sm font-extrabold text-amber-950 uppercase tracking-wide">
              Quick Diagnostic Checks
            </h3>
          </div>
          <div className="space-y-2.5">
            {article.troubleshootingChecks.map((tc, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-white border border-amber-200/60 space-y-1 text-xs">
                <p className="font-bold text-zinc-900">
                  ❓ {t(tc.check, tc.checkSiEn)}
                </p>
                <p className="text-zinc-600 pl-4 font-medium leading-relaxed">
                  👉 {t(tc.action, tc.actionSiEn)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Important Notes */}
      {notes.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 space-y-2 text-xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
            Important Information
          </span>
          <ul className="list-disc pl-4 space-y-1 text-zinc-600 font-medium leading-relaxed">
            {notes.map((note, idx) => (
              <li key={idx}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Related Articles */}
      {relatedArticles.length > 0 && (
        <div className="space-y-4 border-t border-zinc-200 pt-8">
          <h3 className="text-sm font-extrabold text-zinc-950 uppercase tracking-wider">
            Related Guides
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {relatedArticles.map((rel) => (
              <HelpArticleCard key={rel.slug} article={rel} compact />
            ))}
          </div>
        </div>
      )}

      {/* Support Card */}
      <SupportFallbackCard />
    </div>
  );
};
