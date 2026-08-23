'use client';

import React from 'react';
import Link from 'next/link';
import { BreadcrumbItem } from '@/lib/navigation/dashboard-page-metadata';

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, className = '' }) => {
  if (!items || items.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className={`flex min-w-0 items-center gap-1.5 text-xs font-semibold text-zinc-500 overflow-x-auto no-scrollbar py-0.5 ${className}`}>
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <React.Fragment key={idx}>
            {idx > 0 && (
              <svg
                className="h-3.5 w-3.5 shrink-0 text-zinc-300 select-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="truncate hover:text-zinc-950 transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1 rounded-xs"
              >
                {item.label}
              </Link>
            ) : (
              <span className={`truncate ${isLast ? 'font-bold text-zinc-900' : ''}`} aria-current={isLast ? 'page' : undefined}>
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
