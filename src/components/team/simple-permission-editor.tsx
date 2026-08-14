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
      category: 'Orders Operations',
      items: [
        {
          label: 'View Active Orders',
          description: 'View live operational guest orders',
          keys: ['orders.view'],
        },
        {
          label: 'Create Orders',
          description: 'Create new table or guest orders',
          keys: ['orders.create'],
        },
        {
          label: 'Update Order Status',
          description: 'Change order status (e.g. preparing, ready, completed)',
          keys: ['orders.update_status'],
        },
        {
          label: 'Cancel Orders',
          description: 'Cancel or void active orders',
          keys: ['orders.cancel'],
          warning: 'Can cancel live orders',
        },
        {
          label: 'View Order History',
          description: 'View historical completed and cancelled order records',
          keys: ['orders.history.view'],
        },
      ],
    },
    {
      category: 'Waiter & Table Service',
      items: [
        {
          label: 'Access Waiter Workspace',
          description: 'Access waiter service center and table operations',
          keys: ['waiter.access'],
        },
        {
          label: 'View Waiter Requests',
          description: 'View guest table calls and assistance requests',
          keys: ['waiter.requests.view'],
        },
        {
          label: 'Manage Waiter Requests',
          description: 'Acknowledge, clear, or resolve waiter requests',
          keys: ['waiter.requests.manage'],
        },
        {
          label: 'Create Waiter Table Orders',
          description: 'Place orders on behalf of guests from waiter workspace',
          keys: ['waiter.orders.create'],
        },
      ],
    },
    {
      category: 'Kitchen Display (KDS)',
      items: [
        {
          label: 'Access Kitchen Display Screen',
          description: 'Access kitchen display system queue',
          keys: ['kitchen.access'],
        },
        {
          label: 'View Kitchen Tickets',
          description: 'View active kitchen order tickets',
          keys: ['kitchen.orders.view'],
        },
        {
          label: 'Update Kitchen Ticket State',
          description: 'Mark items preparing or ready in kitchen',
          keys: ['kitchen.update'],
        },
      ],
    },
    {
      category: 'Cashier & Billing',
      items: [
        {
          label: 'Access Cashier POS',
          description: 'Access billing terminal and order settlements',
          keys: ['cashier.access'],
        },
        {
          label: 'View Payment Audit Logs',
          description: 'View payment transaction history',
          keys: ['payments.view'],
        },
        {
          label: 'Record Payments & Receipts',
          description: 'Confirm cash, card, or QR payments and print receipts',
          keys: ['payments.record', 'receipts.print'],
          warning: 'Handles monetary transactions',
        },
        {
          label: 'Void & Refund Payments',
          description: 'Void un-settled records or issue customer refunds',
          keys: ['payments.void', 'payments.refund'],
          warning: 'High risk payment operations',
        },
      ],
    },
    {
      category: 'Menu Management',
      items: [
        {
          label: 'View Menu Catalog',
          description: 'View menu categories, items, and pricing',
          keys: ['menu.view'],
        },
        {
          label: 'Create & Edit Menu Items',
          description: 'Add new items or edit item name, description, and images',
          keys: ['menu.items.create', 'menu.items.edit'],
        },
        {
          label: 'Update Prices',
          description: 'Modify item base prices and modifier prices',
          keys: ['menu.price.update'],
          warning: 'Modifies pricing',
        },
        {
          label: 'Toggle Stock Status',
          description: 'Toggle item availability (in stock / sold out)',
          keys: ['menu.availability.update'],
        },
        {
          label: 'Delete Menu Items',
          description: 'Archive or delete menu items from catalog',
          keys: ['menu.items.delete'],
          warning: 'Permanently removes menu items',
        },
        {
          label: 'Manage Categories & Modifiers',
          description: 'Create and organize categories and modifier groups',
          keys: ['menu.categories.manage', 'menu.modifiers.manage'],
        },
      ],
    },
    {
      category: 'Dining & Tables',
      items: [
        {
          label: 'View Dining Tables',
          description: 'View table visual floor plans and occupancy',
          keys: ['tables.view'],
        },
        {
          label: 'Update Table Status',
          description: 'Mark table status (available, occupied, reserved)',
          keys: ['tables.status.update'],
        },
        {
          label: 'Create & Edit Table Layout',
          description: 'Add, edit, or remove floor tables',
          keys: ['tables.create', 'tables.edit'],
        },
        {
          label: 'Manage Service Areas',
          description: 'Create and organize dining service areas',
          keys: ['areas.view', 'areas.manage'],
        },
        {
          label: 'Generate QR Ordering Cards',
          description: 'Download and print table QR ordering codes',
          keys: ['qr.view', 'qr.generate'],
        },
      ],
    },
    {
      category: 'Team & Access Control',
      items: [
        {
          label: 'View Staff Roster',
          description: 'View team members list and branch assignments',
          keys: ['staff.view'],
        },
        {
          label: 'Invite & Edit Staff',
          description: 'Send invitations and update staff profile details',
          keys: ['staff.invite', 'staff.edit'],
        },
        {
          label: 'Suspend & Reactivate Staff',
          description: 'Suspend or restore staff membership access',
          keys: ['staff.suspend'],
          warning: 'Can suspend staff access',
        },
        {
          label: 'Assign Roles & Service Areas',
          description: 'Assign roles, custom roles, and service areas to staff',
          keys: ['staff.role.assign', 'staff.branch.assign', 'staff.area.assign'],
          warning: 'Manages staff permissions and scopes',
        },
        {
          label: 'Manage Custom Roles & Overrides',
          description: 'Create custom roles or set explicit member overrides',
          keys: ['roles.view', 'roles.manage', 'permissions.override.manage'],
          warning: 'Full access control administration',
        },
      ],
    },
    {
      category: 'Reports & Analytics',
      items: [
        {
          label: 'View Operational Reports',
          description: 'View daily order counts and operational summaries',
          keys: ['reports.view'],
        },
        {
          label: 'View Financial Analytics',
          description: 'View revenue breakdowns, margins, and sales metrics',
          keys: ['reports.financial.view'],
          warning: 'Access to financial revenue data',
        },
        {
          label: 'Export Sales Reports',
          description: 'Download revenue analytics data to CSV/Excel',
          keys: ['reports.export'],
        },
      ],
    },
    {
      category: 'Branch & Business Settings',
      items: [
        {
          label: 'View Branch Directory',
          description: 'View branch locations and details',
          keys: ['branches.view'],
        },
        {
          label: 'Manage Branch Operations',
          description: 'Configure branch ordering modes and hours',
          keys: ['branches.operational.manage'],
        },
        {
          label: 'Manage Branch Entities & Business Settings',
          description: 'Create branches, edit legal settings, or configure security',
          keys: ['branches.manage', 'business.view', 'business.settings.manage'],
          warning: 'Business administration level',
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
