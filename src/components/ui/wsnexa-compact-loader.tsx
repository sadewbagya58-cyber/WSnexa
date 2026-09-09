'use client';

import React from 'react';

export interface WsnexaCompactLoaderProps {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
  className?: string;
}

export function WsnexaCompactLoader({
  label = 'Loading WSNexa...',
  size = 'md',
  fullScreen = false,
  className = '',
}: WsnexaCompactLoaderProps) {
  // Dimensions keep the footprint strictly in the ~100px - 150px range
  const ringSizeClass = size === 'sm' ? 'w-10 h-10' : size === 'lg' ? 'w-16 h-16' : 'w-12 h-12';
  const logoSizeClass = size === 'sm' ? 'w-6 h-6 text-[10px]' : size === 'lg' ? 'w-10 h-10 text-sm' : 'w-8 h-8 text-xs';

  const containerClasses = fullScreen
    ? 'fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/80 backdrop-blur-xs'
    : 'flex flex-col items-center justify-center p-4 min-h-[120px]';

  return (
    <div
      role="status"
      aria-label={label}
      className={`${containerClasses} ${className}`}
    >
      <div className="relative flex items-center justify-center">
        {/* Subtle decorative pulse glow ring behind */}
        <div
          className={`absolute rounded-full bg-zinc-900/5 blur-[2px] animate-pulse ${ringSizeClass}`}
        />

        {/* Thin circular spinner ring */}
        <div
          className={`rounded-full border-2 border-zinc-200 border-t-zinc-950 animate-spin ${ringSizeClass}`}
          style={{ animationDuration: '0.85s' }}
        />

        {/* Stylized WSNexa Monogram in center with subtle pulse */}
        <div
          className={`absolute flex items-center justify-center rounded-xl bg-zinc-950 text-white font-black tracking-tight shadow-xs animate-pulse select-none ${logoSizeClass}`}
        >
          <span>WN</span>
        </div>
      </div>

      {/* Crisp typography below */}
      {label && (
        <span className="mt-3 text-xs font-semibold text-zinc-600 tracking-tight select-none">
          {label}
        </span>
      )}
    </div>
  );
}
