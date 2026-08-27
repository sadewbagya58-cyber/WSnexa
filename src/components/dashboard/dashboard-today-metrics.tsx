import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils/currency';
import { DashboardTodayData } from '@/server/navigation/dashboard-today-data';
import { DashboardHomeModel } from '@/server/navigation/dashboard-home-model';

interface DashboardTodayMetricsProps {
  data: DashboardTodayData;
  model: DashboardHomeModel;
}

export const DashboardTodayMetrics: React.FC<DashboardTodayMetricsProps> = ({ data, model }) => {
  const cards: React.ReactNode[] = [];

  // 1. Orders Today Card (permission-gated)
  if (model.showOrdersTodayCard && data.ordersTodayCount !== null) {
    cards.push(
      <Card key="orders-today" className="p-5 hover:border-zinc-300 transition-all shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Orders Today</span>
            <Badge variant="neutral">Today</Badge>
          </div>
          <div className="mt-3">
            {data.ordersTodayCount > 0 ? (
              <p className="text-3xl font-extrabold text-zinc-950 tracking-tight">{data.ordersTodayCount}</p>
            ) : (
              <p className="text-sm font-semibold text-zinc-400 mt-1">No orders yet today</p>
            )}
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between text-xs">
          <span className="text-zinc-500 font-medium">
            {data.activeOrdersCount !== null && data.activeOrdersCount > 0
              ? `${data.activeOrdersCount} in progress`
              : 'All up to date'}
          </span>
          <Link href="/dashboard/orders" className="font-bold text-zinc-900 hover:text-zinc-600">
            View →
          </Link>
        </div>
      </Card>
    );
  }

  // 2. Active Orders Live Queue Card (permission-gated)
  if (model.showOrdersTodayCard && data.activeOrdersCount !== null) {
    const hasActive = data.activeOrdersCount > 0;
    cards.push(
      <Card key="active-orders" className="p-5 hover:border-zinc-300 transition-all shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Active Queue</span>
            <Badge variant={hasActive ? 'warning' : 'success'}>
              {hasActive ? 'Live' : 'Clear'}
            </Badge>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-extrabold text-zinc-950 tracking-tight">{data.activeOrdersCount}</p>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between text-xs">
          <span className="text-zinc-500 font-medium">
            {hasActive ? 'Pending kitchen/POS' : 'No waiting tickets'}
          </span>
          <Link href="/dashboard/orders" className="font-bold text-zinc-900 hover:text-zinc-600">
            Queue →
          </Link>
        </div>
      </Card>
    );
  }

  // 3. Revenue Today Card (strictly financial-permission-gated)
  if (model.showRevenueTodayCard && data.revenueTodayCents !== null) {
    const formattedRevenue = formatCurrency(data.revenueTodayCents, data.currency);
    cards.push(
      <Card key="revenue-today" className="p-5 hover:border-zinc-300 transition-all shadow-xs flex flex-col justify-between bg-gradient-to-br from-zinc-50/50 to-white">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Revenue Today</span>
            <Badge variant="neutral">Gross</Badge>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-extrabold text-zinc-950 tracking-tight">{formattedRevenue}</p>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between text-xs">
          <span className="text-zinc-500 font-medium">Paid & completed</span>
          <Link href="/dashboard/reports" className="font-bold text-zinc-900 hover:text-zinc-600">
            Reports →
          </Link>
        </div>
      </Card>
    );
  }

  // 4. Reservations Today Card (reservation-permission-gated)
  if (model.showReservationsTodayCard && data.reservationsTodayCount !== null) {
    cards.push(
      <Card key="reservations-today" className="p-5 hover:border-zinc-300 transition-all shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Reservations</span>
            <Badge variant="neutral">Today</Badge>
          </div>
          <div className="mt-3">
            {data.reservationsTodayCount > 0 ? (
              <p className="text-3xl font-extrabold text-zinc-950 tracking-tight">{data.reservationsTodayCount}</p>
            ) : (
              <p className="text-sm font-semibold text-zinc-400 mt-1">No reservations today</p>
            )}
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between text-xs">
          <span className="text-zinc-500 font-medium">Bookings scheduled</span>
          <Link href="/dashboard/reservations" className="font-bold text-zinc-900 hover:text-zinc-600">
            Schedule →
          </Link>
        </div>
      </Card>
    );
  }

  // 5. Table Floor Status Card (dining-permission-gated)
  if (model.showTableStatusCard && data.totalTablesCount !== null) {
    const hasTables = data.totalTablesCount > 0;
    cards.push(
      <Card key="tables-status" className="p-5 hover:border-zinc-300 transition-all shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Floor Tables</span>
            <Badge variant={data.availableTablesCount ? 'success' : 'neutral'}>
              {data.availableTablesCount ?? 0} Free
            </Badge>
          </div>
          <div className="mt-3">
            {hasTables ? (
              <p className="text-3xl font-extrabold text-zinc-950 tracking-tight">{data.totalTablesCount}</p>
            ) : (
              <p className="text-sm font-semibold text-zinc-400 mt-1">No tables configured</p>
            )}
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between text-xs">
          <span className="text-zinc-500 font-medium">
            {data.occupiedTablesCount ? `${data.occupiedTablesCount} seated` : 'Floor ready'}
          </span>
          <Link href="/dashboard/dining" className="font-bold text-zinc-900 hover:text-zinc-600">
            Dining →
          </Link>
        </div>
      </Card>
    );
  }

  // 6. Low Stock Items Card (conditional when inventory permission present and low stock exists)
  if (model.showLowStockCard && data.lowStockCount !== null && data.lowStockCount > 0) {
    cards.push(
      <Card key="low-stock" className="p-5 border-amber-200 bg-amber-50/40 hover:border-amber-300 transition-all shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800">Low Stock</span>
            <Badge variant="warning">Attention</Badge>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-extrabold text-amber-900 tracking-tight">{data.lowStockCount}</p>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-amber-200/60 flex items-center justify-between text-xs">
          <span className="text-amber-800 font-medium">Below threshold</span>
          <Link href="/dashboard/inventory" className="font-bold text-amber-900 hover:underline">
            Restock →
          </Link>
        </div>
      </Card>
    );
  }

  if (cards.length === 0) return null;

  return (
    <section aria-label="Today's Overview" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Today&apos;s Performance</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards}
      </div>
    </section>
  );
};
