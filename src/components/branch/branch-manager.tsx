'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  createBranchAction,
  updateBranchAction,
  archiveBranchAction,
  restoreBranchAction,
  deleteBranchAction,
} from '@/server/actions/branch';
import { BranchInfo } from '@/types';

interface BranchManagerProps {
  business: {
    id: string;
    name: string;
    defaultCurrency: string;
    timezone: string;
  };
  branches: BranchInfo[];
  quota: {
    allowed: boolean;
    currentBranchCount: number;
    maxBranchLimit: number;
    subscriptionTier: string;
  };
  isOwner: boolean;
}

export const BranchManager: React.FC<BranchManagerProps> = ({
  business,
  branches,
  quota,
  isOwner,
}) => {
  const [filter, setFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingBranch, setEditingBranch] = useState<BranchInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form inputs
  const [name, setName] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [addressLine1, setAddressLine1] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [timezone, setTimezone] = useState<string>(business.timezone || 'UTC');
  const [requireTableSelection, setRequireTableSelection] = useState<boolean>(true);
  const [requireTablePin, setRequireTablePin] = useState<boolean>(false);
  const [tablePinLength, setTablePinLength] = useState<number>(4);
  const [latitude, setLatitude] = useState<string>('');
  const [longitude, setLongitude] = useState<string>('');
  const [geoLocating, setGeoLocating] = useState<boolean>(false);

  const filteredBranches = branches.filter((b) => {
    if (filter === 'active') return b.status === 'active';
    if (filter === 'archived') return b.status === 'archived';
    return true;
  });

  const handleUseCurrentLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser.');
      return;
    }
    setGeoLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toString());
        setLongitude(pos.coords.longitude.toString());
        setGeoLocating(false);
      },
      (err) => {
        setErrorMsg(`Failed to get location: ${err.message}`);
        setGeoLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const openCreateModal = () => {
    setEditingBranch(null);
    setName('');
    setCode('');
    setPhone('');
    setEmail('');
    setAddressLine1('');
    setCity('');
    setTimezone(business.timezone || 'UTC');
    setRequireTableSelection(true);
    setRequireTablePin(false);
    setTablePinLength(4);
    setLatitude('');
    setLongitude('');
    setErrorMsg(null);
    setModalOpen(true);
  };

  const openEditModal = (branch: BranchInfo) => {
    setEditingBranch(branch);
    setName(branch.name);
    setCode(branch.code);
    setPhone(branch.phone || '');
    setEmail(branch.email || '');
    setAddressLine1(branch.address_line1 || '');
    setCity(branch.city || '');
    setTimezone(branch.timezone || business.timezone || 'UTC');
    setRequireTableSelection(branch.require_table_selection ?? true);
    setRequireTablePin(branch.require_table_pin ?? false);
    setTablePinLength(branch.table_pin_length ?? 4);
    setLatitude(branch.latitude != null ? branch.latitude.toString() : '');
    setLongitude(branch.longitude != null ? branch.longitude.toString() : '');
    setErrorMsg(null);
    setModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    if (editingBranch) {
      const res = await updateBranchAction(editingBranch.id, {
        name,
        code,
        phone,
        email,
        address_line_1: addressLine1,
        city,
        timezone,
        require_table_selection: requireTableSelection,
        require_table_pin: requireTablePin,
        table_pin_length: tablePinLength,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
      });

      setLoading(false);
      if (res.success) {
        setModalOpen(false);
      } else {
        setErrorMsg(res.message || 'Error occurred');
      }
    } else {
      const res = await createBranchAction({
        name,
        code,
        phone,
        email,
        address_line_1: addressLine1,
        city,
        timezone,
        require_table_selection: requireTableSelection,
        require_table_pin: requireTablePin,
        table_pin_length: tablePinLength,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
      });

      setLoading(false);
      if (res.success) {
        setModalOpen(false);
      } else {
        setErrorMsg(res.message || 'Error occurred');
      }
    }
  };

  const handleArchive = async (branchId: string) => {
    if (!confirm('Archive this branch? Active tables and digital menus will be hidden.')) return;
    const res = await archiveBranchAction(branchId);
    if (!res.success) alert(res.message);
  };

  const handleRestore = async (branchId: string) => {
    const res = await restoreBranchAction(branchId);
    if (!res.success) alert(res.message);
  };

  const handleDelete = async (branchId: string) => {
    if (!confirm('Permanently delete this empty archived branch? This action cannot be undone.')) return;
    const res = await deleteBranchAction(branchId);
    if (!res.success) alert(res.message);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Quota Progress */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-extrabold text-zinc-950 flex flex-wrap items-center gap-2">
              Multi-Branch Management
              <Badge variant="neutral" className="uppercase text-[10px]">
                {quota.subscriptionTier} Plan
              </Badge>
            </h1>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
              Manage physical restaurant locations, branch ordering settings, and independent QR codes for {business.name}.
            </p>
          </div>

          {isOwner && (
            <Button
              onClick={openCreateModal}
              disabled={!quota.allowed}
              className="text-xs font-bold shrink-0 shadow-sm min-h-[44px] w-full sm:w-auto"
            >
              ✨ Create New Branch
            </Button>
          )}
        </div>

        {/* Quota Progress Bar */}
        <div className="pt-3 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-zinc-700">Branch Limit:</span>
            <span className="font-mono text-zinc-950">
              {quota.currentBranchCount} / {quota.maxBranchLimit === 999999 ? '∞' : quota.maxBranchLimit} Branches Used
            </span>
          </div>

          {!quota.allowed && (
            <span className="text-amber-800 font-bold text-[11px]">
              ⚠️ Branch limit reached for your {quota.subscriptionTier} plan.
            </span>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between overflow-x-auto pb-1">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`rounded-full px-4 py-2 text-xs font-bold transition-all min-h-[44px] touch-manipulation ${
              filter === 'all'
                ? 'bg-zinc-950 text-white shadow-sm'
                : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100'
            }`}
          >
            All Branches ({branches.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('active')}
            className={`rounded-full px-4 py-2 text-xs font-bold transition-all min-h-[44px] touch-manipulation ${
              filter === 'active'
                ? 'bg-zinc-950 text-white shadow-sm'
                : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100'
            }`}
          >
            Active ({branches.filter((b) => b.status === 'active').length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('archived')}
            className={`rounded-full px-4 py-2 text-xs font-bold transition-all min-h-[44px] touch-manipulation ${
              filter === 'archived'
                ? 'bg-zinc-950 text-white shadow-sm'
                : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100'
            }`}
          >
            Archived ({branches.filter((b) => b.status === 'archived').length})
          </button>
        </div>
      </div>

      {/* Branch Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredBranches.map((branch) => (
          <div
            key={branch.id}
            className={`rounded-2xl border bg-white p-5 shadow-2xs space-y-4 flex flex-col justify-between transition-all ${
              branch.status === 'archived' ? 'border-zinc-200 opacity-60 bg-zinc-50/50' : 'border-zinc-200 hover:border-zinc-400'
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-zinc-950">{branch.name}</h3>
                    {branch.isDefault && <Badge variant="warning">Primary</Badge>}
                  </div>
                  <span className="font-mono text-xs font-bold text-zinc-500">Code: {branch.code}</span>
                </div>

                <Badge variant={branch.status === 'active' ? 'success' : 'neutral'} className="capitalize">
                  {branch.status}
                </Badge>
              </div>

              <div className="space-y-1 text-xs text-zinc-600 border-t border-zinc-100 pt-3">
                {branch.city && <div>📍 Location: {branch.city}</div>}
                {branch.phone && <div>📞 Phone: {branch.phone}</div>}
                {branch.email && <div>✉️ Email: {branch.email}</div>}
                <div>🌐 Timezone: {branch.timezone}</div>
              </div>

              {/* Settings Badges */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-700">
                  {branch.require_table_selection ? '📍 Table Req' : '🔓 No-Table Flow'}
                </span>
                <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-700">
                  {branch.require_table_pin ? `🔒 PIN (${branch.table_pin_length} Digits)` : '🔓 PIN Off'}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            {isOwner && (
              <div className="flex items-center justify-between pt-3 border-t border-zinc-100 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditModal(branch)}
                  className="text-xs flex-1"
                >
                  ✏️ Edit
                </Button>

                {branch.status === 'active' && !branch.isDefault && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleArchive(branch.id)}
                    className="text-xs text-amber-800 border-amber-200 hover:bg-amber-50"
                  >
                    📁 Archive
                  </Button>
                )}

                {branch.status === 'archived' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestore(branch.id)}
                      className="text-xs text-emerald-800 border-emerald-200 hover:bg-emerald-50"
                    >
                      🔄 Restore
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(branch.id)}
                      className="text-xs text-red-700 border-red-200 hover:bg-red-50"
                    >
                      🗑️ Delete
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}

        {filteredBranches.length === 0 && (
          <div className="col-span-full rounded-2xl border-2 border-dashed border-zinc-200 bg-white p-12 text-center text-xs text-zinc-500">
            No branches found matching filter &quot;{filter}&quot;.
          </div>
        )}
      </div>

      {/* Create / Edit Branch Modal */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in"
        >
          <form
            onSubmit={handleFormSubmit}
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200 space-y-5 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h2 className="text-lg font-bold text-zinc-950">
                {editingBranch ? `Edit Branch: ${editingBranch.name}` : 'Create New Branch'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800">
                ⚠️ {errorMsg}
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Branch Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kandy Branch"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Branch Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. KDY"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="w-full font-mono uppercase rounded-xl border border-zinc-300 p-2.5 text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+94 81 234 5678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">City</label>
                  <input
                    type="text"
                    placeholder="Kandy"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">Address Line 1</label>
                <input
                  type="text"
                  placeholder="123 Peradeniya Road"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none"
                />
              </div>

              {/* Venue Geolocation Coordinates */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-blue-950 uppercase tracking-wider">
                    Venue GPS Location Coordinates
                  </h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleUseCurrentLocation}
                    disabled={geoLocating}
                    className="text-[11px] font-bold bg-white text-blue-900 border-blue-300 hover:bg-blue-100"
                  >
                    {geoLocating ? 'Locating…' : 'Use Current Location'}
                  </Button>
                </div>
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  Used by the order security engine to verify customers are physically inside the venue before allowing checkout.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 mb-1">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 7.2906"
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs font-mono text-zinc-950 bg-white focus:border-zinc-950 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 mb-1">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 80.6337"
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs font-mono text-zinc-950 bg-white focus:border-zinc-950 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Ordering & Table PIN Settings */}
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-3">
                <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                  Branch Ordering & Table PIN Settings
                </h4>

                <label className="flex items-center gap-2 text-xs font-medium text-zinc-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireTableSelection}
                    onChange={(e) => setRequireTableSelection(e.target.checked)}
                    className="h-4 w-4 accent-zinc-950 rounded"
                  />
                  <span>Require Guest Table Selection before Ordering</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-medium text-zinc-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireTablePin}
                    onChange={(e) => setRequireTablePin(e.target.checked)}
                    className="h-4 w-4 accent-zinc-950 rounded"
                  />
                  <span>Require Table Security PIN Verification</span>
                </label>

                {requireTablePin && (
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">
                      Table PIN Length
                    </label>
                    <select
                      value={tablePinLength}
                      onChange={(e) => setTablePinLength(Number(e.target.value))}
                      className="w-full rounded-xl border border-zinc-300 p-2 text-xs text-zinc-950"
                    >
                      <option value={4}>4 Digits</option>
                      <option value={5}>5 Digits</option>
                      <option value={6}>6 Digits</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-zinc-100">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? 'Saving…' : editingBranch ? 'Save Changes' : 'Create Branch'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
