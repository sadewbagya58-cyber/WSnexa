import React from 'react';
import { LaunchReadinessService } from '@/server/services/launch-readiness.service';
import { AdminSystemClient } from './admin-system-client';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'System Health & Diagnostics — Super Admin | WSNexa',
  description: 'Real-time platform infrastructure diagnostics, database latency, and security contracts.',
};

export default async function AdminSystemPage() {
  const initialReport = await LaunchReadinessService.getHealthReport();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="neutral" className="bg-amber-100 text-amber-900 border-amber-300 font-extrabold text-[10px] uppercase">
              Infrastructure & Diagnostics
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight mt-1">
            Platform System Health
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-zinc-500 mt-0.5">
            Monitor real-time PostgreSQL database latency, environment security masking, and storage bucket availability.
          </p>
        </div>
      </div>

      <AdminSystemClient initialReport={initialReport} />
    </div>
  );
}
