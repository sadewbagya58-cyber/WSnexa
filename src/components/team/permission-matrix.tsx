'use client';

import React from 'react';
import { PermissionKey, ownerOnlyPermissions } from '@/lib/validation/permission';
import { FormattedPermission } from '@/server/services/permission.service';

interface PermissionMatrixProps {
  catalog: FormattedPermission[];
  selectedPermissions: PermissionKey[];
  onChange?: (updated: PermissionKey[]) => void;
  readOnly?: boolean;
  disabled?: boolean;
}

export function PermissionMatrix({
  catalog,
  selectedPermissions,
  onChange,
  readOnly = false,
  disabled = false,
}: PermissionMatrixProps) {
  // Group by category
  const categories = Array.from(new Set(catalog.map((c) => c.category)));

  const handleToggle = (key: PermissionKey) => {
    if (readOnly || disabled || !onChange) return;

    if (selectedPermissions.includes(key)) {
      onChange(selectedPermissions.filter((k) => k !== key));
    } else {
      onChange([...selectedPermissions, key]);
    }
  };

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'critical':
        return 'bg-rose-500/10 text-rose-600 border-rose-500/30';
      case 'high':
        return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
      case 'medium':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/30';
      default:
        return 'bg-zinc-100 text-zinc-600 border-zinc-200';
    }
  };

  return (
    <div className="space-y-6 text-xs">
      {categories.map((cat) => {
        const catPermissions = catalog.filter((c) => c.category === cat);
        return (
          <div key={cat} className="border border-zinc-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="bg-zinc-50 border-b border-zinc-200 px-4 py-2.5 flex items-center justify-between">
              <h4 className="font-bold text-zinc-900 text-xs uppercase tracking-wider">{cat}</h4>
              <span className="text-[10px] text-zinc-500 font-mono">
                {catPermissions.filter((p) => selectedPermissions.includes(p.key)).length} / {catPermissions.length} Enabled
              </span>
            </div>

            <div className="divide-y divide-zinc-100">
              {catPermissions.map((p) => {
                const isSelected = selectedPermissions.includes(p.key);
                const isOwnerOnly = ownerOnlyPermissions.includes(p.key);

                return (
                  <label
                    key={p.key}
                    onClick={() => handleToggle(p.key)}
                    className={`flex items-start justify-between p-3 transition-colors cursor-pointer ${
                      readOnly ? 'cursor-default' : 'hover:bg-zinc-50'
                    } ${isSelected ? 'bg-amber-50/30' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // Handled by container onClick
                        disabled={readOnly || disabled}
                        className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 accent-zinc-900"
                      />
                      <div>
                        <div className="font-bold text-zinc-900 flex items-center gap-2">
                          <span>{p.name}</span>
                          <span className="font-mono text-[10px] text-zinc-400 font-normal">({p.key})</span>
                          {isOwnerOnly && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 border border-purple-200">
                              Owner Only
                            </span>
                          )}
                        </div>
                        {p.description && (
                          <p className="text-[11px] text-zinc-500 mt-0.5">{p.description}</p>
                        )}
                      </div>
                    </div>

                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getRiskBadge(
                        p.riskLevel
                      )}`}
                    >
                      {p.riskLevel}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
