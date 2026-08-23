import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: string;
  primaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
    canPerform?: boolean;
  };
  secondaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  helpSlug?: string;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon = '📋',
  primaryAction,
  secondaryAction,
  helpSlug,
  className = '',
}) => {
  const canPerformPrimary = primaryAction?.canPerform ?? true;

  return (
    <div
      className={`rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center space-y-4 shadow-2xs ${className}`}
    >
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-2xl shadow-2xs">
        {icon}
      </div>

      <div className="space-y-1 max-w-md mx-auto">
        <h3 className="text-base font-extrabold text-zinc-950 tracking-tight">{title}</h3>
        <p className="text-xs text-zinc-500 leading-relaxed">{description}</p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        {primaryAction && canPerformPrimary && (
          primaryAction.href ? (
            <Link href={primaryAction.href}>
              <Button size="sm" className="text-xs font-bold bg-zinc-950 text-white hover:bg-zinc-800">
                {primaryAction.label}
              </Button>
            </Link>
          ) : (
            <Button
              size="sm"
              onClick={primaryAction.onClick}
              className="text-xs font-bold bg-zinc-950 text-white hover:bg-zinc-800"
            >
              {primaryAction.label}
            </Button>
          )
        )}

        {secondaryAction && (
          secondaryAction.href ? (
            <Link href={secondaryAction.href}>
              <Button size="sm" variant="outline" className="text-xs font-bold">
                {secondaryAction.label}
              </Button>
            </Link>
          ) : (
            <Button size="sm" variant="outline" onClick={secondaryAction.onClick} className="text-xs font-bold">
              {secondaryAction.label}
            </Button>
          )
        )}

        {helpSlug && (
          <Link href={`/dashboard/help/${helpSlug}`}>
            <Button size="sm" variant="secondary" className="text-xs font-semibold text-zinc-600 hover:text-zinc-900">
              📖 Learn More
            </Button>
          </Link>
        )}
      </div>

      {primaryAction && !canPerformPrimary && (
        <p className="text-[11px] text-zinc-400 italic font-medium pt-1">
          🔒 You do not have permission to create items in this section.
        </p>
      )}
    </div>
  );
};
