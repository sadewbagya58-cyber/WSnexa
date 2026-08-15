import React from 'react';
import { SuperAdminService } from '@/server/services/super-admin.service';
import { AdminAuditClient } from './admin-audit-client';
import { Badge } from '@/components/ui/badge';

export const metadata = {
  title: 'Platform Audit Log — Super Admin | WSNexa',
  description: 'Immutable record of security-sensitive administrative operations and platform state mutations.',
};

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; targetType?: string; page?: string }>;
}) {
  const resolvedParams = await searchParams;
  const page = parseInt(resolvedParams.page || '1', 10) || 1;

  const { logs, total, totalPages } = await SuperAdminService.listAuditLogs({
    action: resolvedParams.action,
    targetType: resolvedParams.targetType,
    page,
    limit: 25,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="neutral" className="bg-amber-100 text-amber-900 border-amber-300 font-extrabold text-[10px] uppercase">
              Security & Compliance
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight mt-1">
            Platform Audit Log Explorer
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-zinc-500 mt-0.5">
            Immutable tracking of publication changes, privilege modifications, venue suspensions, and security events.
          </p>
        </div>
      </div>

      <AdminAuditClient
        logs={logs}
        total={total}
        page={page}
        totalPages={totalPages}
        currentAction={resolvedParams.action || ''}
        currentTargetType={resolvedParams.targetType || 'all'}
      />
    </div>
  );
}
