'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createSupplierAction } from '@/server/actions/purchasing';
import { SupplierRecord } from '@/server/services/purchasing.service';

import Link from 'next/link';

interface SupplierManagerClientProps {
  initialSuppliers: SupplierRecord[];
  currency: string;
  canManage?: boolean;
}

export function SupplierManagerClient({
  initialSuppliers,
  currency,
  canManage = true,
}: SupplierManagerClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isAdding, setIsAdding] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Net 30');
  const [isPreferred, setIsPreferred] = useState(false);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setErrorMsg(null);
    startTransition(async () => {
      const res = await createSupplierAction({
        name: name.trim(),
        contactPerson: contactPerson || null,
        email: email || null,
        phone: phone || null,
        city: city || null,
        currency,
        paymentTerms: paymentTerms || null,
        isPreferred,
      });

      if (res.success) {
        setIsAdding(false);
        setName('');
        setContactPerson('');
        setEmail('');
        setPhone('');
        router.refresh();
      } else {
        setErrorMsg(res.message || 'Failed to create supplier.');
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Header Action */}
      <div className="flex justify-between items-center">
        <div>
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
            Active Vendors ({initialSuppliers.length})
          </span>
        </div>
        {canManage && (
          <Button
            size="sm"
            onClick={() => setIsAdding(!isAdding)}
            className="text-xs font-bold bg-zinc-950 text-white min-h-[40px]"
          >
            {isAdding ? '✕ Cancel' : '+ Add Supplier'}
          </Button>
        )}
      </div>

      {/* Add Supplier Form Drawer / Card */}
      {isAdding && (
        <form onSubmit={handleCreate} className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-zinc-950 uppercase tracking-wider">Add New Vendor</h3>

          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl">
              ⚠️ {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700">Vendor / Company Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Fresh Farm Produce Ltd"
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-zinc-950"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700">Contact Person</label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="e.g. John Miller"
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-zinc-950"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="orders@vendor.com"
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-zinc-950"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700">Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 0192"
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-zinc-950"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700">City / Region</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Colombo / London"
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-zinc-950"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700">Payment Terms</label>
              <input
                type="text"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="e.g. Net 30 / Cash on Delivery"
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-zinc-950"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="pref"
              checked={isPreferred}
              onChange={(e) => setIsPreferred(e.target.checked)}
              className="rounded text-zinc-950 focus:ring-zinc-950"
            />
            <label htmlFor="pref" className="text-xs font-semibold text-zinc-700">
              Mark as Preferred Supplier for automatic replenishment
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAdding(false)}
              disabled={isPending}
              className="text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="text-xs font-bold bg-zinc-950 hover:bg-zinc-800 text-white min-w-32"
            >
              {isPending ? 'Saving…' : 'Save Supplier'}
            </Button>
          </div>
        </form>
      )}

      {/* Suppliers Grid */}
      {initialSuppliers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center space-y-3">
          <div className="text-4xl">🏢</div>
          <h3 className="text-base font-bold text-zinc-900">No Suppliers Registered</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Add suppliers when you are ready to track purchase orders, price histories, and goods receiving.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {initialSuppliers.map((s) => (
            <Link
              key={s.id}
              href={`/dashboard/inventory/suppliers/${s.id}`}
              className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-3 shadow-xs hover:border-zinc-950 hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer"
            >
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-950 group-hover:text-zinc-800 flex items-center gap-1.5">
                      <span>{s.name}</span>
                      <span className="text-zinc-400 group-hover:translate-x-0.5 transition-transform">→</span>
                    </h3>
                    {s.contactPerson && (
                      <div className="text-[11px] text-zinc-500">Contact: {s.contactPerson}</div>
                    )}
                  </div>
                  {s.isPreferred && (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 uppercase whitespace-nowrap shrink-0">
                      Preferred ★
                    </span>
                  )}
                </div>

                <div className="space-y-1 text-xs text-zinc-600">
                  {s.email && <div className="truncate">✉️ {s.email}</div>}
                  {s.phone && <div>📞 {s.phone}</div>}
                  {s.city && <div>📍 {s.city}</div>}
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-100 flex justify-between items-center text-xs text-zinc-500">
                <span>Terms: {s.paymentTerms || 'Standard'}</span>
                <span className="font-bold text-zinc-900 bg-zinc-100 group-hover:bg-zinc-200 px-2 py-0.5 rounded-md transition-colors">
                  {s.itemCount} linked {s.itemCount === 1 ? 'item' : 'items'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
