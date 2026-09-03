'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PositionModal } from './position-modal';

export interface PositionRow {
  id: string;
  job_title_id: string;
  branch_id?: string | null;
  department_id?: string | null;
  unit_id?: string | null;
  position_code?: string | null;
  name_override?: string | null;
  headcount_limit: number;
  status: 'active' | 'frozen' | 'archived';
  is_active?: boolean;
  occupiedCount: number;
  availableSlots: number;
  isFull: boolean;
  coverageState: 'vacant' | 'occupied' | 'acting_covered' | 'over_capacity' | 'frozen' | 'archived';
  job_title?: {
    name: string;
    code?: string | null;
    is_management?: boolean;
    hierarchy_level?: { name: string; rank: number } | null;
  };
  department?: { name: string; code?: string | null } | null;
  unit?: { name: string; code?: string | null } | null;
  branch?: { name: string; code?: string | null } | null;
  substantiveOccupants?: Array<{
    id: string;
    membership?: {
      id: string;
      user_profiles?: { first_name?: string; last_name?: string } | Array<{ first_name?: string; last_name?: string }>;
    };
  }>;
  actingCoverage?: Array<{
    id: string;
    membership?: {
      id: string;
      user_profiles?: { first_name?: string; last_name?: string } | Array<{ first_name?: string; last_name?: string }>;
    };
  }>;
  secondmentAssignments?: Array<{
    id: string;
    membership?: {
      id: string;
      user_profiles?: { first_name?: string; last_name?: string } | Array<{ first_name?: string; last_name?: string }>;
    };
  }>;
  temporaryAssignments?: Array<{
    id: string;
    membership?: {
      id: string;
      user_profiles?: { first_name?: string; last_name?: string } | Array<{ first_name?: string; last_name?: string }>;
    };
  }>;
}

interface PositionsClientProps {
  positions: PositionRow[];
  jobTitles: Array<{ id: string; name: string; is_management: boolean }>;
  branches: Array<{ id: string; name: string }>;
  departments: Array<{ id: string; name: string; branch_id?: string | null }>;
  units: Array<{ id: string; name: string; department_id: string; branch_id?: string | null }>;
  canManage: boolean;
  activeBranchId?: string | null;
}

export function PositionsClient({
  positions,
  jobTitles,
  branches,
  departments,
  units,
  canManage,
  activeBranchId,
}: PositionsClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>(
    activeBranchId ?? 'all'
  );
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all');
  const [selectedStateFilter, setSelectedStateFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<PositionRow | null>(null);

  const handleOpenAdd = () => {
    setEditingPosition(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (pos: PositionRow) => {
    setEditingPosition(pos);
    setIsModalOpen(true);
  };

  const filteredPositions = positions.filter((pos) => {
    if (selectedBranchFilter === 'corporate' && pos.branch_id !== null) return false;
    if (selectedBranchFilter !== 'all' && selectedBranchFilter !== 'corporate' && pos.branch_id !== selectedBranchFilter) return false;
    if (selectedDeptFilter !== 'all' && pos.department_id !== selectedDeptFilter) return false;
    if (selectedStateFilter !== 'all') {
      if (selectedStateFilter === 'vacant' && pos.occupiedCount >= pos.headcount_limit) return false;
      if (selectedStateFilter === 'occupied' && pos.occupiedCount === 0) return false;
      if (selectedStateFilter === 'acting' && (pos.actingCoverage?.length || 0) === 0) return false;
      if (selectedStateFilter === 'over' && pos.occupiedCount <= pos.headcount_limit) return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const codeMatch = pos.position_code?.toLowerCase().includes(q);
      const nameMatch = pos.name_override?.toLowerCase().includes(q);
      const titleMatch = pos.job_title?.name.toLowerCase().includes(q);
      return codeMatch || nameMatch || titleMatch;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">
            Position Slots & Headcount Capacity
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Authoritative establishment slots, substantive occupancy, and acting coverage distinction
          </p>
        </div>

        {canManage && (
          <Button
            onClick={handleOpenAdd}
            className="text-xs bg-zinc-900 hover:bg-zinc-800 text-white font-medium shadow-sm min-h-[38px] touch-manipulation"
          >
            + Create Position Slot
          </Button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <input
            type="text"
            placeholder="Search code, title, or name override..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl bg-white border border-zinc-200 px-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 min-h-[40px]"
          />
        </div>
        <div>
          <select
            value={selectedBranchFilter}
            onChange={(e) => setSelectedBranchFilter(e.target.value)}
            className="w-full rounded-xl bg-white border border-zinc-200 px-3 py-2.5 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 min-h-[40px]"
          >
            <option value="all">All Properties & Corporate</option>
            <option value="corporate">Corporate Only (branch_id = NULL)</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                Property: {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <select
            value={selectedDeptFilter}
            onChange={(e) => setSelectedDeptFilter(e.target.value)}
            className="w-full rounded-xl bg-white border border-zinc-200 px-3 py-2.5 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 min-h-[40px]"
          >
            <option value="all">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <select
            value={selectedStateFilter}
            onChange={(e) => setSelectedStateFilter(e.target.value)}
            className="w-full rounded-xl bg-white border border-zinc-200 px-3 py-2.5 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 min-h-[40px]"
          >
            <option value="all">All Occupancy States</option>
            <option value="vacant">Vacant Slots</option>
            <option value="occupied">Occupied Slots</option>
            <option value="acting">With Acting Coverage</option>
            <option value="over">Over Capacity</option>
          </select>
        </div>
      </div>

      {/* Position Cards / Table */}
      <div className="rounded-2xl bg-white border border-zinc-200 overflow-hidden shadow-sm">
        {filteredPositions.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <span className="text-3xl select-none">🪑</span>
            <div className="text-sm font-bold text-zinc-900">No positions found</div>
            <div className="text-xs text-zinc-500 max-w-sm mx-auto">No position establishment slots match your filters.</div>
          </div>
        ) : (
          <>
            {/* ========================================================= */}
            {/* MOBILE VIEW: Responsive Position Cards (md:hidden)       */}
            {/* ========================================================= */}
            <div className="block md:hidden p-3 space-y-3.5 divide-y divide-zinc-100">
              {filteredPositions.map((pos) => {
                const occupants = pos.substantiveOccupants || [];
                const actingCovers = pos.actingCoverage || [];
                const secondments = pos.secondmentAssignments || [];

                return (
                  <div key={pos.id} className="pt-3.5 first:pt-0 space-y-3">
                    {/* Position Header & Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-0.5">
                        <div className="font-bold text-sm text-zinc-950 break-words">
                          {pos.name_override || pos.job_title?.name || 'Position Slot'}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-zinc-500">
                          {pos.position_code && (
                            <span className="px-1.5 py-0.5 rounded bg-zinc-100 font-bold text-zinc-700 border border-zinc-200">
                              {pos.position_code}
                            </span>
                          )}
                          <span>Job: {pos.job_title?.name}</span>
                          {pos.job_title?.hierarchy_level && (
                            <span>• Rank {pos.job_title.hierarchy_level.rank}</span>
                          )}
                        </div>
                      </div>

                      {/* Coverage / Occupancy Badge */}
                      <div className="shrink-0 text-right">
                        {actingCovers.length > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 border border-purple-200 text-purple-700">
                            Acting: {actingCovers.map((act) => {
                              const prof = act.membership?.user_profiles;
                              const p = Array.isArray(prof) ? prof[0] : prof;
                              return `${p?.first_name || ''} ${p?.last_name || ''}`.trim() || 'Lead';
                            }).join(', ')}
                          </span>
                        ) : pos.occupiedCount > pos.headcount_limit ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-50 border border-red-200 text-red-700">
                            Over-capacity
                          </span>
                        ) : pos.status === 'frozen' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-zinc-100 text-zinc-600">
                            Frozen
                          </span>
                        ) : pos.isFull ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            ● Filled
                          </span>
                        ) : pos.occupiedCount > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 border border-amber-200 text-amber-800">
                            Partially Filled
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 border border-blue-200 text-blue-700">
                            Vacant ({pos.availableSlots} free)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Position Location & Occupants Details */}
                    <div className="bg-zinc-50/70 rounded-xl p-3 space-y-2 text-xs border border-zinc-100">
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-zinc-400 block text-[10px] font-medium uppercase tracking-wider">Property</span>
                          <span className="font-semibold text-zinc-900 break-words">
                            📍 {pos.branch?.name || 'Corporate / Head Office'}
                          </span>
                        </div>
                        <div>
                          <span className="text-zinc-400 block text-[10px] font-medium uppercase tracking-wider">Department</span>
                          <span className="font-semibold text-zinc-900 break-words">
                            🏢 {pos.department?.name || <span className="text-zinc-400 italic">None</span>}
                            {pos.unit?.name ? ` • ${pos.unit.name}` : ''}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] pt-1.5 border-t border-zinc-200/60">
                        <div>
                          <span className="text-zinc-400 block text-[10px] font-medium uppercase tracking-wider">Headcount Capacity</span>
                          <span className="font-mono font-bold text-zinc-900">
                            👥 {pos.occupiedCount} / {pos.headcount_limit}{' '}
                            <span className="text-[10px] text-zinc-500 font-normal">
                              ({pos.isFull ? 'Filled' : `${pos.availableSlots} available`})
                            </span>
                          </span>
                        </div>
                        <div>
                          <span className="text-zinc-400 block text-[10px] font-medium uppercase tracking-wider">Substantive Occupant(s)</span>
                          {occupants.length === 0 ? (
                            <span className="text-zinc-400 italic">No permanent occupant</span>
                          ) : (
                            <div className="space-y-0.5 font-medium text-zinc-900">
                              {occupants.map((occ, i) => {
                                const prof = occ.membership?.user_profiles;
                                const p = Array.isArray(prof) ? prof[0] : prof;
                                const name = `${p?.first_name || ''} ${p?.last_name || ''}`.trim() || 'Member';
                                return <div key={i}>👤 {name}</div>;
                              })}
                            </div>
                          )}
                          {secondments.length > 0 && (
                            <div className="mt-1 pt-1 border-t border-zinc-200/60 text-[10px] text-blue-800 font-medium space-y-0.5">
                              {secondments.map((sec, i) => {
                                const prof = sec.membership?.user_profiles;
                                const p = Array.isArray(prof) ? prof[0] : prof;
                                const name = `${p?.first_name || ''} ${p?.last_name || ''}`.trim() || 'Member';
                                return <div key={i}>✈️ Seconded: {name}</div>;
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons (min-h-[44px] touch targets) */}
                    {canManage && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {pos.availableSlots > 0 && pos.status === 'active' && (
                          <>
                            <button
                              type="button"
                              onClick={() => router.push(`/dashboard/access/invites?positionId=${pos.id}`)}
                              className="min-h-[44px] flex-1 px-3 py-2 text-xs font-bold rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 active:scale-98 transition-all flex items-center justify-center gap-1.5 touch-manipulation"
                            >
                              + Invite
                            </button>
                            <button
                              type="button"
                              onClick={() => router.push(`/dashboard/people?assignPositionId=${pos.id}`)}
                              className="min-h-[44px] flex-1 px-3 py-2 text-xs font-bold rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 active:scale-98 transition-all flex items-center justify-center gap-1.5 touch-manipulation"
                            >
                              Assign
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(pos)}
                          className="min-h-[44px] flex-1 px-3 py-2 text-xs font-bold rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-200 active:scale-98 transition-all flex items-center justify-center gap-1.5 touch-manipulation"
                        >
                          ✏️ Edit Slot
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ========================================================= */}
            {/* DESKTOP VIEW: Data Table (hidden md:block)                */}
            {/* ========================================================= */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-700">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Position / Job Title</th>
                    <th className="py-3 px-4">Branch & Department</th>
                    <th className="py-3 px-4">Headcount Occupancy</th>
                    <th className="py-3 px-4">Substantive Occupants</th>
                    <th className="py-3 px-4">Coverage Status</th>
                    {canManage && <th className="py-3 px-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredPositions.map((pos) => {
                    const occupants = pos.substantiveOccupants || [];
                    const actingCovers = pos.actingCoverage || [];
                    const secondments = pos.secondmentAssignments || [];

                    return (
                      <tr key={pos.id} className="hover:bg-zinc-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-zinc-900">
                            {pos.name_override || pos.job_title?.name || 'Position Slot'}
                          </div>
                          <div className="flex items-center space-x-2 text-[10px] font-mono text-zinc-400 mt-0.5">
                            {pos.position_code && <span>[{pos.position_code}]</span>}
                            <span>Job: {pos.job_title?.name}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="text-zinc-900 font-medium">{pos.branch?.name || 'Corporate'}</div>
                          <div className="text-[11px] text-zinc-500">
                            {pos.department?.name || 'None'} {pos.unit?.name ? `• ${pos.unit.name}` : ''}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <span
                              className={`font-mono font-bold ${
                                pos.occupiedCount > pos.headcount_limit
                                  ? 'text-red-600'
                                  : pos.isFull
                                  ? 'text-zinc-900'
                                  : 'text-zinc-700'
                              }`}
                            >
                              {pos.occupiedCount} / {pos.headcount_limit}
                            </span>
                            <span className="text-[10px] text-zinc-400">
                              {pos.isFull ? '(Filled)' : `(${pos.availableSlots} free)`}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {occupants.length === 0 ? (
                            <span className="text-zinc-400 italic">No permanent occupant</span>
                          ) : (
                            <div className="space-y-1">
                              {occupants.map((occ, i) => {
                                const prof = occ.membership?.user_profiles;
                                const p = Array.isArray(prof) ? prof[0] : prof;
                                const name = `${p?.first_name || ''} ${p?.last_name || ''}`.trim() || 'Member';
                                return (
                                  <div key={i} className="text-zinc-900 font-medium">
                                    {name}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {secondments.length > 0 && (
                            <div className="mt-1 pt-1 border-t border-zinc-100 text-[10px] text-blue-800 font-medium space-y-0.5">
                              {secondments.map((sec, i) => {
                                const prof = sec.membership?.user_profiles;
                                const p = Array.isArray(prof) ? prof[0] : prof;
                                const name = `${p?.first_name || ''} ${p?.last_name || ''}`.trim() || 'Member';
                                return <div key={i}>✈️ Seconded: {name}</div>;
                              })}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {actingCovers.length > 0 ? (
                            <div className="space-y-1">
                              {actingCovers.map((act, i) => {
                                const prof = act.membership?.user_profiles;
                                const p = Array.isArray(prof) ? prof[0] : prof;
                                const name = `${p?.first_name || ''} ${p?.last_name || ''}`.trim() || 'Acting Lead';
                                return (
                                  <span
                                    key={i}
                                    className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-50 border border-purple-200 text-purple-700"
                                  >
                                    Acting: {name}
                                  </span>
                                );
                              })}
                            </div>
                          ) : pos.occupiedCount > pos.headcount_limit ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-red-50 border border-red-200 text-red-700">
                              Over-capacity
                            </span>
                          ) : pos.status === 'frozen' ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-zinc-100 text-zinc-500">
                              Frozen
                            </span>
                          ) : pos.isFull ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-100 text-zinc-800">
                              Substantively Filled
                            </span>
                          ) : pos.occupiedCount > 0 ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 border border-amber-200 text-amber-800">
                              Partially Filled ({pos.occupiedCount}/{pos.headcount_limit})
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-zinc-50 border border-zinc-200 text-zinc-600">
                              Vacant ({pos.availableSlots} {pos.availableSlots === 1 ? 'slot' : 'slots'})
                            </span>
                          )}
                        </td>
                        {canManage && (
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {pos.availableSlots > 0 && pos.status === 'active' && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => router.push(`/dashboard/access/invites?positionId=${pos.id}`)}
                                    className="text-[11px] h-7 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 text-emerald-800 font-semibold"
                                  >
                                    + Invite
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => router.push(`/dashboard/people?assignPositionId=${pos.id}`)}
                                    className="text-[11px] h-7 bg-blue-50 border-blue-200 hover:bg-blue-100 text-blue-800 font-semibold"
                                  >
                                    Assign
                                  </Button>
                                </>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenEdit(pos)}
                                className="text-xs h-7 bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-900 font-medium"
                              >
                                Edit
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <PositionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => startTransition(() => router.refresh())}
        initialData={editingPosition}
        jobTitles={jobTitles}
        branches={branches}
        departments={departments}
        units={units}
        activeBranchId={activeBranchId}
      />
    </div>
  );
}
