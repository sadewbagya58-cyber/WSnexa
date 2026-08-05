'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { bulkGenerateTableQrsAction } from '@/server/actions/qr';
import { generateQrSvgString } from '@/lib/qr/qr-generator';

interface TableQrStatusItem {
  id: string;
  name: string;
  code: string;
  table_number: number | null;
  capacity: number;
  service_area_id: string;
  areaName: string;
  areaCode: string;
  hasActiveQr: boolean;
  qrVersion: number;
  tokenPrefix: string | null;
}

interface BulkQrExporterProps {
  businessName: string;
  branchName: string;
  branchCode: string;
  areas: { id: string; name: string; code: string }[];
  tables: TableQrStatusItem[];
}

export const BulkQrExporter: React.FC<BulkQrExporterProps> = ({
  businessName,
  branchName,
  branchCode,
  areas,
  tables: initialTables,
}) => {
  const [tablesList, setTablesList] = useState<TableQrStatusItem[]>(initialTables);
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [selectedTableIds, setSelectedTableIds] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const filteredTables = tablesList.filter(
    (t) => selectedArea === 'all' || t.service_area_id === selectedArea
  );

  const activeQrCount = filteredTables.filter((t) => t.hasActiveQr).length;
  const totalCount = filteredTables.length;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTableIds(new Set(filteredTables.map((t) => t.id)));
    } else {
      setSelectedTableIds(new Set());
    }
  };

  const handleToggleTable = (tableId: string) => {
    setSelectedTableIds((prev) => {
      const next = new Set(prev);
      if (next.has(tableId)) {
        next.delete(tableId);
      } else {
        next.add(tableId);
      }
      return next;
    });
  };

  const handleBulkGenerateMissing = async () => {
    setIsGenerating(true);
    setFeedback(null);
    const res = await bulkGenerateTableQrsAction(
      selectedArea === 'all' ? undefined : selectedArea,
      false
    );
    setIsGenerating(false);

    if (res.success) {
      setFeedback(res.message || 'Bulk QR generation completed');
      // Update local active state for all items
      setTablesList((prev) =>
        prev.map((t) => ({ ...t, hasActiveQr: true }))
      );
    } else {
      alert(res.message || 'Failed to bulk generate QR codes');
    }
  };

  const handlePrintSheet = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Stat Overview & Action Toolbar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 print:hidden">
        <Card className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-zinc-500 font-semibold uppercase">Total Tables</span>
            <p className="text-2xl font-black text-zinc-950">{totalCount}</p>
          </div>
          <span className="text-2xl">🪑</span>
        </Card>

        <Card className="p-4 flex items-center justify-between border-emerald-200 bg-emerald-50/40">
          <div>
            <span className="text-xs text-emerald-800 font-semibold uppercase">Active QR Codes</span>
            <p className="text-2xl font-black text-emerald-950">{activeQrCount}</p>
          </div>
          <span className="text-2xl">📱</span>
        </Card>

        <Card className="p-4 flex items-center justify-between border-amber-200 bg-amber-50/40">
          <div>
            <span className="text-xs text-amber-800 font-semibold uppercase">Missing QR</span>
            <p className="text-2xl font-black text-amber-950">{totalCount - activeQrCount}</p>
          </div>
          <span className="text-2xl">⚠️</span>
        </Card>
      </div>

      {/* Toolbar & Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-y border-zinc-200 py-3 print:hidden">
        <div className="flex items-center gap-3">
          <select
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none"
          >
            <option value="all">All Service Areas</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.code})
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 cursor-pointer">
            <input
              type="checkbox"
              checked={
                filteredTables.length > 0 &&
                selectedTableIds.size === filteredTables.length
              }
              onChange={(e) => handleSelectAll(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-950"
            />
            Select All ({filteredTables.length})
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {totalCount - activeQrCount > 0 && (
            <Button
              size="sm"
              disabled={isGenerating}
              onClick={handleBulkGenerateMissing}
            >
              {isGenerating ? 'Generating...' : '✨ Generate Missing QR Codes'}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handlePrintSheet}
          >
            🖨️ Print A4 QR Sheet
          </Button>
        </div>
      </div>

      {feedback && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 font-medium print:hidden">
          ✅ {feedback}
        </div>
      )}

      {/* Table Cards List View for Admin Dashboard */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 print:hidden">
        {filteredTables.map((table) => (
          <Card key={table.id} className="p-4 flex flex-col justify-between space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedTableIds.has(table.id)}
                    onChange={() => handleToggleTable(table.id)}
                    className="h-4 w-4 rounded border-zinc-300 text-zinc-900"
                  />
                  <span className="font-bold text-zinc-950">{table.name}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <Badge variant="neutral">{table.code}</Badge>
                  <span>{table.areaName}</span>
                </div>
              </div>

              {table.hasActiveQr ? (
                <Badge variant="success">Active (v{table.qrVersion})</Badge>
              ) : (
                <Badge variant="warning">Missing</Badge>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-zinc-100 pt-2 text-xs">
              <span className="text-zinc-500">Prefix: {table.tokenPrefix || '—'}</span>
              <Link href={`/dashboard/tables/${table.id}/qr`}>
                <Button variant="outline" size="sm">Manage QR</Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>

      {/* A4 Print Sheet Container (Visible during Window Print) */}
      <div className="hidden print:block space-y-6">
        <div className="border-b-2 border-zinc-900 pb-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-zinc-950">{businessName}</h1>
            <p className="text-sm font-semibold text-zinc-600">
              Branch: {branchName} ({branchCode}) • Printable Table QR Sheet
            </p>
          </div>
          <span className="text-xs font-mono">WSNexa QR System</span>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {filteredTables.map((table) => {
            const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
            const sampleUrl = `${baseUrl}/m/${table.tokenPrefix || 'SAMPLE'}`;

            return (
              <div
                key={table.id}
                className="border-2 border-zinc-900 rounded-xl p-4 text-center space-y-3 page-break-inside-avoid"
              >
                <div className="space-y-0.5">
                  <h2 className="text-xl font-extrabold text-zinc-950">{table.name}</h2>
                  <p className="text-xs text-zinc-600">{table.areaName} • {table.code}</p>
                </div>

                <div
                  className="mx-auto h-40 w-40 p-1 border border-zinc-200 rounded-md"
                  dangerouslySetInnerHTML={{ __html: generateQrSvgString(sampleUrl, 150) }}
                />

                <div className="space-y-0.5 text-[11px]">
                  <p className="font-bold text-zinc-900">Scan to view menu</p>
                  <p className="text-zinc-500">{businessName} • {branchName}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
