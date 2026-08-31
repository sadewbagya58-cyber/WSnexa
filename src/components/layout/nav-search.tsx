'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardNavSectionDTO } from '@/lib/navigation/dashboard-navigation';

export interface SearchableItem {
  id: string;
  label: string;
  href: string;
  icon?: string;
  groupTitle: string;
  aliases?: string[];
}

interface NavSearchTriggerProps {
  onClick: () => void;
  className?: string;
  isMobile?: boolean;
}

/**
 * Lightweight search trigger button rendered inside Desktop Sidebar or Mobile Drawer.
 * Does NOT register any global window listeners.
 */
export const NavSearchTrigger: React.FC<NavSearchTriggerProps> = ({
  onClick,
  className = '',
  isMobile = false,
}) => {
  return (
    <div className={className}>
      <button
        type="button"
        onClick={onClick}
        aria-label="Search dashboard pages"
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs rounded-xl border border-zinc-200 bg-zinc-50/80 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors touch-manipulation ${
          isMobile ? 'min-h-[44px]' : 'min-h-[38px]'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 truncate">
          <svg className="w-4 h-4 shrink-0 text-zinc-400 select-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="truncate font-medium">Find a page...</span>
        </div>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-bold text-zinc-400 bg-white border border-zinc-200 rounded-md shadow-2xs select-none">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>
    </div>
  );
};

interface NavSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen?: () => void;
  navSections: DashboardNavSectionDTO[];
  onSelectDestination?: () => void;
}

/**
 * Singleton Navigation Search Modal mounted once at the DashboardShell root level.
 * Registers exactly ONE global Cmd+K / Ctrl+K keyboard shortcut listener.
 */
export const NavSearchModal: React.FC<NavSearchModalProps> = ({
  isOpen,
  onClose,
  onOpen,
  navSections,
  onSelectDestination,
}) => {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Flatten all authorized leaf items from navSections (strictly RBAC-filtered)
  const searchableItems = useMemo<SearchableItem[]>(() => {
    const items: SearchableItem[] = [];
    const seenHrefs = new Set<string>();

    for (const section of navSections) {
      for (const group of section.items) {
        if (group.children && group.children.length > 0) {
          for (const child of group.children) {
            if (!seenHrefs.has(child.href)) {
              seenHrefs.add(child.href);
              items.push({
                id: child.id,
                label: child.label,
                href: child.href,
                icon: child.icon || group.icon || '📄',
                groupTitle: group.label,
                aliases: child.aliases,
              });
            }
          }
        } else {
          if (!seenHrefs.has(group.href)) {
            seenHrefs.add(group.href);
            items.push({
              id: group.id,
              label: group.label,
              href: group.href,
              icon: group.icon || '📄',
              groupTitle: section.title,
              aliases: group.aliases,
            });
          }
        }
      }
    }
    return items;
  }, [navSections]);

  // Filter items matching query
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return searchableItems;

    return searchableItems.filter((item) => {
      if (item.label.toLowerCase().includes(q)) return true;
      if (item.groupTitle.toLowerCase().includes(q)) return true;
      if (item.href.toLowerCase().includes(q)) return true;
      if (item.aliases && item.aliases.some((a) => a.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [searchableItems, query]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Single global keyboard shortcut listener (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else if (onOpen) {
          onOpen();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onOpen]);

  // Focus input on modal open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const handleSelect = (item: SearchableItem) => {
    onClose();
    onSelectDestination?.();
    router.push(item.href);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        handleSelect(filteredItems[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.querySelector('[data-selected="true"]');
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-20 px-3">
      {/* Backdrop (solid flat dark, no backdrop-blur for 60fps performance) */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Close page search"
        className="fixed inset-0 bg-black/60 transition-opacity"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') onClose();
        }}
      />

      {/* Modal Card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Page search modal"
        className="relative z-50 w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[80vh]"
      >
        {/* Input Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-zinc-200 bg-zinc-50/50">
          <svg className="w-5 h-5 text-zinc-400 shrink-0 select-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a page name (Tables, Kitchen, Recipes, Staff)..."
            className="w-full bg-transparent text-sm font-semibold text-zinc-950 placeholder-zinc-400 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search query"
              className="text-xs text-zinc-400 hover:text-zinc-700 p-1"
            >
              ✕
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-zinc-400 hover:text-zinc-700 px-2 py-1 bg-zinc-100 rounded-lg"
          >
            ESC
          </button>
        </div>

        {/* Results List */}
        <div ref={listRef} className="overflow-y-auto p-2 space-y-1 max-h-[50vh]">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500">
              <p className="font-bold text-zinc-700">No authorized pages found</p>
              <p className="mt-1 text-zinc-400">Try searching for a different keyword</p>
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.href}
                  type="button"
                  data-selected={isSelected}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex min-h-[44px] items-center justify-between px-3 py-2 rounded-xl text-left transition-colors touch-manipulation ${
                    isSelected
                      ? 'bg-zinc-950 text-white shadow-xs'
                      : 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-base select-none shrink-0">{item.icon}</span>
                    <div className="min-w-0 truncate">
                      <p className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-zinc-950'}`}>
                        {item.label}
                      </p>
                      <p className={`text-[11px] truncate ${isSelected ? 'text-zinc-300' : 'text-zinc-400'}`}>
                        {item.groupTitle} • <span className="font-mono">{item.href}</span>
                      </p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold shrink-0 ml-2 px-2 py-0.5 rounded-md ${
                    isSelected ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-100 text-zinc-500'
                  }`}>
                    {item.groupTitle}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Modal Footer Hints */}
        <div className="px-4 py-2.5 bg-zinc-50 border-t border-zinc-100 text-[11px] text-zinc-400 flex items-center justify-between select-none">
          <div className="flex items-center gap-3">
            <span><kbd className="font-mono font-bold bg-white px-1 py-0.5 border border-zinc-200 rounded text-[10px]">↑↓</kbd> Navigate</span>
            <span><kbd className="font-mono font-bold bg-white px-1 py-0.5 border border-zinc-200 rounded text-[10px]">↵</kbd> Open</span>
            <span><kbd className="font-mono font-bold bg-white px-1 py-0.5 border border-zinc-200 rounded text-[10px]">ESC</kbd> Close</span>
          </div>
          <span className="font-medium">{filteredItems.length} {filteredItems.length === 1 ? 'destination' : 'destinations'}</span>
        </div>
      </div>
    </div>
  );
};

interface NavSearchProps {
  navSections: DashboardNavSectionDTO[];
  onSelectDestination?: () => void;
  className?: string;
  isMobile?: boolean;
}

/**
 * Self-contained NavSearch component with internal state.
 */
export const NavSearch: React.FC<NavSearchProps> = ({
  navSections,
  onSelectDestination,
  className = '',
  isMobile = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <NavSearchTrigger
        onClick={() => setIsOpen(true)}
        className={className}
        isMobile={isMobile}
      />
      <NavSearchModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onOpen={() => setIsOpen(true)}
        navSections={navSections}
        onSelectDestination={onSelectDestination}
      />
    </>
  );
};