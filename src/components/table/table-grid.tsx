'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  updateDiningTableStatusAction,
  archiveDiningTableAction,
  generateTablePinAction,
  updateTablePinAction,
} from '@/server/actions/table';
import { TableStatus } from '@/types/database.types';

interface DiningTableItem {
  id: string;
  name: string;
  code: string;
  table_number: number | null;
  capacity: number;
  status: TableStatus;
  shape: string | null;
  is_active: boolean;
  table_pin_hash: string | null;
  table_pin_updated_at: string | null;
  service_area_id: string;
  service_areas: { name: string; code: string } | { name: string; code: string }[] | null;
}

interface TableGridProps {
  businessName: string;
  branchName: string;
  tablePinLength: number;
  initialTables: DiningTableItem[];
  areas: { id: string; name: string; code: string }[];
}

export const TableGrid: React.FC<TableGridProps> = ({
  businessName,
  branchName,
  tablePinLength,
  initialTables,
  areas,
}) => {
  const [tables, setTables] = useState<DiningTableItem[]>(initialTables);
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [pendingTableIds, setPendingTableIds] = useState<Set<string>>(new Set());

  // PIN Modal One-Time Display State
  const [pinModal, setPinModal] = useState<{
    tableName: string;
    tableCode: string;
    plainPin: string;
  } | null>(null);

  // Custom PIN Input Modal State
  const [customPinModal, setCustomPinModal] = useState<{
    tableId: string;
    tableName: string;
    inputPin: string;
  } | null>(null);

  const [pinLoading, setPinLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const handleStatusChange = async (tableId: string, nextStatus: TableStatus) => {
    const currentTable = tables.find((t) => t.id === tableId);
    if (!currentTable || currentTable.status === nextStatus) return;

    const previousStatus = currentTable.status;

    setTables((prev) =>
      prev.map((t) => (t.id === tableId ? { ...t, status: nextStatus } : t))
    );

    setPendingTableIds((prev) => new Set(prev).add(tableId));

    const res = await updateDiningTableStatusAction(tableId, nextStatus);

    setPendingTableIds((prev) => {
      const next = new Set(prev);
      next.delete(tableId);
      return next;
    });

    if (!res.success) {
      setTables((prev) =>
        prev.map((t) => (t.id === tableId ? { ...t, status: previousStatus } : t))
      );
      alert(res.message || 'Failed to update table status.');
    }
  };

  const handleArchive = async (tableId: string) => {
    if (!confirm('Are you sure you want to archive this dining table?')) return;
    setPendingTableIds((prev) => new Set(prev).add(tableId));

    const res = await archiveDiningTableAction(tableId);
    if (res.success) {
      setTables((prev) => prev.filter((t) => t.id !== tableId));
    } else {
      alert(res.message);
      setPendingTableIds((prev) => {
        const next = new Set(prev);
        next.delete(tableId);
        return next;
      });
    }
  };

  const handleGeneratePin = async (table: DiningTableItem) => {
    setPinLoading(true);
    const res = await generateTablePinAction(table.id);
    setPinLoading(false);

    if (res.success && res.data) {
      setTables((prev) =>
        prev.map((t) =>
          t.id === table.id
            ? { ...t, table_pin_hash: 'configured', table_pin_updated_at: new Date().toISOString() }
            : t
        )
      );

      setPinModal({
        tableName: table.name,
        tableCode: table.code,
        plainPin: res.data.plainPin,
      });
    } else {
      alert(res.message || 'Failed to generate Table PIN');
    }
  };

  const handleSaveCustomPin = async () => {
    if (!customPinModal) return;
    setPinLoading(true);
    const res = await updateTablePinAction(customPinModal.tableId, customPinModal.inputPin);
    setPinLoading(false);

    if (res.success && res.data) {
      setTables((prev) =>
        prev.map((t) =>
          t.id === customPinModal.tableId
            ? { ...t, table_pin_hash: 'configured', table_pin_updated_at: new Date().toISOString() }
            : t
        )
      );

      const targetTable = tables.find((t) => t.id === customPinModal.tableId);

      setCustomPinModal(null);
      setPinModal({
        tableName: targetTable?.name || 'Table',
        tableCode: targetTable?.code || 'T1',
        plainPin: res.data.plainPin,
      });
    } else {
      alert(res.message || 'Failed to set custom PIN');
    }
  };

  const handleCopyPin = () => {
    if (!pinModal) return;
    navigator.clipboard.writeText(pinModal.plainPin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrintSticker = () => {
    window.print();
  };

  const handleClearFilters = () => {
    setSelectedArea('all');
    setSelectedStatus('all');
    setSearchTerm('');
  };

  const filteredTables = tables.filter((t) => {
    const matchesArea = selectedArea === 'all' || t.service_area_id === selectedArea;
    const matchesStatus = selectedStatus === 'all' || t.status === selectedStatus;
    const matchesSearch =
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.table_number && t.table_number.toString().includes(searchTerm));
    return matchesArea && matchesStatus && matchesSearch;
  });

  const totalCount = tables.length;
  const availableCount = tables.filter((t) => t.status === 'available').length;
  const occupiedCount = tables.filter((t) => t.status === 'occupied').length;
  const reservedCount = tables.filter((t) => t.status === 'reserved').length;
  const cleaningCount = tables.filter((t) => t.status === 'cleaning').length;
  const unavailableCount = tables.filter((t) => t.status === 'unavailable').length;

  const getStatusBadge = (status: TableStatus) => {
    switch (status) {
      case 'available':
        return <Badge variant="success">Available</Badge>;
      case 'occupied':
        return <Badge variant="destructive">Occupied</Badge>;
      case 'reserved':
        return <Badge variant="warning">Reserved</Badge>;
      case 'cleaning':
        return <Badge variant="neutral">Cleaning</Badge>;
      case 'unavailable':
        return <Badge variant="neutral">Unavailable</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Table Status Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 print:hidden">
        <Card className="p-3 text-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Total Tables</span>
          <p className="mt-1 text-xl font-extrabold text-zinc-950">{totalCount}</p>
        </Card>
        <Card className="p-3 text-center border-emerald-200 bg-emerald-50/30">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Available</span>
          <p className="mt-1 text-xl font-extrabold text-emerald-950">{availableCount}</p>
        </Card>
        <Card className="p-3 text-center border-red-200 bg-red-50/30">
          <span className="text-[11px] font-bold uppercase tracking-wider text-red-800">Occupied</span>
          <p className="mt-1 text-xl font-extrabold text-red-950">{occupiedCount}</p>
        </Card>
        <Card className="p-3 text-center border-amber-200 bg-amber-50/30">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Reserved</span>
          <p className="mt-1 text-xl font-extrabold text-amber-950">{reservedCount}</p>
        </Card>
        <Card className="p-3 text-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Cleaning</span>
          <p className="mt-1 text-xl font-extrabold text-zinc-950">{cleaningCount}</p>
        </Card>
        <Card className="p-3 text-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Unavailable</span>
          <p className="mt-1 text-xl font-extrabold text-zinc-950">{unavailableCount}</p>
        </Card>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-y border-zinc-200 py-3 print:hidden">
        <input
          type="text"
          placeholder="Search by table name, code, or number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full sm:w-72 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none"
        />

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
            className="w-full sm:w-44 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none"
          >
            <option value="all">All Service Areas</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.code})
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full sm:w-36 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="available">Available</option>
            <option value="occupied">Occupied</option>
            <option value="reserved">Reserved</option>
            <option value="cleaning">Cleaning</option>
            <option value="unavailable">Unavailable</option>
          </select>

          {(selectedArea !== 'all' || selectedStatus !== 'all' || searchTerm) && (
            <Button variant="outline" size="sm" onClick={handleClearFilters}>
              Clear Filters
            </Button>
          )}

          <Link href="/dashboard/tables/qr">
            <Button variant="outline" size="sm">
              📱 Branch QR & Settings
            </Button>
          </Link>
        </div>
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 print:hidden">
        {filteredTables.map((table) => {
          const isPending = pendingTableIds.has(table.id);
          const hasPin = table.table_pin_hash !== null;

          return (
            <Card key={table.id} className="flex flex-col justify-between p-5 space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-zinc-950">{table.name}</span>
                  {getStatusBadge(table.status)}
                </div>

                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <Badge variant="neutral">{table.code}</Badge>
                  <span>
                    Area:{' '}
                    {Array.isArray(table.service_areas)
                      ? table.service_areas[0]?.name
                      : table.service_areas?.name || 'Unassigned'}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 text-xs text-zinc-600">
                  <span>Capacity: 👥 {table.capacity} guests</span>
                  <span className="capitalize">Shape: {table.shape || 'Square'}</span>
                </div>

                {/* Table Security PIN Row */}
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-zinc-700">Security PIN: </span>
                    {hasPin ? (
                      <span className="font-mono font-bold text-emerald-800">••••</span>
                    ) : (
                      <span className="text-amber-800 font-semibold">Not Set</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={pinLoading}
                      onClick={() => handleGeneratePin(table)}
                      className="rounded bg-white px-2 py-1 text-[11px] font-bold text-zinc-800 border border-zinc-200 hover:bg-zinc-100"
                    >
                      {hasPin ? '🔄 Reset' : '✨ Set'}
                    </button>
                    <button
                      type="button"
                      disabled={pinLoading}
                      onClick={() => setCustomPinModal({ tableId: table.id, tableName: table.name, inputPin: '' })}
                      className="rounded bg-white px-2 py-1 text-[11px] font-bold text-zinc-800 border border-zinc-200 hover:bg-zinc-100"
                    >
                      ✏️ Edit
                    </button>
                  </div>
                </div>
              </div>

              {/* Status Change Selector & Archive */}
              <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3">
                <select
                  value={table.status}
                  disabled={isPending}
                  onChange={(e) => handleStatusChange(table.id, e.target.value as TableStatus)}
                  className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-900 focus:outline-none touch-manipulation disabled:opacity-50"
                >
                  <option value="available">Set Available</option>
                  <option value="occupied">Set Occupied</option>
                  <option value="reserved">Set Reserved</option>
                  <option value="cleaning">Set Cleaning</option>
                  <option value="unavailable">Set Unavailable</option>
                </select>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => handleArchive(table.id)}
                >
                  Archive
                </Button>
              </div>
            </Card>
          );
        })}

        {filteredTables.length === 0 && (
          <Card className="col-span-full p-8 text-center text-xs text-zinc-500">
            No dining tables found matching your filters.
          </Card>
        )}
      </div>

      {/* One-Time Plain PIN Display & Sticker Modal */}
      {pinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in print:p-0 print:bg-white">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200 text-center space-y-5 print:shadow-none print:border-2 print:border-zinc-900">
            <div className="space-y-1">
              <span className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">{businessName}</span>
              <h2 className="text-2xl font-black text-zinc-950">{pinModal.tableName} ({pinModal.tableCode})</h2>
              <p className="text-xs text-zinc-500">{branchName} • Table Security PIN Sticker</p>
            </div>

            <div className="rounded-xl border-2 border-dashed border-zinc-900 bg-zinc-50 p-6 space-y-2">
              <span className="text-xs uppercase font-bold text-zinc-500 tracking-wider">TABLE SECURITY PIN</span>
              <p className="text-4xl font-mono font-black text-zinc-950 tracking-widest">{pinModal.plainPin}</p>
              <p className="text-[10px] text-zinc-400">
                🔒 Plain PIN is shown once. Store securely or print sticker immediately.
              </p>
            </div>

            <div className="flex flex-col gap-2 print:hidden">
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={handleCopyPin}>
                  {copied ? '✅ Copied!' : '📋 Copy PIN'}
                </Button>
                <Button variant="outline" className="flex-1" onClick={handlePrintSticker}>
                  🖨️ Print PIN Sticker
                </Button>
              </div>
              <Button className="w-full" onClick={() => setPinModal(null)}>
                Done / Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Set Custom PIN Modal */}
      {customPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200 space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-zinc-950">Set Custom Table PIN</h2>
              <p className="text-xs text-zinc-500">
                Enter a custom {tablePinLength}-digit PIN for {customPinModal.tableName}.
              </p>
            </div>

            <input
              type="text"
              maxLength={tablePinLength}
              placeholder={`${tablePinLength}-digit PIN (e.g. 4821)`}
              value={customPinModal.inputPin}
              onChange={(e) =>
                setCustomPinModal({ ...customPinModal, inputPin: e.target.value.replace(/\D/g, '') })
              }
              className="w-full font-mono text-center text-2xl tracking-widest rounded-xl border border-zinc-300 p-3 text-zinc-950 focus:border-zinc-950 focus:outline-none"
            />

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setCustomPinModal(null)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                disabled={customPinModal.inputPin.length !== tablePinLength || pinLoading}
                onClick={handleSaveCustomPin}
              >
                Save PIN
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
