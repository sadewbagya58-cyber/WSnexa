'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  updateDiningTableStatusAction,
  archiveDiningTableAction,
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
  service_area_id: string;
  service_areas: { name: string; code: string } | { name: string; code: string }[] | null;
}

interface TableGridProps {
  initialTables: DiningTableItem[];
  areas: { id: string; name: string; code: string }[];
}

export const TableGrid: React.FC<TableGridProps> = ({ initialTables, areas }) => {
  const [tables, setTables] = useState<DiningTableItem[]>(initialTables);
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [pendingTableIds, setPendingTableIds] = useState<Set<string>>(new Set());

  const handleStatusChange = async (tableId: string, nextStatus: TableStatus) => {
    const currentTable = tables.find((t) => t.id === tableId);
    if (!currentTable || currentTable.status === nextStatus) return;

    const previousStatus = currentTable.status;

    // 1. Immediate Optimistic UI Update (< 50ms)
    setTables((prev) =>
      prev.map((t) => (t.id === tableId ? { ...t, status: nextStatus } : t))
    );

    setPendingTableIds((prev) => new Set(prev).add(tableId));

    // 2. Background Server Action
    const res = await updateDiningTableStatusAction(tableId, nextStatus);

    setPendingTableIds((prev) => {
      const next = new Set(prev);
      next.delete(tableId);
      return next;
    });

    // 3. Rollback on Error
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

  // Calculate Stat Summary
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-y border-zinc-200 py-3">
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
        </div>
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredTables.map((table) => {
          const isPending = pendingTableIds.has(table.id);

          return (
            <Card key={table.id} className="flex flex-col justify-between p-5">
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
              </div>

              {/* Status Change Selector & Actions */}
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

                <div className="flex items-center gap-1.5">
                  <Link href={`/dashboard/tables/${table.id}/qr`}>
                    <Button variant="outline" size="sm">
                      📱 QR
                    </Button>
                  </Link>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleArchive(table.id)}
                  >
                    Archive
                  </Button>
                </div>
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
    </div>
  );
};
