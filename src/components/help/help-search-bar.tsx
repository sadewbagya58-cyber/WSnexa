'use client';

import React, { useState, useTransition, useRef, useEffect } from 'react';
import Link from 'next/link';
import { HelpArticle } from '@/content/help/types';
import { searchHelpArticles } from '@/content/help/registry';
import { Badge } from '@/components/ui/badge';
import { useHelpLanguage } from './help-language-context';

interface HelpSearchBarProps {
  userRole?: string;
  userPermissions?: string[];
  placeholder?: string;
  autoFocus?: boolean;
}

export const HelpSearchBar: React.FC<HelpSearchBarProps> = ({
  userRole,
  userPermissions = [],
  placeholder,
  autoFocus = false,
}) => {
  const { language, t } = useHelpLanguage();
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const [results, setResults] = useState<{ article: HelpArticle; score: number }[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close search dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);

    if (!val.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    startTransition(() => {
      const searchRes = searchHelpArticles(val, userRole, userPermissions);
      setResults(searchRes);
      setIsOpen(true);
    });
  }

  const sampleSearches = [
    { en: 'Tables & Service Areas', query: 'tables' },
    { en: 'QR Codes', query: 'qr' },
    { en: 'Kitchen Queue', query: 'kitchen' },
    { en: 'Cashier & Payments', query: 'payment' },
    { en: 'Order Security', query: 'order security' },
    { en: 'Stock & Inventory', query: 'inventory' },
  ];

  const defaultPlaceholder = language === 'si-en'
    ? 'ඔබට උපකාර අවශ්‍ය කුමක් සඳහාද? (උදා. Tables, QR, Kitchen, Modifiers, Payments...)'
    : 'What do you need help with? (e.g. Tables, QR, Kitchen, Modifiers, Payments...)';

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl mx-auto">
      {/* Search Input Box */}
      <div className="relative flex items-center">
        <span className="absolute left-4 text-zinc-400 text-base select-none">
          🔍
        </span>
        <input
          type="text"
          value={query}
          onChange={handleSearchChange}
          onFocus={() => {
            if (query.trim() && results.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder || defaultPlaceholder}
          autoFocus={autoFocus}
          className="w-full min-h-[50px] rounded-2xl border border-zinc-200 bg-white pl-11 pr-10 text-xs sm:text-sm font-semibold text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-950 focus:outline-hidden focus:ring-2 focus:ring-zinc-950/10 shadow-xs transition-all"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setResults([]);
              setIsOpen(false);
            }}
            className="absolute right-3.5 text-xs font-bold text-zinc-400 hover:text-zinc-600 p-1 cursor-pointer"
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {/* Suggested Quick Searches */}
      {!query && (
        <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5 px-1 text-[11px] text-zinc-500 font-medium">
          <span className="text-zinc-400 select-none text-[10px] uppercase font-bold tracking-wider">
            Popular Topics:
          </span>
          {sampleSearches.map((s) => (
            <button
              key={s.query}
              type="button"
              onClick={() => {
                setQuery(s.query);
                const searchRes = searchHelpArticles(s.query, userRole, userPermissions);
                setResults(searchRes);
                setIsOpen(true);
              }}
              className="rounded-lg bg-zinc-100 px-2.5 py-1 text-[11px] font-bold text-zinc-700 hover:bg-zinc-200 transition-colors touch-manipulation cursor-pointer"
            >
              {s.en}
            </button>
          ))}
        </div>
      )}

      {/* Search Results Dropdown Overlay */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-2 max-h-[420px] overflow-y-auto rounded-2xl border border-zinc-200 bg-white shadow-xl p-2 space-y-1 animate-in fade-in-50 zoom-in-95 duration-100 text-left">
          {results.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-500 space-y-1">
              <span className="text-xl select-none">🔎</span>
              <p className="font-bold text-zinc-700">No matching guides found</p>
              <p className="text-[11px] text-zinc-400">
                Try searching for simple keywords like "table", "menu", "PIN", or "kitchen".
              </p>
            </div>
          ) : (
            <>
              <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-zinc-400 border-b border-zinc-100 flex items-center justify-between">
                <span>{results.length} Guides Found</span>
                {isPending && <span className="animate-spin text-zinc-400">⚙️</span>}
              </div>

              {results.map(({ article }) => (
                <Link
                  key={article.slug}
                  href={`/dashboard/help/${article.slug}`}
                  onClick={() => setIsOpen(false)}
                  className="flex items-start gap-3 p-3 rounded-xl hover:bg-zinc-50 transition-colors cursor-pointer group"
                >
                  <span className="text-base shrink-0 pt-0.5 select-none">
                    {article.troubleshooting ? '🔧' : '📖'}
                  </span>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="text-xs font-bold text-zinc-950 group-hover:text-amber-600 transition-colors truncate">
                        {t(article.title, article.titleSiEn)}
                      </h4>
                      {article.troubleshooting && (
                        <Badge variant="warning" className="text-[9px] px-1 py-0 shrink-0">
                          Fix
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-500 line-clamp-1">
                      {t(article.description, article.descriptionSiEn)}
                    </p>
                  </div>
                </Link>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};
