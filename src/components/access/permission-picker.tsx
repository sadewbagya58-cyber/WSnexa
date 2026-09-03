'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { FormattedPermission } from '@/types/authorization.types';
import {
  PERMISSION_CATEGORIES,
  groupPermissionsByCategory,
} from '@/lib/permissions/permission-categories';

interface PermissionPickerProps {
  catalog: FormattedPermission[];
  value: string;
  onChange: (permissionKey: string) => void;
  label?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
}

export const PermissionPicker: React.FC<PermissionPickerProps> = ({
  catalog,
  value,
  onChange,
  label = 'Permission / Capability',
  disabled = false,
  placeholder = 'Select a capability...',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Group the catalog by canonical categories
  const groupedCatalog = useMemo(() => {
    return groupPermissionsByCategory(catalog);
  }, [catalog]);

  // Find currently selected permission
  const selectedPermission = useMemo(() => {
    return catalog.find((p) => p.key === value) || null;
  }, [catalog, value]);

  // Filter groups based on search query (matches key, name, or description)
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) {
      return groupedCatalog;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered: Record<string, FormattedPermission[]> = {};

    for (const [category, permissions] of Object.entries(groupedCatalog)) {
      const matching = permissions.filter((p) => {
        const keyMatch = p.key.toLowerCase().includes(query);
        const nameMatch = (p.name || '').toLowerCase().includes(query);
        const descMatch = (p.description || '').toLowerCase().includes(query);
        return keyMatch || nameMatch || descMatch;
      });

      if (matching.length > 0) {
        filtered[category] = matching;
      }
    }

    return filtered;
  }, [groupedCatalog, searchQuery]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const toggleCategory = (category: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const handleSelect = (key: string) => {
    onChange(key);
    setIsOpen(false);
  };

  const totalFilteredCount = useMemo(() => {
    return Object.values(filteredGroups).reduce((acc, list) => acc + list.length, 0);
  }, [filteredGroups]);

  return (
    <div className={`space-y-1 relative ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block text-xs font-bold text-zinc-700">
          {label}
        </label>
      )}

      {/* Main Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full text-left min-h-[44px] px-3.5 py-2.5 bg-white border rounded-xl text-xs flex items-center justify-between gap-2 shadow-2xs transition-all touch-manipulation ${
          isOpen
            ? 'border-emerald-600 ring-2 ring-emerald-500/20'
            : 'border-zinc-300 hover:border-zinc-400'
        } ${disabled ? 'opacity-60 cursor-not-allowed bg-zinc-50' : 'cursor-pointer'}`}
      >
        <div className="min-w-0 flex-1">
          {selectedPermission ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-zinc-950 truncate break-words">
                {selectedPermission.name || selectedPermission.key}
              </span>
              <span className="font-mono text-[10px] bg-zinc-100 text-zinc-700 px-1.5 py-0.5 rounded border border-zinc-200">
                {selectedPermission.key}
              </span>
            </div>
          ) : (
            <span className="text-zinc-400 italic">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-zinc-400 shrink-0">
          <span className="text-[10px] font-semibold text-zinc-500 hidden sm:inline">
            {Object.keys(groupedCatalog).length} Categories
          </span>
          <span className="text-xs transition-transform duration-200" style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}>
            ▼
          </span>
        </div>
      </button>

      {/* Popover / Grouped Dropdown Panel */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[420px]">
          {/* Search Header */}
          <div className="p-3 bg-zinc-50 border-b border-zinc-200 space-y-2">
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by key, name, or description (e.g. kitchen.update, orders)..."
                className="w-full pl-8 pr-8 py-2 text-xs bg-white border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 min-h-[40px]"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400">
                🔍
              </span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-zinc-700 px-1"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-zinc-500 px-1">
              <span>
                Showing <strong>{totalFilteredCount}</strong> of {catalog.length} capabilities
              </span>
              {searchQuery && (
                <span className="text-emerald-700 font-bold">
                  Filtered by &quot;{searchQuery}&quot;
                </span>
              )}
            </div>
          </div>

          {/* Categorized Permissions List */}
          <div className="overflow-y-auto divide-y divide-zinc-100 p-2 space-y-2 flex-1">
            {Object.keys(filteredGroups).length === 0 ? (
              <div className="p-8 text-center space-y-1">
                <div className="text-2xl">🔍</div>
                <div className="text-xs font-bold text-zinc-800">No permissions found</div>
                <div className="text-[11px] text-zinc-500">
                  No capabilities matched &quot;{searchQuery}&quot;. Try searching for &quot;orders&quot;, &quot;kitchen&quot;, or &quot;staff&quot;.
                </div>
              </div>
            ) : (
              Object.entries(filteredGroups).map(([category, items]) => {
                const catMeta = PERMISSION_CATEGORIES.find((c) => c.name === category);
                const isCollapsed = Boolean(collapsedCategories[category]) && !searchQuery.trim();

                return (
                  <div key={category} className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 overflow-hidden">
                    {/* Category Header */}
                    <button
                      type="button"
                      onClick={(e) => toggleCategory(category, e)}
                      className="w-full px-3 py-2 bg-zinc-100/70 hover:bg-zinc-100 flex items-center justify-between text-xs font-bold text-zinc-900 border-b border-zinc-200/60 touch-manipulation min-h-[38px]"
                    >
                      <div className="flex items-center gap-2">
                        <span>{catMeta?.icon || '📁'}</span>
                        <span>{category}</span>
                        <span className="text-[10px] font-semibold text-zinc-500 bg-white px-1.5 py-0.2 rounded-full border border-zinc-200">
                          {items.length}
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {isCollapsed ? '+ Expand' : '− Collapse'}
                      </span>
                    </button>

                    {/* Permissions in Category */}
                    {!isCollapsed && (
                      <div className="p-1 space-y-1 bg-white">
                        {items.map((perm) => {
                          const isSelected = perm.key === value;

                          return (
                            <button
                              key={perm.key}
                              type="button"
                              onClick={() => handleSelect(perm.key)}
                              className={`w-full text-left p-2.5 rounded-lg text-xs transition-all flex items-start justify-between gap-3 min-h-[44px] touch-manipulation ${
                                isSelected
                                  ? 'bg-emerald-50 border border-emerald-300 text-emerald-950 font-bold'
                                  : 'hover:bg-zinc-50 text-zinc-800 border border-transparent'
                              }`}
                            >
                              <div className="min-w-0 flex-1 space-y-0.5">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-bold text-zinc-900 break-words">
                                    {perm.name || perm.key}
                                  </span>
                                  <span className="font-mono text-[10px] bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded border border-zinc-200/80">
                                    {perm.key}
                                  </span>
                                </div>
                                {perm.description && (
                                  <p className="text-[11px] text-zinc-500 font-normal leading-snug break-words">
                                    {perm.description}
                                  </p>
                                )}
                              </div>

                              {isSelected && (
                                <span className="text-emerald-700 text-sm font-black shrink-0">
                                  ✓
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
