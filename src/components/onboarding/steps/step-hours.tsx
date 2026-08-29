'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { OperatingHoursInput, OperatingDayInput } from '@/lib/validation/onboarding';

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

interface StepHoursProps {
  initialData?: Partial<OperatingHoursInput>;
  onBack: () => void;
  onNext: (data: OperatingHoursInput) => void;
}

export const StepHours: React.FC<StepHoursProps> = ({ initialData, onBack, onNext }) => {
  const defaultHours: OperatingDayInput[] = DAYS_OF_WEEK.map((_, idx) => ({
    dayOfWeek: idx,
    isClosed: false,
    opensAt: '08:00',
    closesAt: '22:00',
  }));

  const [hours, setHours] = React.useState<OperatingDayInput[]>(
    initialData?.hours || defaultHours
  );

  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const handleToggleClosed = (idx: number) => {
    const updated = [...hours];
    updated[idx].isClosed = !updated[idx].isClosed;
    setHours(updated);
  };

  const handleTimeChange = (idx: number, field: 'opensAt' | 'closesAt', val: string) => {
    const updated = [...hours];
    updated[idx][field] = val;
    setHours(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validate opening and closing times
    for (const h of hours) {
      if (!h.isClosed && (!h.opensAt || !h.closesAt)) {
        setErrorMsg(`Invalid hours for ${DAYS_OF_WEEK[h.dayOfWeek]}: Please specify both opening and closing times.`);
        return;
      }
    }

    onNext({ hours });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-zinc-950">3. Operating Hours</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Set regular opening and closing times for your main branch.
        </p>
      </div>

      {errorMsg && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {errorMsg}
        </div>
      )}

      <div className="space-y-3">
        {hours.map((day, idx) => (
          <div
            key={day.dayOfWeek}
            className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-3 sm:w-32">
              <input
                type="checkbox"
                id={`closed-${idx}`}
                checked={!day.isClosed}
                onChange={() => handleToggleClosed(idx)}
                className="h-4 w-4 rounded border-zinc-300 text-zinc-950 focus:ring-zinc-950"
              />
              <label htmlFor={`closed-${idx}`} className="text-xs font-semibold text-zinc-900">
                {DAYS_OF_WEEK[day.dayOfWeek]}
              </label>
            </div>

            {day.isClosed ? (
              <span className="text-xs font-medium text-red-600">Closed</span>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={day.opensAt}
                  onChange={(e) => handleTimeChange(idx, 'opensAt', e.target.value)}
                  className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none"
                />
                <span className="text-xs text-zinc-400">to</span>
                <input
                  type="time"
                  value={day.closesAt}
                  onChange={(e) => handleTimeChange(idx, 'closesAt', e.target.value)}
                  className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="outline" type="button" onClick={onBack}>
          ← Back
        </Button>
        <Button type="submit">
          Continue to Branding & Logo →
        </Button>
      </div>
    </form>
  );
};
