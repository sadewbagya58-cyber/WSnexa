'use client';

import React, { useState } from 'react';
import { FormattedMemberDetail, FormattedPermission } from '@/types/authorization.types';
import { DiagnosticResultData, diagnoseAccessAction } from '@/server/actions/permission';
import { PermissionPicker } from '@/components/access/permission-picker';
import {
  IconShieldCheck,
  IconShieldAlert,
  IconCircleCheck,
  IconCircleX,
  IconBuildingSkyscraper,
  IconBuildingStore,
  IconUsers,
  IconMapPin,
  IconSparkles,
  IconHelpCircle,
} from './access-icons';

interface AccessDiagnosticsClientProps {
  members: FormattedMemberDetail[];
  catalog: FormattedPermission[];
  branches?: Array<{ id: string; name: string }>;
  departments?: Array<{ id: string; name: string }>;
}

export const AccessDiagnosticsClient: React.FC<AccessDiagnosticsClientProps> = ({
  members,
  catalog,
  branches = [],
  departments = [],
}) => {
  const [selectedMembershipId, setSelectedMembershipId] = useState<string>(members[0]?.id || '');
  const [selectedPermission, setSelectedPermission] = useState<string>(catalog[0]?.key || 'orders.create');
  const [resourceType, setResourceType] = useState<string>('branch');
  const [branchId, setBranchId] = useState<string>(branches[0]?.id || '');
  const [departmentId, setDepartmentId] = useState<string>(departments[0]?.id || '');

  const [isEvaluating, setIsEvaluating] = useState(false);
  const [result, setResult] = useState<DiagnosticResultData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRunDiagnostic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMembershipId || !selectedPermission) return;

    setIsEvaluating(true);
    setErrorMsg(null);

    const res = await diagnoseAccessAction({
      membershipId: selectedMembershipId,
      permission: selectedPermission,
      resourceType,
      branchId: resourceType === 'branch' ? branchId : undefined,
      departmentId: resourceType === 'department' ? departmentId : undefined,
    });

    setIsEvaluating(false);

    if (!res.success || !res.data) {
      setErrorMsg(res.message || 'Diagnostic evaluation failed.');
      setResult(null);
      return;
    }

    setResult(res.data);
  };

  return (
    <div className="space-y-6">
      {/* Explanation Banner */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-2xs space-y-2">
        <div className="flex items-center gap-2">
          <IconSparkles className="w-5 h-5 text-emerald-600" />
          <h2 className="text-sm font-bold text-zinc-900">Policy Engine Access Diagnostics</h2>
        </div>
        <p className="text-xs text-zinc-600 leading-relaxed">
          Test real-time authorization access decisions using the authoritative WSNexa Policy Engine. Select a staff member, a permission capability, and a target resource to evaluate access and inspect exact decision provenance.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Form Column */}
        <div className="lg:col-span-1 bg-white border border-zinc-200 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
            <IconSparkles className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
              Evaluation Parameters
            </h3>
          </div>

          <form onSubmit={handleRunDiagnostic} className="space-y-4">
            {errorMsg && (
              <div className="p-3 text-xs bg-red-50 text-red-700 rounded-xl border border-red-200 font-medium">
                {errorMsg}
              </div>
            )}

            {/* Target Member */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Target Staff Member</label>
              <select
                value={selectedMembershipId}
                onChange={(e) => setSelectedMembershipId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
              >
                {members.map((m) => {
                  const roleDisplay = m.customRoleName || m.role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                  const emailStr = m.userEmail ? ` (${m.userEmail})` : '';
                  return (
                    <option key={m.id} value={m.id}>
                      {m.userName}{emailStr} — {roleDisplay}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Target Permission (Categorized & Searchable) */}
            <PermissionPicker
              catalog={catalog}
              value={selectedPermission}
              onChange={setSelectedPermission}
              label="Permission / Capability"
            />

            {/* Target Resource */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Resource Context (WHERE)</label>
              <select
                value={resourceType}
                onChange={(e) => setResourceType(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-xl focus:outline-none"
              >
                <option value="none">No Specific Resource (General Check)</option>
                <option value="branch">Branch / Property Resource</option>
                <option value="department">Department Resource</option>
              </select>
            </div>

            {resourceType === 'branch' && branches.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Target Property / Branch</label>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-xl focus:outline-none"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}

            {resourceType === 'department' && departments.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Target Department</label>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-xl focus:outline-none"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={isEvaluating}
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 shadow-2xs transition-colors"
            >
              <IconSparkles className="w-4 h-4" />
              {isEvaluating ? 'Evaluating Policy Engine...' : 'Run Access Diagnostic'}
            </button>
          </form>
        </div>

        {/* Results Column */}
        <div className="lg:col-span-2 space-y-4">
          {result ? (
            <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-2xs space-y-6">
              {/* Decision Badge Header */}
              <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
                <div className="flex items-center gap-3">
                  {result.decision.allowed ? (
                    <div className="p-3 bg-emerald-100 text-emerald-800 rounded-2xl shadow-2xs">
                      <IconCircleCheck className="w-7 h-7 text-emerald-600" />
                    </div>
                  ) : (
                    <div className="p-3 bg-red-100 text-red-800 rounded-2xl shadow-2xs">
                      <IconCircleX className="w-7 h-7 text-red-600" />
                    </div>
                  )}

                  <div>
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                      Policy Engine Authorization Result
                    </span>
                    <h3 className={`text-xl font-extrabold ${result.decision.allowed ? 'text-emerald-700' : 'text-red-700'}`}>
                      {result.decision.allowed ? 'ACCESS ALLOWED' : 'ACCESS DENIED'}
                    </h3>
                  </div>
                </div>

                <div className="text-right">
                  <span className="block text-[10px] font-mono text-zinc-400">Evaluation Speed</span>
                  <span className="text-xs font-mono font-bold text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded">
                    {result.decision.diagnostics?.evaluationDurationMs || 0} ms
                  </span>
                </div>
              </div>

              {/* Natural Language Explanation Box */}
              <div className={`p-4 rounded-xl border text-xs font-medium leading-relaxed ${
                result.decision.allowed
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                  : 'bg-red-50/70 border-red-200 text-red-950'
              }`}>
                <span className="font-bold block mb-1">Diagnostic Explanation:</span>
                {result.explanation}
              </div>

              {/* Provenance Metadata Table */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200">
                  <span className="block text-[10px] text-zinc-400 font-medium uppercase">Staff Member</span>
                  <span className="font-semibold text-zinc-900">{result.memberName}</span>
                  <span className="block text-[11px] text-zinc-500">
                    {(result.memberCustomRoleName || result.memberRole).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </span>
                </div>

                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200">
                  <span className="block text-[10px] text-zinc-400 font-medium uppercase">Permission Tested</span>
                  <span className="font-mono font-semibold text-zinc-900 break-all">{selectedPermission}</span>
                </div>

                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200">
                  <span className="block text-[10px] text-zinc-400 font-medium uppercase">How Was It Decided?</span>
                  <span className="font-semibold text-zinc-800 capitalize">
                    {result.decision.source ? result.decision.source.replace(/_/g, ' ') : 'Default deny'}
                  </span>
                  <span className="block text-[10px] text-zinc-400 font-mono mt-0.5">{result.decision.reason}</span>
                </div>

                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200">
                  <span className="block text-[10px] text-zinc-400 font-medium uppercase">Location Scope Matched</span>
                  <span className="font-mono font-semibold text-zinc-900">{result.decision.matchedScope || 'None'}</span>
                </div>

                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 sm:col-span-2">
                  <span className="block text-[10px] text-zinc-400 font-medium uppercase">Evaluated At</span>
                  <span className="font-mono text-zinc-700 text-[11px]">
                    {result.decision.diagnostics?.evaluatedAt ? new Date(result.decision.diagnostics.evaluatedAt).toLocaleTimeString() : 'Just now'}
                    {' · '}{result.decision.diagnostics?.evaluationDurationMs || 0} ms
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-zinc-50 border border-dashed border-zinc-200 rounded-2xl p-12 text-center text-zinc-400 space-y-2">
              <IconHelpCircle className="w-10 h-10 mx-auto text-zinc-300" />
              <h4 className="text-sm font-bold text-zinc-700">No Diagnostic Run Executed Yet</h4>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                Select a member and permission on the left form, then click &quot;Run Access Diagnostic&quot; to inspect authorization evaluation.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
