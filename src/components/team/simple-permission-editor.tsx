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
          <h4 className="font-bold text-zinc-900 text-xs">Quick Role Presets</h4>
          <button
            type="button"
            onClick={() => setIsAdvancedMode(!isAdvancedMode)}
            className="text-xs font-semibold text-amber-600 hover:text-amber-700 underline"
          >
            {isAdvancedMode ? '← Back to Simple Mode' : '⚙️ Advanced Technical Matrix'}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {ROLE_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => handleApplyPreset(preset.key)}
              disabled={disabled}
              className="px-3 py-1.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-100 hover:border-zinc-300 font-bold text-zinc-800 text-xs shadow-sm transition-all flex items-center gap-1.5"
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
              className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm space-y-3"
            >
              <h4 className="font-extrabold text-zinc-950 text-xs uppercase tracking-wider border-b border-zinc-100 pb-2">
                {group.category}
              </h4>

              <div className="space-y-2">
                {group.items.map((item) => {
                  const active = isCapabilityActive(item.keys);

                  return (
                    <label
                      key={item.label}
                      onClick={() => handleToggleCapability(item.keys)}
                      className={`flex items-start justify-between p-2.5 rounded-xl border transition-colors cursor-pointer ${
                        active
                          ? 'bg-amber-50/40 border-amber-200 text-zinc-950'
                          : 'bg-zinc-50/50 border-zinc-200/80 hover:bg-zinc-100/50 text-zinc-600'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => {}} // Handled by label container
                          disabled={disabled}
                          className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-950 focus:ring-zinc-950 accent-zinc-950"
                        />
                        <div>
                          <div className="font-bold text-zinc-950 flex items-center gap-1.5">
                            <span>{item.label}</span>
                            {item.warning && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300">
                                ⚠️ {item.warning}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-500 mt-0.5">{item.description}</p>
                        </div>
                      </div>
                    </label>
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
