'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingButton } from '@/components/ui/loading-button';
import { bulkCreateDiningTablesAction } from '@/server/actions/table';
import { TableShape } from '@/types/database.types';

interface BulkGeneratorFormProps {
  areas: { id: string; name: string; code: string }[];
}

export const BulkGeneratorForm: React.FC<BulkGeneratorFormProps> = ({ areas }) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    serviceAreaId: areas[0]?.id || '',
    prefix: 'T',
    startNumber: 1,
    count: 10,
    capacity: 4,
    shape: 'square' as TableShape,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.serviceAreaId || !formData.prefix.trim()) {
      setErrorMsg('Please select a service area and enter a prefix.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const res = await bulkCreateDiningTablesAction({
      serviceAreaId: formData.serviceAreaId,
      prefix: formData.prefix.trim().toUpperCase(),
      startNumber: formData.startNumber,
      count: formData.count,
      capacity: formData.capacity,
      shape: formData.shape,
    });

    if (!res.success) {
      setErrorMsg(res.message || 'Bulk table creation failed.');
      setLoading(false);
    } else {
      router.push('/dashboard/tables');
      router.refresh();
    }
  };

  // Preview generated codes
  const previewCodes = Array.from(
    { length: Math.min(5, formData.count) },
    (_, i) => `${formData.prefix.toUpperCase()}${formData.startNumber + i}`
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {errorMsg && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {errorMsg}
        </div>
      )}

      <div>
        <label htmlFor="serviceAreaId" className="block text-xs font-medium text-zinc-700">
          Target Service Area <span className="text-red-500">*</span>
        </label>
        <select
          id="serviceAreaId"
          required
          value={formData.serviceAreaId}
          onChange={(e) => setFormData({ ...formData, serviceAreaId: e.target.value })}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none"
        >
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.code})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="prefix" className="block text-xs font-medium text-zinc-700">
            Table Code Prefix <span className="text-red-500">*</span>
          </label>
          <input
            id="prefix"
            type="text"
            required
            placeholder="e.g. T or HALL-"
            value={formData.prefix}
            onChange={(e) => setFormData({ ...formData, prefix: e.target.value })}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm uppercase text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="startNumber" className="block text-xs font-medium text-zinc-700">
            Start Number <span className="text-red-500">*</span>
          </label>
          <input
            id="startNumber"
            type="number"
            min="1"
            required
            value={formData.startNumber}
            onChange={(e) => setFormData({ ...formData, startNumber: parseInt(e.target.value, 10) || 1 })}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="count" className="block text-xs font-medium text-zinc-700">
            Number of Tables (1-500) <span className="text-red-500">*</span>
          </label>
          <input
            id="count"
            type="number"
            min="1"
            max="500"
            required
            value={formData.count}
            onChange={(e) => setFormData({ ...formData, count: parseInt(e.target.value, 10) || 1 })}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="capacity" className="block text-xs font-medium text-zinc-700">
            Default Guest Capacity <span className="text-red-500">*</span>
          </label>
          <input
            id="capacity"
            type="number"
            min="1"
            max="50"
            required
            value={formData.capacity}
            onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value, 10) || 1 })}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="shape" className="block text-xs font-medium text-zinc-700">
            Table Shape
          </label>
          <select
            id="shape"
            value={formData.shape}
            onChange={(e) => setFormData({ ...formData, shape: e.target.value as TableShape })}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none"
          >
            <option value="square">Square</option>
            <option value="rectangle">Rectangle</option>
            <option value="round">Round</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
        <h4 className="text-xs font-bold text-zinc-900">Generated Codes Preview</h4>
        <p className="mt-1 text-xs text-zinc-500">
          Will generate {formData.count} tables: {previewCodes.join(', ')}
          {formData.count > 5 ? `, ... through ${formData.prefix.toUpperCase()}${formData.startNumber + formData.count - 1}` : ''}
        </p>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.push('/dashboard/tables')}
          disabled={loading}
          className="min-h-[44px] px-4 py-2 text-xs font-semibold text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-xl"
        >
          Cancel
        </button>
        <LoadingButton
          type="submit"
          loading={loading}
          loadingText="Generating Tables…"
        >
          Generate {formData.count} Tables
        </LoadingButton>
      </div>
    </form>
  );
};
