import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard';
import { getOnboardingDraftAction } from '@/server/actions/onboarding';

export default async function OnboardingHoursPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const draftRes = await getOnboardingDraftAction();

  return (
    <div className="min-h-screen bg-zinc-50">
      <OnboardingWizard initialStep="hours" initialPayload={draftRes.data?.payload || {}} />
    </div>
  );
}
