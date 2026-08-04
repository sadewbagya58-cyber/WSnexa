import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

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
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  breadcrumbs,
  primaryAction,
  secondaryAction,
  backHref,
}) => {
  return (
    <div className="space-y-3 pb-2 border-b border-zinc-200">
      {/* Breadcrumbs & Back */}
      {(breadcrumbs || backHref) && (
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          {backHref && (
            <Link
              href={backHref}
              className="flex items-center gap-1 font-medium text-zinc-600 hover:text-zinc-950 transition-colors"
            >
              ← Back
            </Link>
          )}

          {backHref && breadcrumbs && breadcrumbs.length > 0 && <span>/</span>}

          {breadcrumbs && (
            <nav className="flex items-center gap-1.5 overflow-x-auto py-0.5">
              <Link href="/dashboard" className="hover:text-zinc-950 transition-colors">
                Dashboard
              </Link>
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={idx}>
                  <span>/</span>
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
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">{title}</h1>
          {description && <p className="mt-1 text-xs text-zinc-500">{description}</p>}
        </div>

        {/* Action Buttons */}
        {(primaryAction || secondaryAction) && (
          <div className="flex flex-wrap items-center gap-2 pt-1 sm:pt-0">
            {secondaryAction &&
              (secondaryAction.href ? (
                <Link href={secondaryAction.href}>
                  <Button variant="outline" size="sm">
                    {secondaryAction.icon}
                    {secondaryAction.label}
                  </Button>
                </Link>
              ) : (
                <Button variant="outline" size="sm" onClick={secondaryAction.onClick}>
                  {secondaryAction.icon}
                  {secondaryAction.label}
                </Button>
              ))}

            {primaryAction &&
              (primaryAction.href ? (
                <Link href={primaryAction.href}>
                  <Button size="sm">
                    {primaryAction.icon}
                    {primaryAction.label}
                  </Button>
                </Link>
              ) : (
                <Button size="sm" onClick={primaryAction.onClick}>
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
