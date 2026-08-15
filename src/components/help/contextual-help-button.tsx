'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getArticlesForRoute, getArticleBySlug } from '@/content/help/registry';
import { HelpArticle } from '@/content/help/types';
import { Button } from '@/components/ui/button';

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
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-end p-0 sm:p-4">
          <div
            className="w-full sm:max-w-md h-full sm:h-auto sm:max-h-[90vh] bg-white sm:rounded-3xl border border-zinc-200 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
              <div className="flex items-center gap-2">
                <span className="text-lg">📖</span>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">
                    Page Guide
                  </h3>
                  <h4 className="text-sm font-extrabold text-zinc-950 truncate max-w-[280px]">
                    {primaryArticle.title}
                  </h4>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-xs font-bold text-zinc-400 hover:text-zinc-700 p-1.5 rounded-lg hover:bg-zinc-200 transition-all cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs">
              <p className="text-zinc-600 font-medium leading-relaxed">
                {primaryArticle.description}
              </p>

              {/* Quick Steps */}
              <div className="space-y-3">
                <h5 className="font-black text-zinc-950 uppercase tracking-wider text-[10px]">
                  Step-by-Step Instructions
                </h5>
                <div className="space-y-2.5">
                  {primaryArticle.steps.map((step) => (
                    <div key={step.number} className="p-3 rounded-2xl bg-zinc-50 border border-zinc-100 space-y-1">
                      <div className="font-extrabold text-zinc-900 flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-zinc-950 text-white text-[9px] flex items-center justify-center font-black">
                          {step.number}
                        </span>
                        <span>{step.title}</span>
                      </div>
                      <p className="text-zinc-500 font-medium pl-6 text-[11px] leading-relaxed">
                        {step.instruction}
                      </p>
                      {step.tip && (
                        <p className="text-amber-800 bg-amber-50/80 p-2 rounded-xl text-[10px] font-semibold mt-1 border border-amber-200/50">
                          💡 Tip: {step.tip}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Other Related Guides for this Route */}
              {matchingArticles.length > 1 && (
                <div className="space-y-2 pt-2 border-t border-zinc-100">
                  <h5 className="font-black text-zinc-950 uppercase tracking-wider text-[10px]">
                    More Guides for this Section
                  </h5>
                  <div className="space-y-1">
                    {matchingArticles.slice(1).map((art) => (
                      <Link
                        key={art.slug}
                        href={`/dashboard/help/${art.slug}`}
                        onClick={() => setIsOpen(false)}
                        className="block p-2 rounded-xl hover:bg-zinc-100 text-zinc-800 font-bold hover:text-zinc-950 transition-colors"
                      >
                        → {art.title}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-zinc-100 bg-zinc-50 flex items-center justify-between gap-3">
              <Link
                href={`/dashboard/help/${primaryArticle.slug}`}
                onClick={() => setIsOpen(false)}
                className="text-[11px] font-bold text-zinc-700 hover:text-zinc-950 underline"
              >
                Open Full Article ↗
              </Link>
              <Link
                href="/dashboard/help"
                onClick={() => setIsOpen(false)}
                className="rounded-xl bg-zinc-950 px-3 py-1.5 text-xs font-bold text-white hover:bg-zinc-800 transition-all"
              >
                Help Center Home →
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
