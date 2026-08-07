'use client';

import React, { useState } from 'react';
import { ReportType, ExportFormat, ReportPreset } from '@/lib/validation/report';
import { exportReportAction } from '@/server/actions/report';

interface ExportCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  preset: ReportPreset;
  startDate?: string;
  endDate?: string;
  branchId?: string;
}

export function ExportCenterModal({
  isOpen,
  onClose,
  preset,
  startDate,
  endDate,
  branchId,
}: ExportCenterModalProps) {
  const [reportType, setReportType] = useState<ReportType>('sales_summary');
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [isExporting, setIsExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    setErrorMsg(null);

    try {
      const res = await exportReportAction({
        reportType,
        format,
        preset,
        startDate,
        endDate,
        branchId,
      });

      if (!res.success || !res.fileContent || !res.filename) {
        setErrorMsg(res.message || 'Export failed.');
        setIsExporting(false);
        return;
      }

      if (format === 'pdf') {
        const blob = new Blob([res.fileContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const win = window.open(url, '_blank');
        if (win) {
          win.onload = () => win.print();
        }
      } else {
        const blob = new Blob([res.fileContent], { type: res.mimeType || 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown export error';
      setErrorMsg(msg);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span>📥</span> Report Export Center
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white text-lg font-bold p-1 rounded-lg"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">
              Select Report Dataset
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              className="w-full bg-zinc-950 text-white text-sm border border-zinc-800 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="sales_summary">Executive Sales Summary</option>
              <option value="payment_breakdown">Payment Method Breakdown</option>
              <option value="menu_performance">Menu Items Performance</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">
              Export Format
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFormat('csv')}
                className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                  format === 'csv'
                    ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                CSV
              </button>
              <button
                type="button"
                onClick={() => setFormat('xlsx')}
                className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                  format === 'xlsx'
                    ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                Excel (.xls)
              </button>
              <button
                type="button"
                onClick={() => setFormat('pdf')}
                className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                  format === 'pdf'
                    ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                Print / PDF
              </button>
            </div>
          </div>

          <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-xs text-zinc-400 space-y-1 font-mono">
            <div>Range: <span className="text-zinc-200">{preset}</span></div>
            <div>Injection Security: <span className="text-emerald-400">Formula Sanitized</span></div>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isExporting ? 'Generating...' : 'Download / Print'}
          </button>
        </div>
      </div>
    </div>
  );
}
