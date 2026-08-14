'use client';

import React, { useState, useTransition } from 'react';
import { FormattedServiceArea } from '@/server/services/service-area.service';
import {
  createServiceAreaAction,
  updateServiceAreaAction,
  deleteServiceAreaAction,
  setBranchOrderingModeAction,
} from '@/server/actions/service-area';

interface AreaManagementProps {
  initialAreas: FormattedServiceArea[];
  activeBranchName: string;
  initialOrderingMode?: 'qr_only' | 'waiter_only' | 'qr_and_waiter';
}

export function AreaManagement({
  initialAreas,
  activeBranchName,
  initialOrderingMode = 'qr_and_waiter',
}: AreaManagementProps) {
  const [areas, setAreas] = useState<FormattedServiceArea[]>(initialAreas);
  const [orderingMode, setOrderingMode] = useState(initialOrderingMode);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<FormattedServiceArea | null>(null);

  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editActive, setEditActive] = useState(true);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleCreateArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const res = await createServiceAreaAction(createName, createDesc);
      if (res.success) {
        setSuccessMsg(`Service Area "${createName}" created.`);
        setCreateName('');
        setCreateDesc('');
        setIsCreateOpen(false);
        if ('area' in res && res.area) {
          const area = res.area as Record<string, unknown>;
          setAreas((prev) => [
            ...prev,
            {
              id: area.id as string,
              businessId: area.business_id as string,
              branchId: area.branch_id as string,
              name: area.name as string,
              code: area.code as string,
              description: area.description as string | null,
              isActive: area.is_active as boolean,
              tableCount: 0,
              staffCount: 0,
              activeOrderCount: 0,
              createdAt: area.created_at as string,
            },
          ]);
        }
      } else {
        setErrorMsg(res.message || 'Failed to create service area.');
      }
    });
  };

  const handleUpdateArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingArea || !editName.trim()) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const res = await updateServiceAreaAction(
        editingArea.id,
        editName,
        editDesc,
        editActive
      );
      if (res.success) {
        setSuccessMsg(`Area "${editName}" updated successfully.`);
        setAreas((prev) =>
          prev.map((a) =>
            a.id === editingArea.id
              ? { ...a, name: editName, description: editDesc, isActive: editActive }
              : a
          )
        );
        setEditingArea(null);
      } else {
        setErrorMsg(res.message || 'Failed to update service area.');
      }
    });
  };

  const handleDeleteArea = async (areaId: string, areaName: string) => {
    if (!confirm(`Are you sure you want to delete service area "${areaName}"?`)) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const res = await deleteServiceAreaAction(areaId);
      if (res.success) {
        setSuccessMsg(`Area "${areaName}" deleted.`);
        setAreas((prev) => prev.filter((a) => a.id !== areaId));
      } else {
        setErrorMsg(res.message || 'Failed to delete service area.');
      }
    });
  };

  const handleOrderingModeChange = (mode: 'qr_only' | 'waiter_only' | 'qr_and_waiter') => {
    setOrderingMode(mode);
    startTransition(async () => {
      const res = await setBranchOrderingModeAction(mode);
      if (res.success) {
        setSuccessMsg(`Branch ordering mode updated to ${mode.replace('_', ' ').toUpperCase()}.`);
      } else {
        setErrorMsg(res.message || 'Failed to update ordering mode.');
      }
    });
  };

  return (
    <div className="min-h-screen bg-zinc-50 p-4 sm:p-6 lg:p-8 text-zinc-950">
      {/* Header Banner */}
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-zinc-200 shadow-xs">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Service Areas</h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-800 border border-zinc-200">
                📍 {activeBranchName}
              </span>
            </div>
            <p className="text-sm text-zinc-600">
              Manage physical sections (Restaurant, Pool Area, Garden, Rooftop) and assign tables & waiters.
            </p>
          </div>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-extrabold bg-zinc-950 text-white hover:bg-zinc-800 transition-colors shadow-xs"
          >
            + Create Area
          </button>
        </div>

        {/* Feedback Banners */}
        {errorMsg && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800 font-medium">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 font-medium">
            {successMsg}
          </div>
        )}

        {/* Ordering Mode Selector */}
        <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-xs space-y-4">
          <div>
            <h2 className="text-base font-bold text-zinc-950">Ordering Mode Configuration</h2>
            <p className="text-xs text-zinc-500">Choose how customers and waiters place orders for this branch.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => handleOrderingModeChange('qr_only')}
              className={`p-4 rounded-lg border text-left transition-all ${
                orderingMode === 'qr_only'
                  ? 'border-zinc-950 bg-zinc-900 text-white shadow-xs'
                  : 'border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-900'
              }`}
            >
              <div className="font-bold text-sm">QR Ordering Only</div>
              <div className={`text-xs mt-1 ${orderingMode === 'qr_only' ? 'text-zinc-300' : 'text-zinc-500'}`}>
                Customers scan WSNexa QR and place orders directly.
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleOrderingModeChange('waiter_only')}
              className={`p-4 rounded-lg border text-left transition-all ${
                orderingMode === 'waiter_only'
                  ? 'border-zinc-950 bg-zinc-900 text-white shadow-xs'
                  : 'border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-900'
              }`}
            >
              <div className="font-bold text-sm">Waiter Ordering Only</div>
              <div className={`text-xs mt-1 ${orderingMode === 'waiter_only' ? 'text-zinc-300' : 'text-zinc-500'}`}>
                Staff take orders using WSNexa. Guest QR shows staff prompt.
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleOrderingModeChange('qr_and_waiter')}
              className={`p-4 rounded-lg border text-left transition-all ${
                orderingMode === 'qr_and_waiter'
                  ? 'border-zinc-950 bg-zinc-900 text-white shadow-xs'
                  : 'border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-900'
              }`}
            >
              <div className="font-bold text-sm">QR + Waiter (Recommended)</div>
              <div className={`text-xs mt-1 ${orderingMode === 'qr_and_waiter' ? 'text-zinc-300' : 'text-zinc-500'}`}>
                Support both guest QR ordering and staff waiter orders.
              </div>
            </button>
          </div>
        </div>

        {/* Service Areas Grid */}
        {areas.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-xl border border-zinc-200 shadow-xs">
            <div className="text-4xl mb-3">📍</div>
            <h3 className="text-lg font-bold text-zinc-950">No Service Areas Created</h3>
            <p className="text-sm text-zinc-500 max-w-md mx-auto mt-1 mb-6">
              Create your first service area (e.g. Main Restaurant, Pool Area, Rooftop) to organize tables and route waiter requests.
            </p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-extrabold bg-zinc-950 text-white rounded-lg hover:bg-zinc-800"
            >
              + Create First Area
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {areas.map((area) => (
              <div
                key={area.id}
                className="bg-white p-5 rounded-xl border border-zinc-200 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="font-bold text-base text-zinc-950">{area.name}</h3>
                      {area.description && (
                        <p className="text-xs text-zinc-500 line-clamp-2 mt-0.5">{area.description}</p>
                      )}
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                        area.isActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
                      }`}
                    >
                      {area.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {/* Area KPI Counts */}
                  <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-zinc-100 text-center">
                    <div className="bg-zinc-50 p-2 rounded-lg border border-zinc-100">
                      <div className="text-base font-extrabold text-zinc-950">{area.tableCount}</div>
                      <div className="text-[10px] uppercase font-bold text-zinc-500">Tables</div>
                    </div>
                    <div className="bg-zinc-50 p-2 rounded-lg border border-zinc-100">
                      <div className="text-base font-extrabold text-zinc-950">{area.staffCount}</div>
                      <div className="text-[10px] uppercase font-bold text-zinc-500">Waiters</div>
                    </div>
                    <div className="bg-zinc-50 p-2 rounded-lg border border-zinc-100">
                      <div className="text-base font-extrabold text-zinc-950">{area.activeOrderCount}</div>
                      <div className="text-[10px] uppercase font-bold text-zinc-500">Orders</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-5 pt-3 border-t border-zinc-100">
                  <button
                    onClick={() => {
                      setEditingArea(area);
                      setEditName(area.name);
                      setEditDesc(area.description || '');
                      setEditActive(area.isActive);
                    }}
                    className="flex-1 py-2 rounded-lg text-xs font-bold bg-zinc-100 text-zinc-900 hover:bg-zinc-200 border border-zinc-200 text-center"
                  >
                    Manage
                  </button>
                  <button
                    onClick={() => handleDeleteArea(area.id, area.name)}
                    className="px-3 py-2 rounded-lg text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Area Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl border border-zinc-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-lg font-bold text-zinc-950">Create Service Area</h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateArea} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-700 mb-1">
                  Area Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pool Area, Rooftop, Garden"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:outline-hidden focus:border-zinc-950"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-zinc-700 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Outdoor pool deck tables & loungers"
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:outline-hidden focus:border-zinc-950"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !createName.trim()}
                  className="px-4 py-2 rounded-lg text-sm font-extrabold bg-zinc-950 text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {isPending ? 'Saving...' : 'Save Area'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Area Modal */}
      {editingArea && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl border border-zinc-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-lg font-bold text-zinc-950">Edit Service Area</h3>
              <button
                onClick={() => setEditingArea(null)}
                className="text-zinc-400 hover:text-zinc-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateArea} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-700 mb-1">
                  Area Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:outline-hidden focus:border-zinc-950"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-zinc-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:outline-hidden focus:border-zinc-950"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="editActive"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-300 text-zinc-950 focus:ring-0"
                />
                <label htmlFor="editActive" className="text-sm font-medium text-zinc-900">
                  Service Area Active
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingArea(null)}
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !editName.trim()}
                  className="px-4 py-2 rounded-lg text-sm font-extrabold bg-zinc-950 text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {isPending ? 'Updating...' : 'Update Area'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
