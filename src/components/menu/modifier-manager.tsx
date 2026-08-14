'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  createModifierGroupAction,
  archiveModifierGroupAction,
  createModifierOptionAction,
  archiveModifierOptionAction,
} from '@/server/actions/modifier';
import { formatMinorUnitsToDecimal } from '@/lib/utils/money';

interface ModifierOptionItem {
  id: string;
  name: string;
  additional_price_cents: number;
  display_order: number;
  is_active: boolean;
}

interface ModifierGroupItem {
  id: string;
  name: string;
  description: string | null;
  selection_type: 'single' | 'multiple';
  is_required: boolean;
  min_selections: number;
  max_selections: number | null;
  display_order: number;
  is_active: boolean;
  modifier_options: ModifierOptionItem[];
}

interface ModifierManagerProps {
  menuItemId: string;
  currency: string;
  initialGroups: ModifierGroupItem[];
}

export const ModifierManager: React.FC<ModifierManagerProps> = ({
  menuItemId,
  currency,
  initialGroups,
}) => {
  const [groups, setGroups] = useState<ModifierGroupItem[]>(initialGroups);
  const [groupLoading, setGroupLoading] = useState(false);
  const [optionLoading, setOptionLoading] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Group Form State
  const [groupForm, setGroupForm] = useState({
    name: '',
    description: '',
    selectionType: 'single' as 'single' | 'multiple',
    isRequired: false,
    minSelections: 0,
    maxSelections: 1,
  });

  // Option Form State per group
  const [optionForms, setOptionForms] = useState<Record<string, { name: string; price: string }>>({});

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupForm.name.trim()) return;

    if (groupForm.selectionType === 'multiple' && groupForm.maxSelections > 0 && groupForm.minSelections > groupForm.maxSelections) {
      setErrorMsg('Minimum selections cannot exceed maximum selections.');
      return;
    }

    setGroupLoading(true);
    setErrorMsg(null);

    const res = await createModifierGroupAction({
      menuItemId,
      name: groupForm.name.trim(),
      description: groupForm.description.trim() || undefined,
      selectionType: groupForm.selectionType,
      isRequired: groupForm.isRequired,
      minSelections: groupForm.isRequired ? Math.max(1, groupForm.minSelections) : groupForm.minSelections,
      maxSelections: groupForm.selectionType === 'single' ? 1 : groupForm.maxSelections,
      displayOrder: groups.length,
      isActive: true,
    });

    if (!res.success) {
      setErrorMsg(res.message || 'Failed to create modifier group.');
    } else {
      setGroupForm({
        name: '',
        description: '',
        selectionType: 'single',
        isRequired: false,
        minSelections: 0,
        maxSelections: 1,
      });
      window.location.reload();
    }
    setGroupLoading(false);
  };

  const handleArchiveGroup = async (groupId: string) => {
    if (!confirm('Are you sure you want to archive this modifier group?')) return;
    const res = await archiveModifierGroupAction(groupId);
    if (res.success) {
      setGroups(groups.filter((g) => g.id !== groupId));
    } else {
      alert(res.message);
    }
  };

  const handleCreateOption = async (groupId: string, e: React.FormEvent) => {
    e.preventDefault();
    const form = optionForms[groupId];
    if (!form || !form.name.trim()) return;

    const numPrice = parseFloat(form.price || '0');
    if (isNaN(numPrice) || numPrice < 0) {
      alert('Please enter a valid non-negative price.');
      return;
    }

    setOptionLoading(groupId);
    const res = await createModifierOptionAction({
      modifierGroupId: groupId,
      name: form.name.trim(),
      additionalPrice: numPrice,
      displayOrder: 0,
      isActive: true,
    });

    if (!res.success) {
      alert(res.message || 'Failed to add option.');
    } else {
      setOptionForms({ ...optionForms, [groupId]: { name: '', price: '' } });
      window.location.reload();
    }
    setOptionLoading(null);
  };

  const handleArchiveOption = async (groupId: string, optionId: string) => {
    if (!confirm('Are you sure you want to archive this option?')) return;
    const res = await archiveModifierOptionAction(optionId);
    if (res.success) {
      setGroups(
        groups.map((g) =>
          g.id === groupId
            ? { ...g, modifier_options: g.modifier_options.filter((o) => o.id !== optionId) }
            : g
        )
      );
    } else {
      alert(res.message);
    }
  };

  return (
    <div className="space-y-8">
      {/* Create Modifier Group Card */}
      <Card className="p-6">
        <h2 className="text-base font-semibold text-zinc-950">Add Modifier Group</h2>
        <p className="text-xs text-zinc-500">
          Group options such as Size, Spice Level, or Extra Toppings.
        </p>

        {errorMsg && (
          <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700 font-semibold">
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleCreateGroup} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="groupName" className="block text-xs font-medium text-zinc-700">
                Group Name <span className="text-red-500">*</span>
              </label>
              <input
                id="groupName"
                type="text"
                required
                placeholder="e.g. Choice of Protein, Extra Cheese"
                value={groupForm.name}
                onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="selectionType" className="block text-xs font-medium text-zinc-700">
                Selection Mode <span className="text-red-500">*</span>
              </label>
              <select
                id="selectionType"
                value={groupForm.selectionType}
                onChange={(e) =>
                  setGroupForm({
                    ...groupForm,
                    selectionType: e.target.value as 'single' | 'multiple',
                    maxSelections: e.target.value === 'single' ? 1 : groupForm.maxSelections,
                  })
                }
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none"
              >
                <option value="single">Single Choice (Radio Buttons)</option>
                <option value="multiple">Multiple Choice (Checkboxes)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 text-xs font-medium text-zinc-900">
              <input
                type="checkbox"
                checked={groupForm.isRequired}
                onChange={(e) =>
                  setGroupForm({
                    ...groupForm,
                    isRequired: e.target.checked,
                    minSelections: e.target.checked ? 1 : 0,
                  })
                }
                className="h-4 w-4 rounded border-zinc-300 text-zinc-950 focus:ring-zinc-950"
              />
              Required selection
            </label>

            {groupForm.selectionType === 'multiple' && (
              <div className="flex items-center gap-3 text-xs text-zinc-700">
                <label className="flex items-center gap-1">
                  Min:
                  <input
                    type="number"
                    min="0"
                    value={groupForm.minSelections}
                    onChange={(e) =>
                      setGroupForm({ ...groupForm, minSelections: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-16 rounded border border-zinc-300 px-2 py-1 text-sm text-zinc-900"
                  />
                </label>
                <label className="flex items-center gap-1">
                  Max:
                  <input
                    type="number"
                    min="1"
                    value={groupForm.maxSelections ?? ''}
                    onChange={(e) =>
                      setGroupForm({
                        ...groupForm,
                        maxSelections: e.target.value ? parseInt(e.target.value, 10) : 1,
                      })
                    }
                    className="w-16 rounded border border-zinc-300 px-2 py-1 text-sm text-zinc-900"
                  />
                </label>
              </div>
            )}
          </div>

          <div className="pt-2">
            <Button type="submit" disabled={groupLoading}>
              {groupLoading ? 'Creating Group...' : '+ Save Modifier Group'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Modifier Groups List */}
      <div className="space-y-6">
        {groups.map((group) => {
          const hasZeroOptions = group.modifier_options.length === 0;
          const isGroupRequired = group.is_required || group.min_selections > 0;

          return (
            <Card key={group.id} className="p-6">
              <div className="flex items-start justify-between border-b border-zinc-100 pb-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-zinc-950">{group.name}</h3>
                    <Badge variant={group.is_required ? 'neutral' : 'warning'}>
                      {group.is_required ? 'Required' : 'Optional'}
                    </Badge>
                    <Badge variant="neutral">
                      {group.selection_type === 'single'
                        ? 'Single Choice'
                        : `Multiple (Max ${group.max_selections || '∞'})`}
                    </Badge>
                    {isGroupRequired && hasZeroOptions && (
                      <Badge variant="destructive">⚠️ 0 Options (Guest optional until options added)</Badge>
                    )}
                  </div>
                  {group.description && (
                    <p className="mt-1 text-xs text-zinc-500">{group.description}</p>
                  )}
                  {isGroupRequired && hasZeroOptions && (
                    <p className="mt-1 text-xs font-semibold text-amber-700">
                      Add options below so customers can select required modifiers.
                    </p>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleArchiveGroup(group.id)}
                >
                  Archive Group
                </Button>
              </div>

              {/* Group Options List */}
              <div className="mt-4 space-y-3">
                <h4 className="text-xs font-semibold text-zinc-500">
                  Options ({group.modifier_options.length})
                </h4>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                  {group.modifier_options.map((opt) => (
                    <div
                      key={opt.id}
                      className="flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 p-3"
                    >
                      <div>
                        <span className="text-xs font-bold text-zinc-900">{opt.name}</span>
                        <p className="text-[11px] font-semibold text-zinc-600">
                          {opt.additional_price_cents > 0
                            ? `+${currency} ${formatMinorUnitsToDecimal(opt.additional_price_cents)}`
                            : 'Free'}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => handleArchiveOption(group.id, opt.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Add Option Form */}
                <form
                  onSubmit={(e) => handleCreateOption(group.id, e)}
                  className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center"
                >
                  <input
                    type="text"
                    required
                    placeholder="New option name (e.g. Medium, Extra Bacon)"
                    value={optionForms[group.id]?.name || ''}
                    onChange={(e) =>
                      setOptionForms({
                        ...optionForms,
                        [group.id]: { ...(optionForms[group.id] || { price: '' }), name: e.target.value },
                      })
                    }
                    className="flex-1 rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-900 focus:border-zinc-950 focus:outline-none"
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={`+ Price (${currency})`}
                    value={optionForms[group.id]?.price || ''}
                    onChange={(e) =>
                      setOptionForms({
                        ...optionForms,
                        [group.id]: { ...(optionForms[group.id] || { name: '' }), price: e.target.value },
                      })
                    }
                    className="w-32 rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-900 focus:border-zinc-950 focus:outline-none"
                  />
                  <Button type="submit" size="sm" disabled={optionLoading === group.id}>
                    {optionLoading === group.id ? 'Adding...' : '+ Add Option'}
                  </Button>
                </form>
              </div>
            </Card>
          );
        })}

        {groups.length === 0 && (
          <Card className="p-8 text-center text-xs text-zinc-500">
            No modifier groups added for this item yet. Use the form above to add your first group.
          </Card>
        )}
      </div>
    </div>
  );
};
