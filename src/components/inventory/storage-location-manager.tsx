'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormattedStorageLocation } from '@/server/services/inventory.service';
import { createStorageLocationAction } from '@/server/actions/inventory';

interface StorageLocationManagerProps {
  locations: FormattedStorageLocation[];
  branchId: string;
  branchName: string;
  canManage?: boolean;
}

export function StorageLocationManager({
  locations,
  branchId,
  branchName,
  canManage = true,
}: StorageLocationManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      setErrorMsg('Name and Code are required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const res = await createStorageLocationAction({
      branchId,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: description.trim() || null,
      isDefault,
    });

    setIsSubmitting(false);

    if (res.success) {
      setName('');
      setCode('');
      setDescription('');
      setIsDefault(false);
      setShowAddForm(false);
    } else {
      setErrorMsg(res.message || 'Failed to create storage location.');
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-zinc-950">Storage Locations</h2>
          <p className="text-xs text-zinc-500">Configured storage areas for {branchName}</p>
        </div>

        {canManage && !showAddForm && (
          <Button
            size="sm"
            onClick={() => setShowAddForm(true)}
            className="text-xs font-bold min-h-[40px]"
          >
            + Add Storage Location
          </Button>
        )}
      </div>

      {showAddForm && (
        <form onSubmit={handleCreate} className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">New Storage Location</h3>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-xs text-zinc-400 hover:text-zinc-700"
            >
              ✕ Cancel
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">Location Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Cold Room, Bar Counter Store, Freezer"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!code) {
                    setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase().slice(0, 15));
                  }
                }}
                className="w-full text-xs bg-white border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 font-bold min-h-[40px]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">Code *</label>
              <input
                type="text"
                required
                placeholder="e.g. COLD_ROOM"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full text-xs bg-white border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 font-mono font-bold min-h-[40px]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1">Description (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Walk-in chiller behind main kitchen line"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs bg-white border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 min-h-[40px]"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="w-4 h-4 rounded-md border-zinc-300 text-zinc-950 focus:ring-zinc-950"
            />
            <span className="text-xs font-bold text-zinc-800">Set as Primary Default Location for this branch</span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddForm(false)}
              className="text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              size="sm"
              className="text-xs font-bold bg-zinc-950 text-white"
            >
              {isSubmitting ? 'Saving…' : 'Save Location'}
            </Button>
          </div>
        </form>
      )}

      {/* Locations List */}
      <div className="bg-white border border-zinc-200 rounded-2xl divide-y divide-zinc-100 shadow-xs overflow-hidden">
        {locations.map((loc) => (
          <div key={loc.id} className="p-4 flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-zinc-950">{loc.name}</span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600">
                  {loc.code}
                </span>
                {loc.isDefault && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Default Main Stock
                  </span>
                )}
              </div>
              {loc.description && (
                <p className="text-xs text-zinc-500 mt-1">{loc.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
