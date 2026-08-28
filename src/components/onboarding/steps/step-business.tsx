'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { BusinessProfileInput, BUSINESS_TYPES, normalizeCountryCode } from '@/lib/validation/onboarding';

interface StepBusinessProps {
  initialData?: Partial<BusinessProfileInput>;
  onNext: (data: BusinessProfileInput) => void;
}

const COMMON_COUNTRIES = [
  { code: 'US', label: 'United States (US)', currency: 'USD', timezone: 'America/New_York' },
  { code: 'LK', label: 'Sri Lanka (LK)', currency: 'LKR', timezone: 'Asia/Colombo' },
  { code: 'GB', label: 'United Kingdom (GB)', currency: 'GBP', timezone: 'Europe/London' },
  { code: 'AE', label: 'United Arab Emirates (AE)', currency: 'AED', timezone: 'Asia/Dubai' },
  { code: 'SG', label: 'Singapore (SG)', currency: 'SGD', timezone: 'Asia/Singapore' },
  { code: 'MV', label: 'Maldives (MV)', currency: 'MVR', timezone: 'Indian/Maldives' },
  { code: 'IN', label: 'India (IN)', currency: 'INR', timezone: 'Asia/Kolkata' },
  { code: 'AU', label: 'Australia (AU)', currency: 'AUD', timezone: 'Australia/Sydney' },
  { code: 'CA', label: 'Canada (CA)', currency: 'CAD', timezone: 'America/Toronto' },
];

export const StepBusiness: React.FC<StepBusinessProps> = ({ initialData, onNext }) => {
  const initialCountry = normalizeCountryCode(initialData?.countryCode || 'US');
  const [formData, setFormData] = React.useState<BusinessProfileInput>({
    name: initialData?.name || '',
    businessType: initialData?.businessType || 'restaurant',
    description: initialData?.description || '',
    countryCode: initialCountry,
    defaultCurrency: (initialData?.defaultCurrency || 'USD').toUpperCase(),
    timezone: initialData?.timezone || 'UTC',
  });

  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const handleCountryChange = (val: string) => {
    const norm = normalizeCountryCode(val);
    const matched = COMMON_COUNTRIES.find((c) => c.code === norm);

    setFormData((prev) => ({
      ...prev,
      countryCode: norm,
      defaultCurrency: matched ? matched.currency : prev.defaultCurrency,
      timezone: matched && prev.timezone === 'UTC' ? matched.timezone : prev.timezone,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Business name is required';
    }

    const normCountry = normalizeCountryCode(formData.countryCode);
    if (!normCountry || normCountry.length !== 2) {
      newErrors.countryCode = 'Valid 2-character country code required (e.g. LK, US)';
    }

    const normCurrency = formData.defaultCurrency.trim().toUpperCase();
    if (!normCurrency || normCurrency.length !== 3) {
      newErrors.defaultCurrency = 'Valid 3-character currency code required (e.g. LKR, USD)';
    }

    if (!formData.timezone.trim()) {
      newErrors.timezone = 'Timezone is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    onNext({
      ...formData,
      countryCode: normCountry,
      defaultCurrency: normCurrency,
    });
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
            placeholder="e.g. Nexa Grand Hotel"
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="countryCode" className="block text-xs font-medium text-zinc-700">
              Country <span className="text-red-500">*</span>
            </label>
            <div className="mt-1 space-y-1">
              <select
                id="countrySelect"
                value={COMMON_COUNTRIES.some((c) => c.code === formData.countryCode) ? formData.countryCode : 'OTHER'}
                onChange={(e) => {
                  if (e.target.value !== 'OTHER') {
                    handleCountryChange(e.target.value);
                  }
                }}
                className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-xs text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
              >
                {COMMON_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
                <option value="OTHER">Other (Specify Code / Name)</option>
              </select>
              <input
                id="countryCode"
                type="text"
                value={formData.countryCode}
                onChange={(e) => handleCountryChange(e.target.value)}
                placeholder="2-letter code (e.g. LK)"
                maxLength={20}
                className="block w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-900 font-mono shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
              />
            </div>
            {errors.countryCode && <p className="mt-1 text-xs text-red-600">{errors.countryCode}</p>}
          </div>

          <div>
            <label htmlFor="defaultCurrency" className="block text-xs font-medium text-zinc-700">
              Currency <span className="text-red-500">*</span>
            </label>
            <input
              id="defaultCurrency"
              type="text"
              required
              maxLength={3}
              value={formData.defaultCurrency}
              onChange={(e) => setFormData({ ...formData, defaultCurrency: e.target.value.toUpperCase() })}
              placeholder="e.g. LKR, USD"
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-mono text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
            />
            {errors.defaultCurrency && <p className="mt-1 text-xs text-red-600">{errors.defaultCurrency}</p>}
          </div>

          <div>
            <label htmlFor="timezone" className="block text-xs font-medium text-zinc-700">
              Timezone <span className="text-red-500">*</span>
            </label>
            <input
              id="timezone"
              type="text"
              required
              value={formData.timezone}
              onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
              placeholder="e.g. Asia/Colombo"
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
            />
            {errors.timezone && <p className="mt-1 text-xs text-red-600">{errors.timezone}</p>}
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
