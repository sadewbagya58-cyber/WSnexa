'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { JobTitleModal } from './job-title-modal';

export interface HierarchyLevelData {
  id: string;
  name: string;
  rank: number;
  is_management: boolean;
  code?: string | null;
}

export interface JobTitleData {
  id: string;
  name: string;
  code?: string | null;
  hierarchy_level_id: string;
  department_type?: string | null;
  description?: string | null;
  is_management?: boolean;
  is_active?: boolean;
  hierarchy_level?: HierarchyLevelData | null;
}

export interface JobTitlesClientProps {
  hierarchyLevels: HierarchyLevelData[];
  jobTitles: JobTitleData[];
  canManage: boolean;
}

export function JobTitlesClient({
  hierarchyLevels,
  jobTitles,
  canManage,
}: JobTitlesClientProps) {
  const [selectedRankFilter, setSelectedRankFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState<JobTitleData | null>(null);

  const handleOpenAdd = () => {
    setEditingTitle(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (jt: JobTitleData) => {
    setEditingTitle(jt);
    setIsModalOpen(true);
  };

  // Group job titles by hierarchy rank
  const filteredTitles = jobTitles.filter((jt) => {
    if (selectedRankFilter !== 'all' && jt.hierarchy_level_id !== selectedRankFilter) {
      return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const nameMatch = jt.name.toLowerCase().includes(q);
      const codeMatch = jt.code?.toLowerCase().includes(q);
      const descMatch = jt.description?.toLowerCase().includes(q);
      return nameMatch || codeMatch || descMatch;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Job Titles & Seniority Tiers
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Standardized organizational roles mapped to 8 authoritative seniority ranks
          </p>
        </div>

        {canManage && (
          <Button
            onClick={handleOpenAdd}
            className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm"
          >
            + Add Job Title
          </Button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search job titles by title, code, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3.5 py-2 text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div>
          <select
            value={selectedRankFilter}
            onChange={(e) => setSelectedRankFilter(e.target.value)}
            className="rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Seniority Ranks (Rank 1–8)</option>
            {hierarchyLevels.map((lvl) => (
              <option key={lvl.id} value={lvl.id}>
                Rank {lvl.rank}: {lvl.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Hierarchy Levels Overview Chips */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
        {hierarchyLevels.map((lvl) => {
          const count = jobTitles.filter((jt) => jt.hierarchy_level_id === lvl.id).length;
          return (
            <div
              key={lvl.id}
              onClick={() => setSelectedRankFilter(selectedRankFilter === lvl.id ? 'all' : lvl.id)}
              className={`rounded-xl border p-2.5 cursor-pointer transition-all ${
                selectedRankFilter === lvl.id
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                  : 'border-zinc-800/80 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <div className="text-[10px] font-mono font-bold uppercase text-zinc-500">Rank {lvl.rank}</div>
              <div className="text-xs font-semibold text-zinc-200 truncate mt-0.5">{lvl.name}</div>
              <div className="text-[10px] text-zinc-500 mt-1">{count} titles</div>
            </div>
          );
        })}
      </div>

      {/* Job Titles Table / Card Grid */}
      <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/80 overflow-hidden">
        {filteredTitles.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <span className="text-3xl">🎖️</span>
            <div className="text-sm font-semibold text-zinc-300">No job titles found</div>
            <div className="text-xs text-zinc-500">No titles match the selected rank or search terms.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-900 border-b border-zinc-800 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Job Title & Code</th>
                  <th className="py-3 px-4">Seniority Level</th>
                  <th className="py-3 px-4">Department Scope</th>
                  <th className="py-3 px-4">Classification</th>
                  <th className="py-3 px-4">Status</th>
                  {canManage && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filteredTitles.map((jt) => {
                  const lvl = jt.hierarchy_level || hierarchyLevels.find((l) => l.id === jt.hierarchy_level_id);
                  return (
                    <tr key={jt.id} className="hover:bg-zinc-850/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-zinc-100">{jt.name}</div>
                        {jt.code && <div className="text-[10px] font-mono text-zinc-500 mt-0.5">{jt.code}</div>}
                        {jt.description && (
                          <div className="text-[11px] text-zinc-400 mt-1 max-w-md line-clamp-1">{jt.description}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-800 border border-zinc-700 text-zinc-200">
                          Rank {lvl?.rank ?? '?'}: {lvl?.name || 'Unassigned'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 capitalize text-zinc-400 whitespace-nowrap">
                        {jt.department_type || 'Operations'}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {jt.is_management ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-950/80 border border-purple-800 text-purple-300">
                            Management Tier
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-800 text-zinc-400">
                            Operational
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {jt.is_active ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-400">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-800 text-zinc-500">
                            Archived
                          </span>
                        )}
                      </td>
                      {canManage && (
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenEdit(jt)}
                            className="text-xs h-7 bg-zinc-950 border-zinc-800 hover:bg-zinc-800 text-zinc-300"
                          >
                            Edit
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <JobTitleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => window.location.reload()}
        initialData={editingTitle}
        hierarchyLevels={hierarchyLevels}
      />
    </div>
  );
}
