'use client';

import React from 'react';

interface QuantityStepperProps {
  quantity: number;
  min?: number;
  max?: number;
  onChange: (newQty: number) => void;
  disabled?: boolean;
}

export const QuantityStepper: React.FC<QuantityStepperProps> = ({
  quantity,
  min = 1,
  max = 99,
  onChange,
  disabled = false,
}) => {
  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (quantity > min) {
      onChange(quantity - 1);
    }
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (quantity < max) {
      onChange(quantity + 1);
    }
  };

  return (
    <div className="flex items-center rounded-xl border border-zinc-300 bg-white shadow-2xs">
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={disabled || quantity <= min}
        onClick={handleDecrement}
        className="flex h-11 w-11 items-center justify-center text-lg font-bold text-zinc-800 hover:bg-zinc-100 disabled:opacity-40 disabled:hover:bg-white touch-manipulation rounded-l-xl"
      >
        −
      </button>
      <span className="min-w-8 text-center font-mono text-sm font-black text-zinc-950 px-1">
        {quantity}
      </span>
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={disabled || quantity >= max}
        onClick={handleIncrement}
        className="flex h-11 w-11 items-center justify-center text-lg font-bold text-zinc-800 hover:bg-zinc-100 disabled:opacity-40 disabled:hover:bg-white touch-manipulation rounded-r-xl"
      >
        +
      </button>
    </div>
  );
};
