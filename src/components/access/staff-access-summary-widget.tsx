'use client';

import React from 'react';
import Link from 'next/link';
import { EffectiveAccessPreview } from '@/types/authorization.types';
import { IconShieldCheck, IconZap, IconShieldAlert, IconArrowRight, IconEye } from './access-icons';

interface StaffAccessSummaryWidgetProps {
  preview: EffectiveAccessPreview;
}

export const StaffAccessSummaryWidget: React.FC<StaffAccessSummaryWidgetProps> = ({ preview }) => {
  const overridesCount = (preview.scopedOverrides || preview.overrides || []).length;
  const actingCount = preview.temporaryAuthority?.actingAssignments?.length || 0;
  const secondmentsCount = preview.temporaryAuthority?.secondmentAssignments?.length || 0;

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-2xs space-y-3">
      <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5">
        <div className="flex items-center gap-2">
          <IconShieldCheck className="w-4 h-4 text-emerald-600" />
          <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
            RBAC V2 Access Summary
          </h3>
        </div>

        <Link
          href={`/dashboard/access/members/${preview.membershipId}`}
          className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 hover:underline"
        >
          <IconEye className="w-3.5 h-3.5" /> Full Access Profile <IconArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="p-2.5 bg-zinc-50 rounded-xl border border-zinc-200">
          <span className="block text-[10px] font-semibold text-zinc-400 uppercase">Active Role</span>
          <span className="font-bold text-zinc-900 capitalize">{preview.customRoleName || preview.role}</span>
        </div>

        <div className="p-2.5 bg-zinc-50 rounded-xl border border-zinc-200">
          <span className="block text-[10px] font-semibold text-zinc-400 uppercase">Default Scope</span>
          <span className="font-mono font-semibold text-zinc-900">{preview.preset?.defaultScope || preview.defaultScope || 'PROPERTY'}</span>
        </div>

        <div className="p-2.5 bg-zinc-50 rounded-xl border border-zinc-200">
          <span className="block text-[10px] font-semibold text-zinc-400 uppercase">Overrides</span>
          <span className={`font-mono font-bold ${overridesCount > 0 ? 'text-amber-700' : 'text-zinc-700'}`}>
            {overridesCount} set
          </span>
        </div>

        <div className="p-2.5 bg-zinc-50 rounded-xl border border-zinc-200">
          <span className="block text-[10px] font-semibold text-zinc-400 uppercase">Temp Reach</span>
          <span className={`font-mono font-bold ${actingCount + secondmentsCount > 0 ? 'text-amber-700' : 'text-zinc-700'}`}>
            {actingCount + secondmentsCount} active
          </span>
        </div>
      </div>
    </div>
  );
};
