'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { ContactLocationInput } from '@/lib/validation/onboarding';

interface StepLocationProps {
  initialData?: Partial<ContactLocationInput>;
  onBack: () => void;
  onNext: (data: ContactLocationInput) => void;
}

export const StepLocation: React.FC<StepLocationProps> = ({ initialData, onBack, onNext }) => {
  const [formData, setFormData] = React.useState<ContactLocationInput>({
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    website: initialData?.website || '',
    addressLine1: initialData?.addressLine1 || '',
    addressLine2: initialData?.addressLine2 || '',
    city: initialData?.city || '',
    region: initialData?.region || '',
    postalCode: initialData?.postalCode || '',
    branchName: initialData?.branchName || 'Main Branch',
    branchCode: initialData?.branchCode || 'MAIN',
  });

  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.branchName.trim()) {
      newErrors.branchName = 'Branch name is required';
    }

    if (!formData.branchCode.trim()) {
      newErrors.branchCode = 'Branch code is required';
    }

    if (formData.email && formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        newErrors.email = 'Invalid email address';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    onNext(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-zinc-950">2. Contact & Primary Location</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Provide contact details and initial main branch location info.
        </p>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="branchName" className="block text-xs font-medium text-zinc-700">
              Branch Name <span className="text-red-500">*</span>
            </label>
            <input
              id="branchName"
              type="text"
              required
              value={formData.branchName}
              onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
            />
            {errors.branchName && <p className="mt-1 text-xs text-red-600">{errors.branchName}</p>}
          </div>

          <div>
            <label htmlFor="branchCode" className="block text-xs font-medium text-zinc-700">
              Branch Code <span className="text-red-500">*</span>
            </label>
            <input
              id="branchCode"
              type="text"
              required
              value={formData.branchCode}
              onChange={(e) => setFormData({ ...formData, branchCode: e.target.value.toUpperCase() })}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
            />
            {errors.branchCode && <p className="mt-1 text-xs text-red-600">{errors.branchCode}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-zinc-700">
              Business Email (Optional)
            </label>
            <input
              id="email"
              type="email"
              value={formData.email || ''}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="contact@business.com"
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-xs font-medium text-zinc-700">
              Business Phone (Optional)
            </label>
            <input
              id="phone"
              type="tel"
              value={formData.phone || ''}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+1 (555) 000-0000"
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
            />
          </div>
        </div>

        <div>
          <label htmlFor="addressLine1" className="block text-xs font-medium text-zinc-700">
            Address Line 1 (Optional)
          </label>
          <input
            id="addressLine1"
            type="text"
            value={formData.addressLine1 || ''}
            onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
            placeholder="123 Main Street"
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="city" className="block text-xs font-medium text-zinc-700">
              City
            </label>
            <input
              id="city"
              type="text"
              value={formData.city || ''}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
            />
          </div>

          <div>
            <label htmlFor="region" className="block text-xs font-medium text-zinc-700">
              State / Region
            </label>
            <input
              id="region"
              type="text"
              value={formData.region || ''}
              onChange={(e) => setFormData({ ...formData, region: e.target.value })}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
            />
          </div>

          <div>
            <label htmlFor="postalCode" className="block text-xs font-medium text-zinc-700">
              Postal Code
            </label>
            <input
              id="postalCode"
              type="text"
              value={formData.postalCode || ''}
              onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="outline" type="button" onClick={onBack}>
          ← Back
        </Button>
        <Button type="submit">
          Continue to Operating Hours →
        </Button>
      </div>
    </form>
  );
};
