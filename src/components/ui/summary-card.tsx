import React from 'react';
import Link from 'next/link';

export interface SummaryCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  status?: string;
  statusVariant?: 'success' | 'warning' | 'destructive' | 'neutral';
  href?: string;
  canAccess?: boolean;
  className?: string;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
  label,
  value,
  subtitle,
  icon,
  status,
  statusVariant = 'neutral',
  href,
  canAccess = true,
  className = '',
}) => {
  const content = (
    <div
      className={`rounded-2xl border border-zinc-200 bg-white p-5 space-y-2 shadow-2xs transition-all duration-150 ${
        href && canAccess ? 'hover:border-zinc-300 hover:shadow-md cursor-pointer group' : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{label}</span>
        {icon && <span className="text-lg opacity-80 group-hover:scale-110 transition-transform">{icon}</span>}
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <span className="text-2xl font-black tracking-tight text-zinc-950">{value}</span>
        {status && (
          <span
            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
              statusVariant === 'success'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : statusVariant === 'warning'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : statusVariant === 'destructive'
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-zinc-100 text-zinc-700 border-zinc-200'
            }`}
          >
            {status}
          </span>
        )}
      </div>

      {subtitle && <p className="text-xs text-zinc-500 font-medium truncate">{subtitle}</p>}
    </div>
  );

  if (href && canAccess) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
};
