import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ContextualHelpButton } from '@/components/help/contextual-help-button';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  primaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
    icon?: React.ReactNode;
  };
  secondaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
    icon?: React.ReactNode;
  };
  backHref?: string;
  helpSlug?: string;
  showHelp?: boolean;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  breadcrumbs,
  primaryAction,
  secondaryAction,
  backHref,
  helpSlug,
  showHelp,
}) => {
  return (
    <div className="space-y-3 pb-2 border-b border-zinc-200">
      {/* Breadcrumbs & Back */}
      {(breadcrumbs || backHref) && (
        <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-zinc-500 overflow-x-auto whitespace-nowrap py-0.5 no-scrollbar">
          {backHref && (
            <Link
              href={backHref}
              className="flex items-center gap-1 font-medium text-zinc-600 hover:text-zinc-950 transition-colors shrink-0"
            >
              ← Back
            </Link>
          )}

          {backHref && breadcrumbs && breadcrumbs.length > 0 && <span className="text-zinc-300">/</span>}

          {breadcrumbs && (
            <nav className="flex items-center gap-1.5 shrink-0">
              {/* Only show default Dashboard root if the first crumb is not already Dashboard */}
              {breadcrumbs[0]?.label?.toLowerCase() !== 'dashboard' && (
                <>
                  <Link href="/dashboard" className="hover:text-zinc-950 transition-colors">
                    Dashboard
                  </Link>
                  <span className="text-zinc-300">/</span>
                </>
              )}
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && <span className="text-zinc-300">/</span>}
                  {crumb.href ? (
                    <Link href={crumb.href} className="hover:text-zinc-950 transition-colors">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="font-semibold text-zinc-900">{crumb.label}</span>
                  )}
                </React.Fragment>
              ))}
            </nav>
          )}
        </div>
      )}

      {/* Main Header Content */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-950">{title}</h1>
          {description && <p className="mt-0.5 text-xs text-zinc-500 leading-relaxed">{description}</p>}
        </div>

        {/* Action Buttons & Contextual Help */}
        {(primaryAction || secondaryAction || helpSlug || showHelp) && (
          <div className="flex flex-wrap items-center gap-2 pt-1 sm:pt-0">
            {(helpSlug || showHelp) && (
              <ContextualHelpButton explicitSlug={helpSlug} />
            )}

            {secondaryAction &&
              (secondaryAction.href ? (
                <Link href={secondaryAction.href} className="inline-block">
                  <Button variant="outline" size="sm" className="min-h-[38px] text-xs font-semibold">
                    {secondaryAction.icon}
                    {secondaryAction.label}
                  </Button>
                </Link>
              ) : (
                <Button variant="outline" size="sm" onClick={secondaryAction.onClick} className="min-h-[38px] text-xs font-semibold">
                  {secondaryAction.icon}
                  {secondaryAction.label}
                </Button>
              ))}

            {primaryAction &&
              (primaryAction.href ? (
                <Link href={primaryAction.href} className="inline-block">
                  <Button size="sm" className="min-h-[38px] text-xs font-semibold">
                    {primaryAction.icon}
                    {primaryAction.label}
                  </Button>
                </Link>
              ) : (
                <Button size="sm" onClick={primaryAction.onClick} className="min-h-[38px] text-xs font-semibold">
                  {primaryAction.icon}
                  {primaryAction.label}
                </Button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};
