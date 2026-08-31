'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getArticlesForRoute, getArticleBySlug } from '@/content/help/registry';
import { HelpArticle } from '@/content/help/types';
import { Button } from '@/components/ui/button';
import { useHelpLanguage } from './help-language-context';
import { HelpLanguageToggle } from './help-language-toggle';

interface ContextualHelpButtonProps {
  explicitSlug?: string;
  explicitRoute?: string;
  label?: string;
  className?: string;
}

export const ContextualHelpButton: React.FC<ContextualHelpButtonProps> = ({
  explicitSlug,
  explicitRoute,
  label = 'Help & Guide',
  className = '',
}) => {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useHelpLanguage();

  const targetRoute = explicitRoute || pathname;
  let matchingArticles: HelpArticle[] = [];

  if (explicitSlug) {
    const single = getArticleBySlug(explicitSlug);
    if (single) matchingArticles = [single];
  } else {
    matchingArticles = getArticlesForRoute(targetRoute);
  }

  // If no matching articles for this route, default to Help Center overview
  if (matchingArticles.length === 0) {
    return (
      <Link href="/dashboard/help" className={className}>
        <Button variant="outline" size="sm" className="font-bold text-xs gap-1.5 touch-manipulation active:scale-[0.97]">
          <span>❓</span>
          <span>Help</span>
        </Button>
      </Link>
    );
  }

  const primaryArticle = matchingArticles[0];
  const articleTitle = t(primaryArticle.title, primaryArticle.titleSiEn);
  const articleDesc = t(primaryArticle.description, primaryArticle.descriptionSiEn);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className={`font-bold text-xs gap-1.5 border-amber-300/80 bg-amber-50/60 text-amber-950 hover:bg-amber-100 hover:text-amber-900 touch-manipulation active:scale-[0.97] transition-all shadow-2xs ${className}`}
        aria-label="Open contextual help"
      >
        <span>💡</span>
        <span>{label}</span>
      </Button>

      {/* Slide-out Contextual Help Drawer Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-end p-0 sm:p-4 animate-in fade-in-50 duration-150">
          <div
            className="w-full sm:max-w-md h-full sm:h-auto sm:max-h-[90vh] bg-white sm:rounded-3xl border border-zinc-200 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/80">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-xl shrink-0 select-none">📖</span>
                <div className="min-w-0">
                  <h3 className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                    Contextual Guide
                  </h3>
                  <h4 className="text-xs sm:text-sm font-extrabold text-zinc-950 truncate max-w-[220px] sm:max-w-[260px]">
                    {articleTitle}
                  </h4>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-xs font-bold text-zinc-400 hover:text-zinc-700 p-1.5 rounded-lg hover:bg-zinc-200 transition-all cursor-pointer touch-manipulation"
              >
                ✕ Close
              </button>
            </div>

            {/* Language Switcher inside Drawer */}
            <div className="px-4 py-2 bg-zinc-100/60 border-b border-zinc-200/60 flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-500">Language:</span>
              <HelpLanguageToggle showLabel={false} />
            </div>

            {/* Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              <p className="text-zinc-600 font-medium leading-relaxed">
                {articleDesc}
              </p>

              {/* Quick Steps */}
              <div className="space-y-2.5">
                <h5 className="font-extrabold text-zinc-900 uppercase text-[10px] tracking-wider text-zinc-400">
                  Step-by-Step Instructions
                </h5>
                <div className="space-y-2">
                  {primaryArticle.steps.map((step) => {
                    const stepTitle = t(step.title, step.titleSiEn);
                    const stepInstruction = t(step.instruction, step.instructionSiEn);
                    const stepTip = step.tip ? t(step.tip, step.tipSiEn) : undefined;

                    return (
                      <div
                        key={step.number}
                        className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/70 space-y-1"
                      >
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-white font-bold text-[10px]">
                            {step.number}
                          </span>
                          <h6 className="font-bold text-zinc-900 leading-snug">
                            {stepTitle}
                          </h6>
                        </div>
                        <p className="text-zinc-600 text-[11px] leading-relaxed pl-7">
                          {stepInstruction}
                        </p>
                        {stepTip && (
                          <div className="ml-7 mt-1.5 p-2 rounded-lg bg-amber-50/80 border border-amber-200/60 text-amber-950 text-[10px] font-medium leading-relaxed">
                            💡 {stepTip}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Related Full Guide Link */}
              <div className="pt-2">
                <Link
                  href={`/dashboard/help/${primaryArticle.slug}`}
                  onClick={() => setIsOpen(false)}
                  className="text-xs font-bold text-amber-700 hover:text-amber-900 underline block text-center py-1"
                >
                  View Full Guide & Related Articles →
                </Link>
              </div>
            </div>

            {/* Footer */}
            {primaryArticle.directAction && (
              <div className="p-3 sm:p-4 border-t border-zinc-100 bg-zinc-50">
                <Link
                  href={primaryArticle.directAction.href}
                  onClick={() => setIsOpen(false)}
                  className="w-full flex min-h-[44px] items-center justify-center rounded-xl bg-zinc-950 px-4 py-2 text-xs font-extrabold text-white hover:bg-zinc-800 transition-all shadow-md touch-manipulation"
                >
                  {t(primaryArticle.directAction.label, primaryArticle.directAction.labelSiEn)} →
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
