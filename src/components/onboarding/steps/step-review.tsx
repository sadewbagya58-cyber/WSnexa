'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FullOnboardingPayload } from '@/lib/validation/onboarding';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface StepReviewProps {
  payload: FullOnboardingPayload;
  onBack: () => void;
  onGoToStep: (step: string) => void;
  onSubmit: () => Promise<void>;
}

export const StepReview: React.FC<StepReviewProps> = ({
  payload,
  onBack,
  onGoToStep,
  onSubmit,
}) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFinalSubmit = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await onSubmit();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred during onboarding submission.';
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  const { business, location, hours, branding } = payload;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-zinc-950">5. Review & Confirm</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Review your business settings before finalizing creation.
        </p>
      </div>

      {errorMsg && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {errorMsg}
        </div>
      )}

      {/* Business Summary */}
      <Card className="p-4 space-y-2">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Business Profile</h3>
          <button
            type="button"
            onClick={() => onGoToStep('business')}
            className="text-xs font-semibold text-zinc-900 underline"
          >
            Edit
          </button>
        </div>
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="text-zinc-500">Name</dt>
            <dd className="font-semibold text-zinc-900">{business?.name}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Type</dt>
            <dd className="font-semibold text-zinc-900">{business?.businessType}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Country & Currency</dt>
            <dd className="text-zinc-900">{business?.countryCode} ({business?.defaultCurrency})</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Timezone</dt>
            <dd className="text-zinc-900">{business?.timezone}</dd>
          </div>
        </dl>
      </Card>

      {/* Location Summary */}
      <Card className="p-4 space-y-2">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Primary Branch & Location</h3>
          <button
            type="button"
            onClick={() => onGoToStep('location')}
            className="text-xs font-semibold text-zinc-900 underline"
          >
            Edit
          </button>
        </div>
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="text-zinc-500">Default Branch Name</dt>
            <dd className="font-semibold text-zinc-900">{location?.branchName || 'Main Branch'}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Branch Code</dt>
            <dd className="font-mono text-zinc-900">{location?.branchCode || 'MAIN'}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Contact Email</dt>
            <dd className="text-zinc-900">{location?.email || 'N/A'}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Contact Phone</dt>
            <dd className="text-zinc-900">{location?.phone || 'N/A'}</dd>
          </div>
        </dl>
      </Card>

      {/* Operating Hours Summary */}
      <Card className="p-4 space-y-2">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Operating Hours</h3>
          <button
            type="button"
            onClick={() => onGoToStep('hours')}
            className="text-xs font-semibold text-zinc-900 underline"
          >
            Edit
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          {hours?.hours?.map((h) => (
            <div key={h.dayOfWeek} className="rounded bg-zinc-50 p-2">
              <span className="font-bold text-zinc-900">{DAYS[h.dayOfWeek]}: </span>
              {h.isClosed ? (
                <span className="text-red-600">Closed</span>
              ) : (
                <span className="text-zinc-700">{h.opensAt} - {h.closesAt}</span>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Logo Summary */}
      <Card className="p-4 space-y-2">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Branding</h3>
          <button
            type="button"
            onClick={() => onGoToStep('branding')}
            className="text-xs font-semibold text-zinc-900 underline"
          >
            Edit
          </button>
        </div>
        <div className="flex items-center gap-4 text-xs">
          {branding?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt="Logo" className="h-12 w-12 object-contain" />
          ) : (
            <span className="text-zinc-400">No logo uploaded.</span>
          )}
        </div>
      </Card>

      <div className="flex justify-between pt-4">
        <Button variant="outline" type="button" onClick={onBack} disabled={loading}>
          ← Back
        </Button>
        <Button type="button" onClick={handleFinalSubmit} disabled={loading}>
          {loading ? 'Creating Business...' : '🚀 Finalize & Launch Business'}
        </Button>
      </div>
    </div>
  );
};
