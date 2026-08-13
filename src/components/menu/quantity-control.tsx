'use client';

import React from 'react';

interface QuantityControlProps {
  quantity: number;
  onIncrease: () => void;
  onDecrease: () => void;
  disabled?: boolean;
  minQuantity?: number;
  size?: 'sm' | 'md' | 'lg';
}

export function QuantityControl({
  quantity,
  onIncrease,
  onDecrease,
  disabled = false,
  minQuantity = 1,
  size = 'md',
}: QuantityControlProps) {
  const buttonSizes = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-11 h-11 text-base',
  };

  const containerPadding = {
    sm: 'p-0.5 gap-1.5',
    md: 'p-1 gap-2',
    lg: 'p-1.5 gap-3',
  };

  return (
    <div
      className={`inline-flex items-center rounded-2xl bg-zinc-100 border border-zinc-200/80 ${containerPadding[size]} select-none`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled && quantity > minQuantity) onDecrease();
        }}
        disabled={disabled || quantity <= minQuantity}
        className={`${buttonSizes[size]} rounded-xl bg-white text-zinc-950 font-black shadow-2xs border border-zinc-200 hover:bg-zinc-50 active:scale-95 transition-all flex items-center justify-center disabled:opacity-40 disabled:pointer-events-none cursor-pointer touch-manipulation min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0`}
        aria-label="Decrease quantity"
      >
        −
      </button>

      <span className="font-mono font-black text-xs sm:text-sm text-zinc-950 px-2 min-w-[20px] text-center">
        {quantity}
      </span>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) onIncrease();
        }}
        disabled={disabled}
        className={`${buttonSizes[size]} rounded-xl bg-zinc-950 text-white font-black shadow-2xs hover:bg-zinc-800 active:scale-95 transition-all flex items-center justify-center disabled:opacity-40 disabled:pointer-events-none cursor-pointer touch-manipulation min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0`}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}
