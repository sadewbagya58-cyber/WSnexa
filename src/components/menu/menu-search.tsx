'use client';

import React from 'react';

interface MenuSearchProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

export const MenuSearch = React.memo(function MenuSearch({
  value,
  onChange,
  placeholder = 'Search menu items or categories...',
}: MenuSearchProps) {
  return (
    <div className="relative w-full">
      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400 text-sm">
        🔍
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-zinc-200 bg-white pl-10 pr-9 py-2.5 text-xs sm:text-sm font-semibold text-zinc-950 placeholder-zinc-400 shadow-2xs focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 focus:outline-none transition-all min-h-[44px]"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-zinc-400 hover:text-zinc-700 font-bold min-h-[44px] min-w-[44px] justify-center cursor-pointer"
          aria-label="Clear search"
        >
          ✕
        </button>
      )}
    </div>
  );
});
