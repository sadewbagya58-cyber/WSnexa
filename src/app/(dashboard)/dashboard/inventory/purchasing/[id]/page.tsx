import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { PurchasingService } from '@/server/services/purchasing.service';
import { formatCurrencyMinor } from '@/lib/utils/currency';
import { PurchaseOrderActions } from '@/components/inventory/purchase-order-actions';

interface PurchaseOrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: 'Purchase Order Details | WSNexa Purchasing',
  description: 'Detailed purchase order view, receiving status, and line items',
};

export default async function PurchaseOrderDetailPage({ params }: PurchaseOrderDetailPageProps) {
  const { id } = await params;
  const po = await PurchasingService.getPurchaseOrderById(id);

  if (!po) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Header Navigation */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/inventory/purchasing"
            className="px-3 py-1.5 text-sm font-medium border border-zinc-200 rounded-xl hover:bg-zinc-50 transition"
          >
            ← Back
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
                {po.poNumber}
              </h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${
                po.status === 'received'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : po.status === 'partially_received'
                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                  : po.status === 'approved'
                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                  : po.status === 'cancelled'
                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                  : 'bg-zinc-100 text-zinc-800 border border-zinc-200'
              }`}>
                {po.status.replace('_', ' ')}
              </span>
            </div>
            <p className="text-sm text-zinc-500 mt-1">
              Created on {new Date(po.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <PurchaseOrderActions
          poId={po.id}
          poNumber={po.poNumber}
          status={po.status}
          variant="detail"
        />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
          <div className="text-xs font-semibold uppercase text-zinc-500">
            Supplier
          </div>
          <div className="mt-2 text-lg font-bold text-zinc-900">
            {po.supplierName}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
          <div className="text-xs font-semibold uppercase text-zinc-500">
            Delivery Location
          </div>
          <div className="mt-2 text-lg font-bold text-zinc-900">
            {po.destinationLocationName}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
          <div className="text-xs font-semibold uppercase text-zinc-500">
            Expected Date
          </div>
          <div className="mt-2 text-lg font-bold text-zinc-900">
            {po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString() : 'Immediate'}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
          <div className="text-xs font-semibold uppercase text-zinc-500">
            Total Order Value
          </div>
          <div className="mt-2 text-lg font-bold text-emerald-600">
            {formatCurrencyMinor(po.totalCents, po.currency)}
          </div>
        </div>
      </div>

      {/* Ordered Items Table */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-xs overflow-hidden">
        <div className="border-b border-zinc-200 px-5 sm:px-6 py-4">
          <h2 className="text-base font-semibold text-zinc-900">
            Purchase Order Line Items ({po.items.length})
          </h2>
        </div>

        {/* Mobile Line Items Cards View */}
        <div className="grid grid-cols-1 gap-3 p-4 md:hidden">
          {po.items.map((item) => (
            <div
              key={item.id}
              className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-2.5 text-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-bold text-zinc-950 text-sm truncate flex-1">
                  🥦 {item.itemName}
                </span>
                <span className="font-mono font-bold text-zinc-950 text-xs">
                  {formatCurrencyMinor(item.totalCostCents, po.currency)}
                </span>
              </div>

              <div className="bg-white rounded-lg p-2.5 border border-zinc-200/70 space-y-1.5 text-[11px]">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Ordered Quantity:</span>
                  <span className="font-bold text-zinc-900">
                    {item.quantityOrdered} {item.purchasingUnit}
                  </span>
                </div>

                <div className="flex justify-between items-center text-zinc-500 border-t border-zinc-100 pt-1.5">
                  <span>Received Base Units:</span>
                  <span className="font-mono text-zinc-700">{item.quantityReceivedBase} base</span>
                </div>

                <div className="flex justify-between items-center border-t border-zinc-100 pt-1.5">
                  <span className="text-zinc-500">Unit Price:</span>
                  <span className="font-mono font-semibold text-zinc-800">
                    {formatCurrencyMinor(item.unitCostCents, po.currency)} / {item.purchasingUnit}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Line Items Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50/50 text-xs font-semibold text-zinc-500 uppercase">
              <tr>
                <th className="px-6 py-3">Item</th>
                <th className="px-6 py-3">Ordered</th>
                <th className="px-6 py-3">Received Base</th>
                <th className="px-6 py-3">Unit Price</th>
                <th className="px-6 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {po.items.map((item) => (
                <tr key={item.id} className="hover:bg-zinc-50/50">
                  <td className="px-6 py-4 font-medium text-zinc-900">
                    {item.itemName}
                  </td>
                  <td className="px-6 py-4 text-zinc-700">
                    {item.quantityOrdered} {item.purchasingUnit}
                  </td>
                  <td className="px-6 py-4 text-zinc-500 font-mono text-xs">
                    {item.quantityReceivedBase} base
                  </td>
                  <td className="px-6 py-4 text-zinc-700">
                    {formatCurrencyMinor(item.unitCostCents, po.currency)}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-zinc-900">
                    {formatCurrencyMinor(item.totalCostCents, po.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {po.notes && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
          <h3 className="text-sm font-semibold text-zinc-900 mb-2">
            Order Notes & Instructions
          </h3>
          <p className="text-sm text-zinc-600">{po.notes}</p>
        </div>
      )}
    </div>
  );
}
