'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DepartmentModal } from './department-modal';
import { UnitModal } from './unit-modal';

interface DepartmentData {
  id: string;
  name: string;
  code?: string | null;
  department_type?: string | null;
  branch_id?: string | null;
  parent_department_id?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

interface UnitData {
  id: string;
  department_id: string;
  parent_unit_id?: string | null;
  unit_type: string;
  name: string;
  code?: string | null;
  branch_id?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

interface BranchData {
  id: string;
  name: string;
}

interface StructureManagementClientProps {
  departments: DepartmentData[];
  units: UnitData[];
  branches: BranchData[];
  canManage: boolean;
}

export function StructureManagementClient({
  departments,
  units,
  branches,
  canManage,
}: StructureManagementClientProps) {
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set(departments.map((d) => d.id)));

  // Modal States
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentData | null>(null);

  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<UnitData | null>(null);
  const [targetDeptIdForUnit, setTargetDeptIdForUnit] = useState<string | undefined>(undefined);

  const toggleDeptExpand = (id: string) => {
    setExpandedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleOpenAddDept = () => {
    setEditingDept(null);
    setIsDeptModalOpen(true);
  };

  const handleOpenEditDept = (dept: DepartmentData) => {
    setEditingDept(dept);
    setIsDeptModalOpen(true);
  };

  const handleOpenAddUnit = (deptId?: string) => {
    setEditingUnit(null);
    setTargetDeptIdForUnit(deptId || departments[0]?.id);
    setIsUnitModalOpen(true);
  };

  const handleOpenEditUnit = (unit: UnitData) => {
    setEditingUnit(unit);
    setTargetDeptIdForUnit(unit.department_id);
    setIsUnitModalOpen(true);
  };

  // Group units by department
  const unitsByDept = new Map<string, UnitData[]>();
  for (const u of units) {
    if (!unitsByDept.has(u.department_id)) {
      unitsByDept.set(u.department_id, []);
    }
    unitsByDept.get(u.department_id)!.push(u);
  }

  // Filter departments
  const filteredDepartments = departments.filter((d) => {
    if (selectedBranchFilter === 'corporate' && d.branch_id !== null) return false;
    if (selectedBranchFilter !== 'all' && selectedBranchFilter !== 'corporate' && d.branch_id !== selectedBranchFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const nameMatch = d.name.toLowerCase().includes(q);
      const codeMatch = d.code?.toLowerCase().includes(q);
      const unitMatch = (unitsByDept.get(d.id) || []).some((u) => u.name.toLowerCase().includes(q));
      return nameMatch || codeMatch || unitMatch;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Structure & Department Units
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Configure organizational departments, divisions, operational sections, and kitchen/dining stations
          </p>
        </div>

        {canManage && (
          <div className="flex items-center space-x-2.5">
            <Button
              onClick={() => handleOpenAddUnit()}
              variant="outline"
              className="text-xs bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-zinc-200"
            >
              + Add Unit / Team
            </Button>
            <Button
              onClick={handleOpenAddDept}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm"
            >
              + Add Department
            </Button>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search departments or operational units..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3.5 py-2 text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="flex items-center space-x-2">
          <select
            value={selectedBranchFilter}
            onChange={(e) => setSelectedBranchFilter(e.target.value)}
            className="rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Scopes (Corporate & Properties)</option>
            <option value="corporate">Corporate / Group-wide Only</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                Property: {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Department Tree / Card List */}
      <div className="space-y-4">
        {filteredDepartments.length === 0 ? (
          <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800 p-8 text-center space-y-3">
            <span className="text-3xl">🏢</span>
            <h3 className="text-sm font-semibold text-zinc-300">No departments found</h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              No organizational departments match your filter criteria. Create a department to structure your workforce.
            </p>
            {canManage && (
              <Button size="sm" onClick={handleOpenAddDept} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs">
                Create First Department
              </Button>
            )}
          </div>
        ) : (
          filteredDepartments.map((dept) => {
            const isExpanded = expandedDepts.has(dept.id);
            const deptUnits = unitsByDept.get(dept.id) || [];
            const branch = branches.find((b) => b.id === dept.branch_id);

            return (
              <div
                key={dept.id}
                className="rounded-2xl bg-zinc-900/50 border border-zinc-800/80 overflow-hidden transition-all"
              >
                {/* Department Header */}
                <div className="p-4 md:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-zinc-900/80 border-b border-zinc-800/60">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => toggleDeptExpand(dept.id)}
                      className="h-7 w-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-xs text-zinc-300 transition-colors"
                      title={isExpanded ? 'Collapse units' : 'Expand units'}
                    >
                      {isExpanded ? '▼' : '▶'}
                    </button>
                    <div>
                      <div className="flex items-center space-x-2.5">
                        <h3 className="text-base font-bold text-zinc-100">{dept.name}</h3>
                        {dept.code && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 font-mono">
                            {dept.code}
                          </span>
                        )}
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                            dept.branch_id
                              ? 'bg-blue-950/80 border border-blue-800/80 text-blue-300'
                              : 'bg-emerald-950/80 border border-emerald-800/80 text-emerald-300'
                          }`}
                        >
                          {dept.branch_id ? `Property: ${branch?.name || 'Assigned'}` : 'Corporate / Group'}
                        </span>
                        {!dept.is_active && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-red-950 text-red-400">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Type: <span className="capitalize">{dept.department_type || 'Operations'}</span> • {deptUnits.length} operational units/stations
                      </p>
                    </div>
                  </div>

                  {canManage && (
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenAddUnit(dept.id)}
                        className="text-xs h-8 bg-zinc-950 border-zinc-800 hover:bg-zinc-800 text-zinc-300"
                      >
                        + Add Section
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenEditDept(dept)}
                        className="text-xs h-8 bg-zinc-950 border-zinc-800 hover:bg-zinc-800 text-zinc-300"
                      >
                        Edit
                      </Button>
                    </div>
                  )}
                </div>

                {/* Sub-Units List */}
                {isExpanded && (
                  <div className="p-4 bg-zinc-950/40 space-y-2">
                    {deptUnits.length === 0 ? (
                      <div className="text-xs text-zinc-500 py-3 text-center">
                        No operational sections or stations configured in this department yet.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {deptUnits.map((u) => (
                          <div
                            key={u.id}
                            className="rounded-xl bg-zinc-900 border border-zinc-800/80 p-3 flex items-center justify-between gap-3 hover:border-zinc-700 transition-all"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center space-x-2">
                                <span className="text-xs font-semibold text-zinc-200">{u.name}</span>
                                {u.code && (
                                  <span className="text-[10px] font-mono text-zinc-500">[{u.code}]</span>
                                )}
                              </div>
                              <div className="text-[11px] text-zinc-400 capitalize">
                                Type: {u.unit_type}
                              </div>
                            </div>

                            {canManage && (
                              <button
                                onClick={() => handleOpenEditUnit(u)}
                                className="text-[11px] text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors"
                              >
                                Edit
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modals */}
      <DepartmentModal
        isOpen={isDeptModalOpen}
        onClose={() => setIsDeptModalOpen(false)}
        onSuccess={() => window.location.reload()}
        initialData={editingDept}
        departments={departments}
        branches={branches}
      />

      <UnitModal
        isOpen={isUnitModalOpen}
        onClose={() => setIsUnitModalOpen(false)}
        onSuccess={() => window.location.reload()}
        initialData={editingUnit}
        departments={departments}
        units={units}
        branches={branches}
        defaultDepartmentId={targetDeptIdForUnit}
      />
    </div>
  );
}
