'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FormattedInventoryCategory, FormattedStorageLocation } from '@/server/services/inventory.service';
import { createStockCountAction } from '@/server/actions/inventory';

interface StockCountWizardProps {
  locations: FormattedStorageLocation[];
  categories: FormattedInventoryCategory[];
  branchId: string;
}

export function StockCountWizard({
  locations,
  categories,
  branchId,
}: StockCountWizardProps) {
  const router = useRouter();

  const [locationId, setLocationId] = useState(locations[0]?.id || '');
  const [title, setTitle] = useState(`Physical Stock Audit - ${new Date().toLocaleDateString()}`);
  const [categoryId, setCategoryId] = useState('all');
  const [isBlindCount, setIsBlindCount] = useState(false);
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Audit title is required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const res = await createStockCountAction({
      branchId,
      locationId: locationId || locations[0]?.id,
      title: title.trim(),
      categoryId: categoryId !== 'all' ? categoryId : null,
      isBlindCount,
      notes: notes.trim() || null,
    });

    setIsSubmitting(false);

    if (res.success && 'countId' in res && res.countId) {
      router.push(`/dashboard/inventory/counts/${res.countId}`);
    } else {
      setErrorMsg(('message' in res && res.message) ? String(res.message) : 'Failed to start count.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-zinc-200 rounded-2xl p-5 sm:p-7 space-y-5 shadow-xs">
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
          {errorMsg}
        </div>
      )}

      <div>
        <label className="block text-xs font-bold text-zinc-800 mb-1">
          Audit Sheet Title <span className="text-rose-500">*</span>
        </label>
        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-zinc-900 font-bold focus:bg-white focus:ring-2 focus:ring-zinc-950 min-h-[44px]"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Location */}
        <div>
          <label className="block text-xs font-bold text-zinc-800 mb-1">Storage Location</label>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-zinc-900 font-bold focus:bg-white focus:ring-2 focus:ring-zinc-950 min-h-[44px]"
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name} {l.isDefault ? '(Main)' : ''}</option>
            ))}
          </select>
        </div>

        {/* Category Scope */}
        <div>
          <label className="block text-xs font-bold text-zinc-800 mb-1">Category Scope</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-zinc-900 font-bold focus:bg-white focus:ring-2 focus:ring-zinc-950 min-h-[44px]"
          >
            <option value="all">All Categories (Full Audit)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Blind Count Option */}
      <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-100 space-y-1">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={isBlindCount}
            onChange={(e) => setIsBlindCount(e.target.checked)}
            className="w-4 h-4 rounded-md border-zinc-300 text-zinc-950 focus:ring-zinc-950"
          />
          <span className="text-xs font-bold text-zinc-900">Conduct as Blind Count</span>
        </label>
        <p className="text-[11px] text-zinc-500 pl-6.5">
          Hides expected on-record stock quantities from staff doing the physical count to eliminate bias.
        </p>
      </div>

      <div>
        <label className="block text-xs font-bold text-zinc-800 mb-1">Audit Notes (Optional)</label>
        <input
          type="text"
          placeholder="e.g. Month-end inventory verification before delivery"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-zinc-900 focus:bg-white focus:ring-2 focus:ring-zinc-950 min-h-[40px]"
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          className="text-xs font-bold min-h-[44px]"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="text-xs font-bold bg-zinc-950 text-white min-h-[44px] px-6"
        >
          {isSubmitting ? 'Starting...' : 'Start Counting →'}
        </Button>
      </div>
    </form>
  );
}
