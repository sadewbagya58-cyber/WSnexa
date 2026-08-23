import React from 'react';
import Link from 'next/link';

export interface EntityLinkProps {
  href: string;
  label: string;
  sublabel?: string;
  icon?: string;
  canAccess?: boolean;
  className?: string;
}

export const EntityLink: React.FC<EntityLinkProps> = ({
  href,
  label,
  sublabel,
  icon,
  canAccess = true,
  className = '',
}) => {
  // Guard against raw UUID displays in primary label
  const isRawUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(label.trim());
  const displayLabel = isRawUuid ? 'View Record' : label;

  if (!canAccess || !href) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-zinc-600 font-medium text-xs ${className}`}>
        {icon && <span className="opacity-70">{icon}</span>}
        <span>{displayLabel}</span>
        {sublabel && <span className="text-[11px] text-zinc-400 font-normal">({sublabel})</span>}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-900 hover:text-zinc-950 hover:underline decoration-zinc-400 underline-offset-2 transition-colors ${className}`}
    >
      {icon && <span>{icon}</span>}
      <span>{displayLabel}</span>
      {sublabel && <span className="text-[11px] text-zinc-500 font-normal">({sublabel})</span>}
      <span className="text-[10px] text-zinc-400">→</span>
    </Link>
  );
};
