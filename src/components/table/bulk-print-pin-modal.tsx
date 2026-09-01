'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getBranchTablePinsAction, PrintableTablePinItem } from '@/server/actions/table';

interface BulkPrintPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessName: string;
  branchName: string;
  areas: { id: string; name: string; code: string }[];
  initialAreaId?: string;
}

export const BulkPrintPinModal: React.FC<BulkPrintPinModalProps> = ({
  isOpen,
  onClose,
  businessName,
  branchName,
  areas,
  initialAreaId = 'all',
}) => {
  const [selectedArea, setSelectedArea] = useState<string>(initialAreaId);
  const [tables, setTables] = useState<PrintableTablePinItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [onlyConfigured, setOnlyConfigured] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    async function loadPins() {
      setLoading(true);
      setErrorMsg(null);
      const res = await getBranchTablePinsAction({
        serviceAreaId: selectedArea === 'all' ? undefined : selectedArea,
      });

      if (!mounted) return;

      if (res.success && res.data) {
        setTables(res.data.tables);
      } else {
        setErrorMsg(res.message || 'Failed to load table PINs for printing.');
      }
      setLoading(false);
    }

    loadPins();
    return () => {
      mounted = false;
    };
  }, [isOpen, selectedArea]);

  if (!isOpen) return null;

  const displayTables = onlyConfigured ? tables.filter((t) => t.hasPin && t.pin) : tables;
  const configuredCount = tables.filter((t) => t.hasPin && t.pin).length;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-xs animate-in fade-in print:p-0 print:bg-white print:static print:z-auto">
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-zinc-200 text-zinc-950 overflow-hidden print:max-h-none print:shadow-none print:border-none print:w-full">
        {/* Modal Header (Hidden during print) */}
        <div className="flex items-center justify-between border-b border-zinc-200 p-4 sm:p-6 print:hidden">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="solid" className="text-[10px] uppercase font-black tracking-wider text-white bg-zinc-950">
                Security PINs
              </Badge>
              <span className="text-xs text-zinc-500 font-medium">{branchName}</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-zinc-950 mt-1">
              Print Table Security PINs
            </h2>
            <p className="text-xs text-zinc-500">
              Print physical PIN cards/stickers for tables to place on stands or guest table tents.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 font-bold"
          >
            ✕
          </button>
        </div>

        {/* Filter Controls (Hidden during print) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 bg-zinc-50/80 px-4 py-3 sm:px-6 print:hidden">
          <div className="flex items-center gap-3 flex-wrap">
            <label htmlFor="area-filter" className="text-xs font-bold text-zinc-700 shrink-0">
              Area:
            </label>
            <select
              id="area-filter"
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 font-medium focus:border-zinc-950 focus:outline-none"
            >
              <option value="all">All Service Areas ({tables.length} tables)</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.code})
                </option>
              ))}
            </select>

            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyConfigured}
                onChange={(e) => setOnlyConfigured(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-zinc-950 focus:ring-zinc-950"
              />
              Only with active PINs ({configuredCount})
            </label>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={loading || displayTables.length === 0}
              onClick={handlePrint}
              className="min-h-[40px] px-4 font-bold text-xs bg-zinc-950 text-white hover:bg-zinc-800"
            >
              🖨️ Print {displayTables.length} PIN Cards
            </Button>
          </div>
        </div>

        {/* Printable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 print:p-0 print:overflow-visible">
          {errorMsg && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800 print:hidden">
              {errorMsg}
            </div>
          )}

          {loading ? (
            <div className="py-16 text-center space-y-2 print:hidden">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent" />
              <p className="text-xs text-zinc-500 font-medium">Decrypting and loading table PIN cards…</p>
            </div>
          ) : displayTables.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 p-12 text-center space-y-2 print:hidden">
              <span className="text-3xl block">🔒</span>
              <h4 className="text-sm font-bold text-zinc-900">No Table PINs Found</h4>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                No dining tables match the selected area filter or have active PINs configured.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-2 print:gap-4 print:m-0">
              {displayTables.map((table) => (
                <div
                  key={table.id}
                  className="rounded-2xl border-2 border-zinc-900 bg-white p-5 text-center flex flex-col justify-between space-y-4 shadow-sm break-inside-avoid print:shadow-none print:border-2 print:border-zinc-950 print:p-4 print:rounded-xl"
                >
                  {/* Card Top Branding & Location */}
                  <div className="border-b border-dashed border-zinc-300 pb-2.5 space-y-0.5">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-zinc-500">
                      <span>{businessName}</span>
                      <span className="text-zinc-950 font-bold">{table.serviceAreaName}</span>
                    </div>
                    <p className="text-[11px] text-zinc-600 font-medium">{branchName}</p>
                  </div>

                  {/* Table Identity */}
                  <div className="space-y-1">
                    <h3 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
                      {table.name}
                    </h3>
                    <div className="flex items-center justify-center gap-1.5 text-xs text-zinc-600 font-semibold">
                      <span className="bg-zinc-100 px-2 py-0.5 rounded text-zinc-800 font-mono font-bold">
                        {table.code}
                      </span>
                      <span>•</span>
                      <span>👥 {table.capacity} Guests</span>
                    </div>
                  </div>

                  {/* Security PIN Display Box */}
                  <div className="rounded-xl border-2 border-dashed border-zinc-950 bg-zinc-50 p-4 space-y-1 print:bg-transparent">
                    <span className="text-[10px] uppercase font-black tracking-wider text-zinc-600 block">
                      TABLE SECURITY PIN
                    </span>
                    {table.pin ? (
                      <p className="text-3xl sm:text-4xl font-mono font-black text-zinc-950 tracking-widest">
                        {table.pin}
                      </p>
                    ) : (
                      <p className="text-sm font-semibold text-amber-800 py-2">
                        Not Configured
                      </p>
                    )}
                  </div>

                  {/* Card Footer Instruction */}
                  <div className="pt-1 text-[10px] text-zinc-500 leading-tight">
                    <p className="font-semibold text-zinc-700">
                      Scan QR at table & enter PIN to order
                    </p>
                    <p className="text-[9px] text-zinc-400 mt-0.5">
                      WSNexa Table Access Verification
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer (Hidden during print) */}
        <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50 p-4 sm:px-6 print:hidden">
          <span className="text-xs text-zinc-500">
            {displayTables.length} table card{displayTables.length === 1 ? '' : 's'} ready to print
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="min-h-[40px] px-4 font-bold text-xs">
              Close
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={loading || displayTables.length === 0}
              onClick={handlePrint}
              className="min-h-[40px] px-5 font-bold text-xs bg-zinc-950 text-white hover:bg-zinc-800"
            >
              🖨️ Print PINs
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
