'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { BusinessProfileInput, BUSINESS_TYPES } from '@/lib/validation/onboarding';

interface StepBusinessProps {
  initialData?: Partial<BusinessProfileInput>;
  onNext: (data: BusinessProfileInput) => void;
}

export const StepBusiness: React.FC<StepBusinessProps> = ({ initialData, onNext }) => {
  const [formData, setFormData] = React.useState<BusinessProfileInput>({
    name: initialData?.name || '',
    businessType: initialData?.businessType || 'restaurant',
    description: initialData?.description || '',
    countryCode: initialData?.countryCode || 'US',
    defaultCurrency: initialData?.defaultCurrency || 'USD',
    timezone: initialData?.timezone || 'UTC',
  });

  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrors({ name: 'Business name is required' });
      return;
    }
    setErrors({});
    onNext(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-zinc-950">1. Business Profile</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Tell us about your hospitality business to customize your operating system.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-xs font-medium text-zinc-700">
            Business Name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Aura Grand Bistro & Lounge"
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
          />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
        </div>

        <div>
          <label htmlFor="businessType" className="block text-xs font-medium text-zinc-700">
            Business Type <span className="text-red-500">*</span>
          </label>
          <select
            id="businessType"
            value={formData.businessType}
            onChange={(e) => setFormData({ ...formData, businessType: e.target.value as BusinessProfileInput['businessType'] })}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
          >
            {BUSINESS_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace('_', ' ').toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="description" className="block text-xs font-medium text-zinc-700">
            Short Description (Optional)
          </label>
          <textarea
            id="description"
            rows={3}
            value={formData.description || ''}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Briefly describe your concept or cuisine..."
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="countryCode" className="block text-xs font-medium text-zinc-700">
              Country
            </label>
            <input
              id="countryCode"
              type="text"
              value={formData.countryCode}
              onChange={(e) => setFormData({ ...formData, countryCode: e.target.value.toUpperCase() })}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
            />
          </div>

          <div>
            <label htmlFor="defaultCurrency" className="block text-xs font-medium text-zinc-700">
              Currency
            </label>
            <input
              id="defaultCurrency"
              type="text"
              value={formData.defaultCurrency}
              onChange={(e) => setFormData({ ...formData, defaultCurrency: e.target.value.toUpperCase() })}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
            />
          </div>

          <div>
            <label htmlFor="timezone" className="block text-xs font-medium text-zinc-700">
              Timezone
            </label>
            <input
              id="timezone"
              type="text"
              value={formData.timezone}
              onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button type="submit">
          Continue to Contact & Location →
        </Button>
      </div>
    </form>
  );
};
