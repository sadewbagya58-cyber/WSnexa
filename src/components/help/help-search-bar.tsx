'use client';

import React, { useState, useTransition, useRef, useEffect } from 'react';
import Link from 'next/link';
import { HelpArticle } from '@/content/help/types';
import { searchHelpArticles } from '@/content/help/registry';
import { Badge } from '@/components/ui/badge';

interface HelpSearchBarProps {
  userRole?: string;
  userPermissions?: string[];
  placeholder?: string;
  autoFocus?: boolean;
}

export const HelpSearchBar: React.FC<HelpSearchBarProps> = ({
  userRole,
  userPermissions = [],
  placeholder = 'How can we help? (e.g. create QR, invite waiter, order not reaching kitchen...)',
  autoFocus = false,
}) => {
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
    'generate QR codes',
    'invite staff',
    'configure payments',
    'order not reaching kitchen',
    'publish venue',
  ];

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
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full min-h-[48px] rounded-2xl border border-zinc-200 bg-white pl-11 pr-10 text-xs sm:text-sm font-semibold text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-950 focus:outline-hidden focus:ring-2 focus:ring-zinc-950/10 shadow-xs transition-all"
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
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 px-1 text-[11px] text-zinc-500 font-medium">
          <span>Try:</span>
          {sampleSearches.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setQuery(s);
                startTransition(() => {
                  const searchRes = searchHelpArticles(s, userRole, userPermissions);
                  setResults(searchRes);
                  setIsOpen(true);
                });
              }}
              className="rounded-lg bg-zinc-100 px-2 py-0.5 text-zinc-700 hover:bg-zinc-200 transition-all cursor-pointer"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Live Results Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 max-h-[420px] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-2 shadow-xl">
          {isPending ? (
            <div className="p-4 text-center text-xs font-semibold text-zinc-400">
              Searching guides...
            </div>
          ) : results.length === 0 ? (
            <div className="p-6 text-center space-y-1">
              <div className="text-xl">🔍</div>
              <p className="text-xs font-bold text-zinc-900">No matching articles found</p>
              <p className="text-[11px] text-zinc-500">
                Try searching for broader keywords like &ldquo;menu&rdquo;, &ldquo;qr&rdquo;, &ldquo;waiter&rdquo;, or &ldquo;kitchen&rdquo;.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
                {results.length} Guide{results.length > 1 ? 's' : ''} Found
              </div>
              {results.slice(0, 8).map(({ article }) => (
                <Link
                  key={article.slug}
                  href={`/dashboard/help/${article.slug}`}
                  onClick={() => setIsOpen(false)}
                  className="flex items-start gap-3 rounded-xl p-3 text-left transition-all hover:bg-zinc-50 active:bg-zinc-100 group"
                >
                  <span className="text-lg mt-0.5 shrink-0">
                    {article.troubleshooting ? '🔧' : article.comingSoon ? '✨' : '📖'}
                  </span>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-zinc-950 group-hover:text-amber-600 transition-colors truncate">
                        {article.title}
                      </span>
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
                    <p className="text-[11px] font-medium text-zinc-500 line-clamp-1">
                      {article.description}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
