'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
  const [, startTransition] = useTransition();

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
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Job Titles & Seniority Tiers
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Standardized organizational roles mapped to 8 authoritative seniority ranks
          </p>
        </div>

        {canManage && (
          <Button
            onClick={handleOpenAdd}
            className="text-xs bg-zinc-900 hover:bg-zinc-800 text-white font-medium shadow-sm"
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
            className="w-full rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
        </div>
        <div>
          <select
            value={selectedRankFilter}
            onChange={(e) => setSelectedRankFilter(e.target.value)}
            className="rounded-lg bg-white border border-zinc-200 px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
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
          const isSelected = selectedRankFilter === lvl.id;
          return (
            <div
              key={lvl.id}
              onClick={() => setSelectedRankFilter(isSelected ? 'all' : lvl.id)}
              className={`rounded-lg border p-3 cursor-pointer transition-all shadow-xs ${
                isSelected
                  ? 'border-zinc-900 bg-zinc-900 text-white'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
              }`}
            >
              <div className={`text-[10px] font-mono font-bold uppercase ${isSelected ? 'text-zinc-300' : 'text-zinc-400'}`}>
                Rank {lvl.rank}
              </div>
              <div className={`text-xs font-semibold truncate mt-0.5 ${isSelected ? 'text-white' : 'text-zinc-900'}`}>
                {lvl.name}
              </div>
              <div className={`text-[10px] mt-1 font-medium ${isSelected ? 'text-zinc-300' : 'text-zinc-500'}`}>
                {count} titles
              </div>
            </div>
          );
        })}
      </div>

      {/* Job Titles Table / Card Grid */}
      <div className="rounded-xl bg-white border border-zinc-200 overflow-hidden shadow-sm">
        {filteredTitles.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <span className="text-3xl">🎖️</span>
            <div className="text-sm font-semibold text-zinc-900">No job titles found</div>
            <div className="text-xs text-zinc-500">No titles match the selected rank or search terms.</div>
          </div>
        ) : (
          <>
            {/* Desktop Table Layout (md+) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-700">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Job Title & Code</th>
                    <th className="py-3 px-4">Seniority Level</th>
                    <th className="py-3 px-4">Department Scope</th>
                    <th className="py-3 px-4">Classification</th>
                    <th className="py-3 px-4">Status</th>
                    {canManage && <th className="py-3 px-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredTitles.map((jt) => {
                    const lvl = jt.hierarchy_level || hierarchyLevels.find((l) => l.id === jt.hierarchy_level_id);
                    return (
                      <tr key={jt.id} className="hover:bg-zinc-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-zinc-900">{jt.name}</div>
                          {jt.code && <div className="text-[10px] font-mono text-zinc-400 mt-0.5">[{jt.code}]</div>}
                          {jt.description && (
                            <div className="text-[11px] text-zinc-500 mt-1 max-w-md line-clamp-1">{jt.description}</div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-100 border border-zinc-200 text-zinc-800">
                            Rank {lvl?.rank ?? '?'}: {lvl?.name || 'Unassigned'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 capitalize text-zinc-600 whitespace-nowrap">
                          {jt.department_type || 'Operations'}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {jt.is_management ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 border border-zinc-300 text-zinc-900">
                              Management Tier
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-50 border border-zinc-200 text-zinc-600">
                              Operational
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {jt.is_active ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 text-zinc-800">
                              Active
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-50 text-zinc-400">
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
                              className="text-xs h-7 bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-900 font-medium"
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

            {/* Mobile Responsive Stacked Card List (< md) */}
            <div className="block md:hidden divide-y divide-zinc-200">
              {filteredTitles.map((jt) => {
                const lvl = jt.hierarchy_level || hierarchyLevels.find((l) => l.id === jt.hierarchy_level_id);
                return (
                  <div key={jt.id} className="p-4 space-y-3 bg-white">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-sm text-zinc-900 leading-snug break-words">
                          {jt.name}
                        </div>
                        {jt.code && (
                          <div className="text-[11px] font-mono text-zinc-500 mt-0.5">
                            [{jt.code}]
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {jt.is_active ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 border border-zinc-200 text-zinc-500">
                            Archived
                          </span>
                        )}
                      </div>
                    </div>

                    {jt.description && (
                      <p className="text-xs text-zinc-600 line-clamp-2 leading-relaxed">
                        {jt.description}
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-100 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block">
                          Seniority Level
                        </span>
                        <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-100 border border-zinc-200 text-zinc-800">
                          Rank {lvl?.rank ?? '?'}: {lvl?.name || 'Unassigned'}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block">
                          Department Scope
                        </span>
                        <span className="capitalize font-medium text-zinc-700 mt-1 block">
                          {jt.department_type || 'Operations'}
                        </span>
                      </div>

                      <div className="col-span-2">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block">
                          Classification
                        </span>
                        <span className="mt-1 inline-block">
                          {jt.is_management ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 border border-zinc-300 text-zinc-900">
                              Management Tier
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-50 border border-zinc-200 text-zinc-600">
                              Operational
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    {canManage && (
                      <div className="pt-2 flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenEdit(jt)}
                          className="text-xs h-9 min-h-[36px] px-4 bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-900 font-semibold w-full"
                        >
                          Edit Job Title
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <JobTitleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => startTransition(() => router.refresh())}
        initialData={editingTitle}
        hierarchyLevels={hierarchyLevels}
      />
    </div>
  );
}
