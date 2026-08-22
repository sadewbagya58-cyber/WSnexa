'use client';

import React from 'react';
import { BreadcrumbItem } from '@/lib/navigation/dashboard-page-metadata';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';

export interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  primaryAction?: React.ReactNode;
  secondaryActions?: React.ReactNode;
  badge?: React.ReactNode;
  contextBadge?: React.ReactNode;
  helpSlug?: string;
  className?: string;
}

/**
 * Single Canonical Page Header Component for WSNexa Dashboard.
 * Ensures consistent title typography, responsive action bar wrapping,
 * breadcrumbs landmark, and clear context metadata across management pages.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  breadcrumbs,
  primaryAction,
  secondaryActions,
  badge,
  contextBadge,
  className = '',
}) => {
  return (
    <div className={`space-y-2 pb-6 border-b border-zinc-200/80 mb-6 ${className}`}>
      {/* Breadcrumbs landmark */}
      {breadcrumbs && breadcrumbs.length > 1 && (
        <Breadcrumbs items={breadcrumbs} />
      )}

      {/* Main Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 min-w-0">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight truncate min-w-0">
              {title}
            </h1>
            {badge}
            {contextBadge}
          </div>
          {description && (
            <p className="text-xs sm:text-sm text-zinc-600 font-medium leading-relaxed max-w-3xl">
              {description}
            </p>
          )}
        </div>

        {/* Action Slots */}
        {(primaryAction || secondaryActions) && (
          <div className="flex flex-wrap items-center gap-2.5 shrink-0 pt-1 sm:pt-0">
            {secondaryActions}
            {primaryAction}
          </div>
        )}
      </div>
    </div>
  );
};
