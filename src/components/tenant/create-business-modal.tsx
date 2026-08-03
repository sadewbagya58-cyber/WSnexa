'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { createBusinessAction } from '@/server/actions/tenant';

export const CreateBusinessModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      businessType: (formData.get('businessType') as string) || 'restaurant',
      countryCode: (formData.get('countryCode') as string) || 'US',
      defaultCurrency: (formData.get('defaultCurrency') as string) || 'USD',
      timezone: (formData.get('timezone') as string) || 'UTC',
      branchName: (formData.get('branchName') as string) || 'Main Branch',
      branchCode: (formData.get('branchCode') as string) || 'MAIN',
    };

    try {
      const res = await createBusinessAction(data);
      if (!res.success) {
        setErrorMessage(res.message || 'Failed to create business.');
      } else {
        setIsOpen(false);
        window.location.reload();
      }
    } catch {
      setErrorMessage('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <Button onClick={() => setIsOpen(true)}>
        + Create New Business
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-lg space-y-4 p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
          <h2 className="text-lg font-bold text-zinc-950">Create New Business</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="text-xs font-semibold text-zinc-500 hover:text-zinc-950"
          >
            ✕ Close
          </button>
        </div>

        {errorMessage && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-700" htmlFor="name">
              Business Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="e.g. Aura Grand Bistro"
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700" htmlFor="businessType">
                Business Type
              </label>
              <select
                id="businessType"
                name="businessType"
                defaultValue="restaurant"
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
              >
                <option value="restaurant">Restaurant</option>
                <option value="cafe">Café</option>
                <option value="hotel">Hotel</option>
                <option value="resort">Resort</option>
                <option value="food_court">Food Court</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700" htmlFor="defaultCurrency">
                Default Currency
              </label>
              <input
                id="defaultCurrency"
                name="defaultCurrency"
                type="text"
                defaultValue="USD"
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700" htmlFor="branchName">
                Initial Branch Name
              </label>
              <input
                id="branchName"
                name="branchName"
                type="text"
                defaultValue="Main Branch"
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700" htmlFor="branchCode">
                Branch Code
              </label>
              <input
                id="branchCode"
                name="branchCode"
                type="text"
                defaultValue="MAIN"
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Business'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
