'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { StepBusiness } from './steps/step-business';
import { StepLocation } from './steps/step-location';
import { StepHours } from './steps/step-hours';
import { StepBranding } from './steps/step-branding';
import { StepReview } from './steps/step-review';
import { saveOnboardingDraftAction, completeOnboardingAction } from '@/server/actions/onboarding';
import { FullOnboardingPayload } from '@/lib/validation/onboarding';

const STEPS = [
  { id: 'business', label: '1. Profile' },
  { id: 'location', label: '2. Location' },
  { id: 'hours', label: '3. Hours' },
  { id: 'branding', label: '4. Branding' },
  { id: 'review', label: '5. Review' },
];

interface OnboardingWizardProps {
  initialStep?: string;
  initialPayload?: Partial<FullOnboardingPayload>;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  initialStep = 'business',
  initialPayload = {},
}) => {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<string>(initialStep);
  const [payload, setPayload] = useState<Partial<FullOnboardingPayload>>(initialPayload);

  const activeIndex = STEPS.findIndex((s) => s.id === currentStep);

  const saveStepData = async (stepKey: keyof FullOnboardingPayload, data: Record<string, unknown>, nextStep: string) => {
    const updatedPayload = { ...payload, [stepKey]: data };
    setPayload(updatedPayload);
    setCurrentStep(nextStep);

    // Save draft server-side
    await saveOnboardingDraftAction(nextStep, data);
  };

  const handleGoToStep = (stepId: string) => {
    setCurrentStep(stepId);
  };

  const handleFinalSubmit = async () => {
    const fullData: FullOnboardingPayload = {
      business: payload.business || {
        name: '',
        businessType: 'restaurant',
        countryCode: 'US',
        defaultCurrency: 'USD',
        timezone: 'UTC',
      },
      location: payload.location || {
        branchName: 'Main Branch',
        branchCode: 'MAIN',
      },
      hours: payload.hours || {
        hours: Array.from({ length: 7 }, (_, i) => ({
          dayOfWeek: i,
          isClosed: false,
          opensAt: '08:00',
          closesAt: '22:00',
        })),
      },
      branding: payload.branding || { logoUrl: null },
    };

    const res = await completeOnboardingAction(fullData);
    if (!res.success) {
      throw new Error(res.message || 'Failed to complete business onboarding.');
    }

    router.push('/dashboard');
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-950">
          WSNexa Business Setup
        </h1>
        <p className="mt-1 text-xs text-zinc-500">
          Complete the onboarding wizard to configure your multi-tenant operating system.
        </p>
      </div>

      {/* Progress Step Indicator */}
      <div className="mb-8 flex items-center justify-between border-b border-zinc-200 pb-4">
        {STEPS.map((s, idx) => {
          const isActive = s.id === currentStep;
          const isCompleted = idx < activeIndex;

          return (
            <button
              key={s.id}
              onClick={() => isCompleted && handleGoToStep(s.id)}
              disabled={!isCompleted && !isActive}
              className={`flex items-center text-xs font-semibold ${
                isActive
                  ? 'text-zinc-950 underline underline-offset-4'
                  : isCompleted
                  ? 'text-zinc-700 hover:text-zinc-950 cursor-pointer'
                  : 'text-zinc-400 cursor-not-allowed'
              }`}
            >
              <span
                className={`mr-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                  isActive
                    ? 'bg-zinc-950 text-white'
                    : isCompleted
                    ? 'bg-zinc-200 text-zinc-800'
                    : 'bg-zinc-100 text-zinc-400'
                }`}
              >
                {idx + 1}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* Step Render Card */}
      <Card className="p-6 shadow-sm">
        {currentStep === 'business' && (
          <StepBusiness
            initialData={payload.business}
            onNext={(data) => saveStepData('business', data, 'location')}
          />
        )}

        {currentStep === 'location' && (
          <StepLocation
            initialData={payload.location}
            onBack={() => setCurrentStep('business')}
            onNext={(data) => saveStepData('location', data, 'hours')}
          />
        )}

        {currentStep === 'hours' && (
          <StepHours
            initialData={payload.hours}
            onBack={() => setCurrentStep('location')}
            onNext={(data) => saveStepData('hours', data, 'branding')}
          />
        )}

        {currentStep === 'branding' && (
          <StepBranding
            initialData={payload.branding}
            onBack={() => setCurrentStep('hours')}
            onNext={(data) => saveStepData('branding', data, 'review')}
          />
        )}

        {currentStep === 'review' && (
          <StepReview
            payload={payload as FullOnboardingPayload}
            onBack={() => setCurrentStep('branding')}
            onGoToStep={handleGoToStep}
            onSubmit={handleFinalSubmit}
          />
        )}
      </Card>
    </div>
  );
};
