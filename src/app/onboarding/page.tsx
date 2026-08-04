import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard';
import { getOnboardingDraftAction } from '@/server/actions/onboarding';

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Check if user already owns an active business
  const { data: memberships } = await supabase
    .from('business_memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('membership_status', 'active');

  if (memberships && memberships.length > 0) {
    redirect('/dashboard');
  }

  // Fetch saved onboarding draft
  const draftRes = await getOnboardingDraftAction();
  const initialStep = draftRes.data?.currentStep || 'business';
  const initialPayload = draftRes.data?.payload || {};

  return (
    <div className="min-h-screen bg-zinc-50">
      <OnboardingWizard initialStep={initialStep} initialPayload={initialPayload} />
    </div>
  );
}
