'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

export interface ActionMenuItem {
  label: string;
  onClick?: () => void;
  href?: string;
  isDestructive?: boolean;
  disabled?: boolean;
  icon?: string;
}

export interface ActionMenuProps {
  items: ActionMenuItem[];
  align?: 'left' | 'right';
  className?: string;
}

export const ActionMenu: React.FC<ActionMenuProps> = ({ items, align = 'right', className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const visibleItems = items.filter((item) => !item.disabled);
  if (visibleItems.length === 0) return null;

  return (
    <div className={`relative inline-block text-left ${className}`} ref={menuRef}>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="true"
        onClick={() => setIsOpen(!isOpen)}
        className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 font-black text-base transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
        aria-label="Actions menu"
      >
        ⋯
      </button>

      {isOpen && (
        <div
          role="menu"
          className={`absolute ${
            align === 'right' ? 'right-0' : 'left-0'
          } mt-1 w-48 rounded-xl bg-white border border-zinc-200 shadow-xl py-1 z-30 animate-in fade-in duration-100`}
        >
          {visibleItems.map((item, idx) => {
            const content = (
              <span className="flex items-center gap-2">
                {item.icon && <span>{item.icon}</span>}
                <span>{item.label}</span>
              </span>
            );

            const baseStyle = `w-full text-left px-3 py-2.5 min-h-[44px] flex items-center text-xs font-bold transition-colors touch-manipulation focus-visible:outline-none focus-visible:bg-zinc-100 ${
              item.isDestructive
                ? 'text-rose-600 hover:bg-rose-50'
                : 'text-zinc-800 hover:bg-zinc-100 hover:text-zinc-950'
            }`;

            if (item.href) {
              return (
                <Link
                  key={idx}
                  href={item.href}
                  role="menuitem"
                  onClick={() => setIsOpen(false)}
                  className={`block ${baseStyle}`}
                >
                  {content}
                </Link>
              );
            }

            return (
              <button
                key={idx}
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsOpen(false);
                  item.onClick?.();
                }}
                className={baseStyle}
              >
                {content}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
