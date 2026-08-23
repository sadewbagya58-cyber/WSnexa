import React from 'react';

interface ReadOnlyNoticeProps {
  message?: string;
  className?: string;
  variant?: 'banner' | 'inline' | 'compact';
}

export const ReadOnlyNotice: React.FC<ReadOnlyNoticeProps> = ({
  message = "You can view this information, but you don't have permission to make changes.",
  className = '',
  variant = 'banner',
}) => {
  if (variant === 'compact') {
    return (
      <span className={`inline-flex items-center gap-1 text-[11px] font-bold text-zinc-500 bg-zinc-100 px-2.5 py-0.5 rounded-full border border-zinc-200 ${className}`}>
        <span>🔒</span>
        <span>View Only Mode</span>
      </span>
    );
  }

  if (variant === 'inline') {
    return (
      <div className={`text-[11px] text-zinc-400 font-bold text-center italic py-1 border border-dashed border-zinc-200 rounded-lg ${className}`}>
        🔒 Read-Only View Mode
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-amber-200 bg-amber-50/80 p-3 flex items-center gap-2.5 text-xs text-amber-950 font-medium shadow-2xs ${className}`}>
      <span className="text-base shrink-0">🔒</span>
      <div className="flex-1">
        <span className="font-bold">View Only Mode: </span>
        <span>{message}</span>
      </div>
    </div>
  );
};
