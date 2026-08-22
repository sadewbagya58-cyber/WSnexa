'use client';

import React from 'react';
import { ScopeType } from '@/types/authorization.types';
import { IconBuildingSkyscraper, IconBuildingStore, IconUsers, IconMapPin, IconUserCheck } from './access-icons';

export interface ScopePresetOption {
  value: ScopeType;
  label: string;
  badge: string;
  description: string;
  icon: React.ElementType;
}

export const SCOPE_PRESET_OPTIONS: ScopePresetOption[] = [
  {
    value: 'ORGANIZATION',
    label: 'Organization Wide',
    badge: 'Organization',
    description: 'Full reach across all properties, branches, departments, and units in the business.',
    icon: IconBuildingSkyscraper,
  },
  {
    value: 'PROPERTY',
    label: 'Property / Branch Level',
    badge: 'Property',
    description: 'Restricted to records belonging to the staff member’s assigned branch/property.',
    icon: IconBuildingStore,
  },
  {
    value: 'DEPARTMENT',
    label: 'Department Level',
    badge: 'Department',
    description: 'Restricted to records belonging to the staff member’s assigned department.',
    icon: IconUsers,
  },
  {
    value: 'AREA_TEAM',
    label: 'Service Area / Team Level',
    badge: 'Area / Team',
    description: 'Restricted to records belonging to the specific organization unit or service area.',
    icon: IconMapPin,
  },
  {
    value: 'SELF',
    label: 'Self Ownership Only',
    badge: 'Self Only',
    description: 'Strictly restricted to records directly owned by or created by the staff member.',
    icon: IconUserCheck,
  },
];

interface ScopePresetSelectorProps {
  label: string;
  value: ScopeType;
  onChange: (val: ScopeType) => void;
  disabled?: boolean;
  helpText?: string;
}

export const ScopePresetSelector: React.FC<ScopePresetSelectorProps> = ({
  label,
  value,
  onChange,
  disabled = false,
  helpText,
}) => {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700">
        {label}
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {SCOPE_PRESET_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isSelected = value === opt.value;

          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              className={`p-3 text-left rounded-xl border transition-all flex flex-col justify-between ${
                isSelected
                  ? 'border-emerald-600 bg-emerald-50/50 shadow-sm ring-1 ring-emerald-500'
                  : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/60'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-center justify-between w-full mb-1.5">
                <div className="flex items-center gap-2">
                  <div
                    className={`p-1.5 rounded-lg ${
                      isSelected ? 'bg-emerald-600 text-white' : 'bg-zinc-100 text-zinc-600'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-semibold text-zinc-900">{opt.label}</span>
                </div>

                <span
                  className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-full ${
                    isSelected
                      ? 'bg-emerald-100 text-emerald-800 font-semibold'
                      : 'bg-zinc-100 text-zinc-600'
                  }`}
                >
                  {opt.badge}
                </span>
              </div>

              <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed mt-1">
                {opt.description}
              </p>
            </button>
          );
        })}
      </div>

      {helpText && <p className="text-xs text-zinc-500 mt-1">{helpText}</p>}
    </div>
  );
};
