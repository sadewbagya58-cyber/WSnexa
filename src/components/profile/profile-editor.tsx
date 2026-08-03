'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { updateProfileAction } from '@/server/actions/auth';

interface ProfileEditorProps {
  initialProfile: {
    firstName: string;
    lastName: string | null;
    phone: string | null;
    avatarUrl: string | null;
    preferredLanguage: string;
  };
}

export const ProfileEditor: React.FC<ProfileEditorProps> = ({ initialProfile }) => {
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      firstName: formData.get('firstName') as string,
      lastName: (formData.get('lastName') as string) || null,
      phone: (formData.get('phone') as string) || null,
      avatarUrl: (formData.get('avatarUrl') as string) || null,
      preferredLanguage: (formData.get('preferredLanguage') as string) || 'en',
    };

    try {
      const res = await updateProfileAction(data);
      if (!res.success) {
        setErrorMessage(res.message || 'Failed to update profile.');
      } else {
        setSuccessMessage(res.message || 'Profile updated successfully.');
      }
    } catch {
      setErrorMessage('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          {successMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-zinc-700" htmlFor="firstName">
            First Name <span className="text-red-500">*</span>
          </label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            required
            defaultValue={initialProfile.firstName}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-700" htmlFor="lastName">
            Last Name
          </label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            defaultValue={initialProfile.lastName || ''}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-zinc-700" htmlFor="phone">
            Phone Number
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            placeholder="+1 555-0199"
            defaultValue={initialProfile.phone || ''}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-700" htmlFor="preferredLanguage">
            Preferred Language
          </label>
          <select
            id="preferredLanguage"
            name="preferredLanguage"
            defaultValue={initialProfile.preferredLanguage || 'en'}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
          >
            <option value="en">English (US)</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-700" htmlFor="avatarUrl">
          Avatar Image URL
        </label>
        <input
          id="avatarUrl"
          name="avatarUrl"
          type="url"
          placeholder="https://example.com/avatar.jpg"
          defaultValue={initialProfile.avatarUrl || ''}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950"
        />
      </div>

      <div className="pt-2">
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? 'Saving Changes...' : 'Save Profile Changes'}
        </Button>
      </div>
    </form>
  );
};
