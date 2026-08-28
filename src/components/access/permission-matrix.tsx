'use client';

import React, { useState, useMemo } from 'react';
import { FormattedPermission } from '@/types/authorization.types';
import { IconShieldAlert, IconCircleCheck, IconCircleX } from './access-icons';

interface PermissionMatrixProps {
  catalog: FormattedPermission[];
  selectedPermissions: string[];
  onChange: (newSelected: string[]) => void;
  disabled?: boolean;
  userRole?: string;
  isOwner?: boolean;
}

export const PermissionMatrix: React.FC<PermissionMatrixProps> = ({
  catalog,
  selectedPermissions,
  onChange,
  disabled = false,
  isOwner = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedDomains, setCollapsedDomains] = useState<Record<string, boolean>>({});
  const [showTechnicalKeys, setShowTechnicalKeys] = useState(false);

  // Group catalog permissions by category/domain
  const groupedCatalog = useMemo(() => {
    const groups: Record<string, FormattedPermission[]> = {};
    for (const p of catalog) {
      const cat = p.category || 'General';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    }
    return groups;
  }, [catalog]);

  // Filter catalog based on search
  const filteredGroups = useMemo(() => {
    if (!searchTerm.trim()) return groupedCatalog;
    const term = searchTerm.toLowerCase();

    const result: Record<string, FormattedPermission[]> = {};
    for (const [cat, items] of Object.entries(groupedCatalog)) {
      const filtered = items.filter(
        (p) =>
          p.key.toLowerCase().includes(term) ||
          p.name.toLowerCase().includes(term) ||
          (p.description && p.description.toLowerCase().includes(term))
      );
      if (filtered.length > 0) {
        result[cat] = filtered;
      }
    }
    return result;
  }, [groupedCatalog, searchTerm]);

  const selectedSet = useMemo(() => new Set(selectedPermissions), [selectedPermissions]);

  const togglePermission = (key: string) => {
    if (disabled) return;
    const next = new Set(selectedSet);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onChange(Array.from(next));
  };

  const toggleDomain = (domainItems: FormattedPermission[]) => {
    if (disabled) return;
    const next = new Set(selectedSet);
    const allSelectedInDomain = domainItems.every((item) => next.has(item.key));

    if (allSelectedInDomain) {
      domainItems.forEach((item) => next.delete(item.key));
    } else {
      domainItems.forEach((item) => {
        // Prevent assigning super_admin permissions to tenant custom roles
        if (!item.key.startsWith('super_admin.')) {
          next.add(item.key);
        }
      });
    }
    onChange(Array.from(next));
  };

  const toggleCollapse = (domain: string) => {
    setCollapsedDomains((prev) => ({ ...prev, [domain]: !prev[domain] }));
  };

  return (
    <div className="space-y-4">
      {/* Header controls & Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between bg-zinc-50 p-3 rounded-xl border border-zinc-200">
        <div className="relative flex-1 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search permissions by name, key, or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-1.5 text-xs bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-zinc-600 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
          <label className="flex items-center gap-1.5 text-[11px] text-zinc-500 cursor-pointer select-none hover:text-zinc-800">
            <input
              type="checkbox"
              checked={showTechnicalKeys}
              onChange={(e) => setShowTechnicalKeys(e.target.checked)}
              className="rounded text-emerald-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
            />
            <span>Show Technical IDs</span>
          </label>
          <span className="font-medium text-zinc-900">
            Selected:{' '}
            <span className="font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
              {selectedPermissions.length}
            </span>{' '}
            / {catalog.length}
          </span>
        </div>
      </div>

      {/* Domain Groups */}
      <div className="space-y-3">
        {Object.keys(filteredGroups).length === 0 ? (
          <div className="p-8 text-center bg-zinc-50 rounded-xl border border-dashed border-zinc-200 text-zinc-500 text-xs">
            No permissions matching search term &quot;{searchTerm}&quot;.
          </div>
        ) : (
          Object.entries(filteredGroups).map(([domain, items]) => {
            const isCollapsed = collapsedDomains[domain] || false;
            const domainSelectedCount = items.filter((i) => selectedSet.has(i.key)).length;
            const isAllSelected = domainSelectedCount === items.length && items.length > 0;
            const isSomeSelected = domainSelectedCount > 0 && !isAllSelected;

            return (
              <div
                key={domain}
                className="border border-zinc-200 rounded-xl bg-white overflow-hidden shadow-2xs"
              >
                {/* Domain Header */}
                <div className="bg-zinc-50/80 px-4 py-3 border-b border-zinc-200/80 flex items-center justify-between gap-3 select-none">
                  <button
                    type="button"
                    onClick={() => toggleCollapse(domain)}
                    className="flex items-center gap-2 font-semibold text-xs text-zinc-900 hover:text-emerald-700 transition-colors"
                  >
                    <span>{domain}</span>
                    <span className="text-[10px] font-mono bg-zinc-200 text-zinc-700 px-1.5 py-0.5 rounded-full">
                      {domainSelectedCount} / {items.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleDomain(items)}
                    className={`text-xs flex items-center gap-1.5 font-medium transition-colors ${
                      disabled ? 'opacity-50 cursor-not-allowed text-zinc-400' : 'text-emerald-700 hover:text-emerald-900'
                    }`}
                  >
                    {isAllSelected ? (
                      <>
                        <IconCircleCheck className="w-3.5 h-3.5 text-emerald-600" /> Unselect Domain
                      </>
                    ) : isSomeSelected ? (
                      <>
                        <IconCircleCheck className="w-3.5 h-3.5 text-amber-500" /> Select All Domain
                      </>
                    ) : (
                      <>
                        <IconCircleX className="w-3.5 h-3.5 text-zinc-400" /> Select All Domain
                      </>
                    )}
                  </button>
                </div>

                {/* Domain Items */}
                {!isCollapsed && (
                  <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {items.map((item) => {
                      const isChecked = selectedSet.has(item.key);
                      const isSuperAdminPerm = item.key.startsWith('super_admin.');
                      const isItemDisabled = disabled || (isSuperAdminPerm && !isOwner);

                      return (
                        <div
                          key={item.key}
                          onClick={() => !isItemDisabled && togglePermission(item.key)}
                          className={`p-3 rounded-lg border text-left transition-all flex flex-col justify-between ${
                            isChecked
                              ? 'border-emerald-500 bg-emerald-50/40 shadow-2xs'
                              : 'border-zinc-200 bg-white hover:border-zinc-300'
                          } ${isItemDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <span className="text-xs font-semibold text-zinc-900 leading-tight">
                                {item.name}
                              </span>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                disabled={isItemDisabled}
                                onChange={() => {}}
                                className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
                              />
                            </div>

                            <p className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed">
                              {item.description || 'Provides operational access for this domain action.'}
                            </p>
                          </div>

                          {(showTechnicalKeys || isSuperAdminPerm) && (
                            <div className="flex items-center justify-between pt-2 mt-2 border-t border-zinc-100/80">
                              {showTechnicalKeys ? (
                                <span className="text-[10px] font-mono text-zinc-500 truncate max-w-[170px]" title={item.key}>
                                  {item.key}
                                </span>
                              ) : (
                                <span />
                              )}
                              {isSuperAdminPerm && (
                                <span className="flex items-center gap-1 text-[9px] font-mono bg-red-100 text-red-800 font-bold px-1.5 py-0.5 rounded">
                                  <IconShieldAlert className="w-3 h-3 text-red-600" /> Platform Only
                                </span>
                              )}
                            </div>
                          )}
                        </div>
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
  );
};
