'use client';

import React, { useState } from 'react';
import { PermissionKey } from '@/lib/validation/permission';
import { ROLE_PRESETS, getPermissionsForPreset } from '@/lib/validation/permission-presets';
import { PermissionMatrix } from '@/components/team/permission-matrix';
import { FormattedPermission } from '@/server/services/permission.service';

interface SimplePermissionEditorProps {
  catalog: FormattedPermission[];
  selectedPermissions: PermissionKey[];
  onChange: (updated: PermissionKey[]) => void;
  disabled?: boolean;
}

interface CapabilityGroup {
  category: string;
  items: Array<{
    label: string;
    description: string;
    keys: PermissionKey[];
    warning?: string;
  }>;
}

export function SimplePermissionEditor({
  catalog,
  selectedPermissions,
  onChange,
  disabled = false,
}: SimplePermissionEditorProps) {
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);

  const capabilityGroups: CapabilityGroup[] = [
    {
      category: 'Orders',
      items: [
        {
          label: 'View Orders',
          description: 'View active and historical guest orders',
          keys: ['orders.view'],
        },
        {
          label: 'Update Order Status',
          description: 'Change order status (e.g. preparing, ready, completed)',
          keys: ['orders.update_status'],
        },
      ],
    },
    {
      category: 'Kitchen',
      items: [
        {
          label: 'Use Kitchen Display Screen',
          description: 'Access kitchen display and ticket queue',
          keys: ['kitchen.access'],
        },
        {
          label: 'Update Kitchen Tickets',
          description: 'Mark items preparing or ready in kitchen',
          keys: ['kitchen.update'],
        },
      ],
    },
    {
      category: 'Cashier & Payments',
      items: [
        {
          label: 'Use Cashier POS Terminal',
          description: 'Access billing and settlement terminal',
          keys: ['cashier.access'],
        },
        {
          label: 'Record Payments & Print Receipts',
          description: 'Confirm cash/card payments and print receipts',
          keys: ['payments.record', 'receipts.print', 'payments.view'],
          warning: 'Can receive and record money',
        },
      ],
    },
    {
      category: 'Menu Catalog',
      items: [
        {
          label: 'View Menu Catalog',
          description: 'View categories, items, and modifiers',
          keys: ['menu.view'],
        },
        {
          label: 'Manage Menu & Prices',
          description: 'Add, edit, or delete menu items and prices',
          keys: ['menu.manage'],
          warning: 'Can change menu prices',
        },
      ],
    },
    {
      category: 'Dining & Tables',
      items: [
        {
          label: 'View Dining Tables',
          description: 'View floor plans and table statuses',
          keys: ['tables.view'],
        },
        {
          label: 'Manage Dining Tables',
          description: 'Add or edit tables and service areas',
          keys: ['tables.manage'],
        },
        {
          label: 'Generate Table QR Codes',
          description: 'Print secure digital menu QR codes',
          keys: ['qr.manage'],
        },
      ],
    },
    {
      category: 'Customer Service',
      items: [
        {
          label: 'View Waiter Requests',
          description: 'View guest table calls and assistance requests',
          keys: ['waiter.requests.view'],
        },
        {
          label: 'Manage Waiter Requests',
          description: 'Acknowledge and clear guest calls',
          keys: ['waiter.requests.manage'],
        },
      ],
    },
    {
      category: 'Staff & Team',
      items: [
        {
          label: 'View Staff Directory',
          description: 'View list of team members and roles',
          keys: ['staff.view'],
        },
        {
          label: 'Manage Staff & Overrides',
          description: 'Assign roles, custom roles, and overrides',
          keys: ['staff.manage'],
          warning: 'Can manage other staff',
        },
        {
          label: 'Create Staff Invitations',
          description: 'Generate single-use staff invitation codes',
          keys: ['invitations.manage'],
        },
      ],
    },
    {
      category: 'Reports & Analytics',
      items: [
        {
          label: 'View Sales Analytics',
          description: 'View executive sales and operational reports',
          keys: ['reports.view'],
        },
        {
          label: 'Export Financial Reports',
          description: 'Download revenue data to CSV or Excel',
          keys: ['reports.export'],
          warning: 'Can export financial data',
        },
      ],
    },
    {
      category: 'Branch Settings',
      items: [
        {
          label: 'Manage Branch Settings',
          description: 'Edit branch details and configurations',
          keys: ['branches.manage'],
          warning: 'Can change branch settings',
        },
      ],
    },
  ];

  const handleApplyPreset = (presetKey: string) => {
    if (disabled) return;
    const keys = getPermissionsForPreset(presetKey);
    onChange(keys);
  };

  const isCapabilityActive = (keys: PermissionKey[]) => {
    return keys.every((k) => selectedPermissions.includes(k));
  };

  const handleToggleCapability = (keys: PermissionKey[]) => {
    if (disabled) return;
    const currentlyActive = isCapabilityActive(keys);

    if (currentlyActive) {
      // Remove all keys
      onChange(selectedPermissions.filter((k) => !keys.includes(k)));
    } else {
      // Add missing keys
      const newKeys = keys.filter((k) => !selectedPermissions.includes(k));
      onChange([...selectedPermissions, ...newKeys]);
    }
  };

  return (
    <div className="space-y-5 text-xs">
      {/* Preset Buttons */}
      <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-extrabold text-zinc-950 text-xs">Quick Role Presets</h4>
          <button
            type="button"
            onClick={() => setIsAdvancedMode(!isAdvancedMode)}
            className="text-xs font-bold text-amber-600 hover:text-amber-700 underline"
          >
            {isAdvancedMode ? '← Back to Simple Mode' : '⚙️ Advanced Technical Matrix'}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {ROLE_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => handleApplyPreset(preset.key)}
              disabled={disabled}
              className="px-3 py-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-100 hover:border-zinc-300 font-bold text-zinc-900 text-xs shadow-2xs transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 min-h-[44px] touch-manipulation"
            >
              <span>✨</span> {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* MODE DISPLAY */}
      {isAdvancedMode ? (
        <PermissionMatrix
          catalog={catalog}
          selectedPermissions={selectedPermissions}
          onChange={onChange}
          disabled={disabled}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {capabilityGroups.map((group) => (
            <div
              key={group.category}
              className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-2xs space-y-3"
            >
              <h4 className="font-extrabold text-zinc-950 text-xs uppercase tracking-wider border-b border-zinc-100 pb-2">
                {group.category}
              </h4>

              <div className="space-y-2">
                {group.items.map((item) => {
                  const active = isCapabilityActive(item.keys);

                  return (
                    <div
                      key={item.label}
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleCapability(item.keys);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleToggleCapability(item.keys);
                        }
                      }}
                      className={`flex items-center justify-between min-h-[48px] p-3 rounded-xl border transition-all cursor-pointer select-none active:scale-[0.99] touch-manipulation ${
                        active
                          ? 'bg-zinc-50 border-zinc-300 ring-1 ring-zinc-950/10 shadow-2xs'
                          : 'bg-white border-zinc-200 hover:bg-zinc-50/60'
                      }`}
                    >
                      <div className="flex-1 pr-3 pointer-events-none min-w-0">
                        <div className="font-extrabold text-xs text-zinc-950 flex items-center gap-1.5 flex-wrap">
                          <span>{item.label}</span>
                          {item.warning && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded border bg-amber-50 text-amber-900 border-amber-300">
                              ⚠️ {item.warning}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] mt-0.5 text-zinc-500 font-medium leading-normal">
                          {item.description}
                        </p>
                      </div>

                      <div className="pointer-events-none shrink-0">
                        {active ? (
                          <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-zinc-950 text-white text-[11px] font-extrabold tracking-wide shadow-xs border border-zinc-950">
                            ON
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-zinc-100 text-zinc-500 text-[11px] font-bold tracking-wide border border-zinc-200">
                            OFF
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
