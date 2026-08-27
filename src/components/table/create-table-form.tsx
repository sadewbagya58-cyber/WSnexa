'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingButton } from '@/components/ui/loading-button';
import { createDiningTableAction } from '@/server/actions/table';
import { TableStatus, TableShape } from '@/types/database.types';

interface CreateTableFormProps {
  areas: { id: string; name: string; code: string }[];
}

export const CreateTableForm: React.FC<CreateTableFormProps> = ({ areas }) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    serviceAreaId: areas[0]?.id || '',
    name: '',
    code: '',
    tableNumber: '',
    capacity: 4,
    status: 'available' as TableStatus,
    shape: 'square' as TableShape,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.serviceAreaId || !formData.name.trim() || !formData.code.trim()) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const res = await createDiningTableAction({
      serviceAreaId: formData.serviceAreaId,
      name: formData.name.trim(),
      code: formData.code.trim().toUpperCase(),
      tableNumber: formData.tableNumber ? parseInt(formData.tableNumber, 10) : null,
      capacity: formData.capacity,
      status: formData.status,
      shape: formData.shape,
      displayOrder: 0,
      isActive: true,
    });

    if (!res.success) {
      setErrorMsg(res.message || 'Failed to create table.');
      setLoading(false);
    } else {
      router.push('/dashboard/tables');
      router.refresh();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errorMsg && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {errorMsg}
        </div>
      )}

      <div>
        <label htmlFor="serviceAreaId" className="block text-xs font-medium text-zinc-700">
          Service Area <span className="text-red-500">*</span>
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="block text-xs font-medium text-zinc-700">
            Table Name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            type="text"
            required
            placeholder="e.g. Table 1, VIP Booth A"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="code" className="block text-xs font-medium text-zinc-700">
            Table Code <span className="text-red-500">*</span>
          </label>
          <input
            id="code"
            type="text"
            required
            placeholder="e.g. T1, VIP-1"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm uppercase text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="tableNumber" className="block text-xs font-medium text-zinc-700">
            Table Number (Optional)
          </label>
          <input
            id="tableNumber"
            type="number"
            min="1"
            placeholder="e.g. 1"
            value={formData.tableNumber}
            onChange={(e) => setFormData({ ...formData, tableNumber: e.target.value })}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="capacity" className="block text-xs font-medium text-zinc-700">
            Guest Capacity <span className="text-red-500">*</span>
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

      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={() => router.push('/dashboard/tables')}
          disabled={loading}
          className="min-h-[44px] px-4 py-2 text-xs font-semibold text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-xl"
        >
          Cancel
        </button>
        <LoadingButton type="submit" loading={loading} loadingText="Saving…">
          Create Table
        </LoadingButton>
      </div>
    </form>
  );
};
