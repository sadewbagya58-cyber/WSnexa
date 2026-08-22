'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AreaManager } from '@/components/table/area-manager';
import { TableGrid } from '@/components/table/table-grid';
import { BranchQrManager } from '@/components/qr/branch-qr-manager';
import { ContextualHelpButton } from '@/components/help/contextual-help-button';

interface WorkspaceServiceArea {
  id: string;
  name: string;
  code: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  tables_count?: number;
}

interface WorkspaceDiningTable {
  id: string;
  name: string;
  code: string;
  table_number: number | null;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved' | 'cleaning' | 'unavailable';
  shape: string | null;
  service_area_id: string | null;
  is_active: boolean;
  table_pin_hash?: string | null;
  table_pin_updated_at?: string | null;
}

interface WorkspaceBranchQr {
  id: string;
  version: number;
  token_prefix: string | null;
  rawToken: string | null;
  is_active: boolean;
  generated_at: string;
}

interface DiningSetupWorkspaceProps {
  businessName: string;
  branchName: string;
  branchCode: string;
  canManage?: boolean;
  serviceAreas: WorkspaceServiceArea[];
  tables: WorkspaceDiningTable[];
  branchQr: WorkspaceBranchQr | null;
  requireTableSelection: boolean;
  requireTablePin: boolean;
  tablePinLength: number;
  tablesSummary: { total: number; withPin: number; missingPin: number };
}

export function DiningSetupWorkspace({
  businessName,
  branchName,
  branchCode,
  canManage = true,
  serviceAreas,
  tables,
  branchQr,
  requireTableSelection,
  requireTablePin,
  tablePinLength,
  tablesSummary,
}: DiningSetupWorkspaceProps) {
  const [activeStep, setActiveStep] = useState<'areas' | 'tables' | 'qr'>('areas');

  const mappedAreas = serviceAreas.map((a) => ({
    id: a.id,
    name: a.name,
    code: a.code,
    description: a.description,
    display_order: a.display_order,
    is_active: a.is_active,
  }));

  const mappedTables = tables.map((t) => {
    const areaMatch = serviceAreas.find((sa) => sa.id === t.service_area_id);
    return {
      id: t.id,
      name: t.name,
      code: t.code,
      table_number: t.table_number,
      capacity: t.capacity,
      status: t.status,
      shape: t.shape,
      is_active: t.is_active,
      table_pin_hash: t.table_pin_hash || null,
      table_pin_updated_at: t.table_pin_updated_at || null,
      service_area_id: t.service_area_id || '',
      service_areas: areaMatch ? { name: areaMatch.name, code: areaMatch.code } : null,
    };
  });

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b border-zinc-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-zinc-950 uppercase tracking-wider">Dining Setup Workspace</h1>
            <Badge variant="neutral" className="text-[10px] uppercase font-bold">
              📍 {branchName}
            </Badge>
          </div>
          <p className="text-xs text-zinc-600 mt-1">
            Configure service areas, dining tables, bulk generation, and QR code access for {businessName}.
          </p>
        </div>

        {/* Quick Route Links & Contextual Help */}
        <div className="flex flex-wrap items-center gap-2">
          <ContextualHelpButton explicitSlug="creating-service-areas-and-tables" />
          {canManage && (
            <>
              <Link href="/dashboard/tables/bulk">
                <Button variant="outline" size="sm" className="text-xs font-bold min-h-[44px]">
                  ⚡ Bulk Generator
                </Button>
              </Link>
              <Link href="/dashboard/tables/qr">
                <Button variant="outline" size="sm" className="text-xs font-bold min-h-[44px]">
                  📱 QR Codes
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Step Navigation Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => setActiveStep('areas')}
          className={`p-4 rounded-2xl border text-left transition-all touch-manipulation min-h-[64px] ${
            activeStep === 'areas'
              ? 'bg-zinc-950 border-zinc-950 text-white shadow-lg ring-2 ring-zinc-950'
              : 'bg-white border-zinc-200 hover:border-zinc-300 text-zinc-900 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider">Step 1: Service Areas</span>
            <span className={`text-xs font-mono font-bold ${activeStep === 'areas' ? 'text-zinc-300' : 'text-zinc-500'}`}>
              {serviceAreas.length} Areas
            </span>
          </div>
          <p className={`text-xs mt-1 font-medium ${activeStep === 'areas' ? 'text-zinc-300' : 'text-zinc-500'}`}>
            Floor plans, outdoor terraces, main dining halls.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setActiveStep('tables')}
          className={`p-4 rounded-2xl border text-left transition-all touch-manipulation min-h-[64px] ${
            activeStep === 'tables'
              ? 'bg-zinc-950 border-zinc-950 text-white shadow-lg ring-2 ring-zinc-950'
              : 'bg-white border-zinc-200 hover:border-zinc-300 text-zinc-900 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider">Step 2: Dining Tables</span>
            <span className={`text-xs font-mono font-bold ${activeStep === 'tables' ? 'text-zinc-300' : 'text-zinc-500'}`}>
              {tables.length} Tables
            </span>
          </div>
          <p className={`text-xs mt-1 font-medium ${activeStep === 'tables' ? 'text-zinc-300' : 'text-zinc-500'}`}>
            Single table creation, capacities & bulk generator.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setActiveStep('qr')}
          className={`p-4 rounded-2xl border text-left transition-all touch-manipulation min-h-[64px] ${
            activeStep === 'qr'
              ? 'bg-zinc-950 border-zinc-950 text-white shadow-lg ring-2 ring-zinc-950'
              : 'bg-white border-zinc-200 hover:border-zinc-300 text-zinc-900 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider">Step 3: QR Codes & PIN</span>
            <span className={`text-xs font-mono font-bold ${activeStep === 'qr' ? 'text-zinc-300' : 'text-zinc-500'}`}>
              {tablesSummary.withPin}/{tablesSummary.total} PINs
            </span>
          </div>
          <p className={`text-xs mt-1 font-medium ${activeStep === 'qr' ? 'text-zinc-300' : 'text-zinc-500'}`}>
            Table QR stickers, ordering PINs & security.
          </p>
        </button>
      </div>

      {/* Step Content */}
      <div className="pt-2">
        {activeStep === 'areas' && (
          <div className="space-y-4">
            <Card className="p-4 bg-zinc-900 text-white space-y-1">
              <h2 className="text-xs font-extrabold uppercase tracking-wider">Step 1 — Service Areas Setup</h2>
              <p className="text-xs text-zinc-300">
                Organize your venue into distinct physical sections (e.g. Main Hall, Rooftop Bar, Garden Terrace).
              </p>
            </Card>

            <AreaManager initialAreas={mappedAreas} canManage={canManage} />

            <div className="flex justify-end pt-4">
              <Button
                variant="primary"
                onClick={() => setActiveStep('tables')}
                className="font-bold text-xs uppercase tracking-wider min-h-[44px]"
              >
                Proceed to Step 2: Dining Tables →
              </Button>
            </div>
          </div>
        )}

        {activeStep === 'tables' && (
          <div className="space-y-4">
            <Card className="p-4 bg-zinc-900 text-white space-y-1">
              <h2 className="text-xs font-extrabold uppercase tracking-wider">Step 2 — Dining Tables Grid & Generator</h2>
              <p className="text-xs text-zinc-300">
                Add single tables or use the bulk generator to build tables across your service areas.
              </p>
            </Card>

            <TableGrid
              businessName={businessName}
              branchName={branchName}
              tablePinLength={tablePinLength}
              initialTables={mappedTables}
              areas={mappedAreas}
              canManage={canManage}
            />

            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={() => setActiveStep('areas')}
                className="font-bold text-xs uppercase tracking-wider min-h-[44px]"
              >
                ← Back to Service Areas
              </Button>
              <Button
                variant="primary"
                onClick={() => setActiveStep('qr')}
                className="font-bold text-xs uppercase tracking-wider min-h-[44px]"
              >
                Proceed to Step 3: QR Codes →
              </Button>
            </div>
          </div>
        )}

        {activeStep === 'qr' && (
          <div className="space-y-4">
            <Card className="p-4 bg-zinc-900 text-white space-y-1">
              <h2 className="text-xs font-extrabold uppercase tracking-wider">Step 3 — Table QR Cards & Ordering Security</h2>
              <p className="text-xs text-zinc-300">
                Generate guest QR stickers and manage Table PIN security settings for digital ordering.
              </p>
            </Card>

            <BranchQrManager
              businessName={businessName}
              branchName={branchName}
              branchCode={branchCode}
              requireTableSelection={requireTableSelection}
              requireTablePin={requireTablePin}
              tablePinLength={tablePinLength}
              tablesSummary={tablesSummary}
              initialQr={branchQr}
              canManage={canManage}
            />

            <div className="flex justify-start pt-4">
              <Button
                variant="outline"
                onClick={() => setActiveStep('tables')}
                className="font-bold text-xs uppercase tracking-wider min-h-[44px]"
              >
                ← Back to Dining Tables
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
