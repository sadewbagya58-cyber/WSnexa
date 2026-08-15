import React from 'react';
import { SuperAdminService } from '@/server/services/super-admin.service';
import { AdminPilotClient } from './admin-pilot-client';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Pilot & Demo Venues — Super Admin | WSNexa',
  description: 'Manage onboarding pilots, partner demonstration templates, and sandbox environments.',
};

export default async function AdminPilotPage() {
  const pilots = await SuperAdminService.listPilotVenues();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="neutral" className="bg-purple-100 text-purple-900 border-purple-300 font-extrabold text-[10px] uppercase">
              Partner Sandbox
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight mt-1">
            Pilot & Demo Venue Management
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-zinc-500 mt-0.5">
            Safely provision and verify pre-populated demonstration environments with sample digital menus, tables, and QR codes.
          </p>
        </div>
      </div>

      <AdminPilotClient initialPilots={pilots} />
    </div>
  );
}
