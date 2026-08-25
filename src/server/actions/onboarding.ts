'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { generateSlug, appendSlugSuffix } from '@/lib/tenant/slug';
import { ACTIVE_BUSINESS_COOKIE, getCurrentUser } from '@/server/tenant/resolver';
import { fullOnboardingSchema, FullOnboardingPayload } from '@/lib/validation/onboarding';
import { ActionResponse } from './auth';
import { Json } from '@/types/database.types';

/**
 * Saves onboarding progress into onboarding_drafts table server-side.
 */
export async function saveOnboardingDraftAction(
  step: string,
  stepPayload: Record<string, unknown>
): Promise<ActionResponse<{ currentStep: string }>> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, message: 'Unauthorized session.' };
  }

  const supabase = await createClient();

  // Fetch existing draft
  const { data: existingDraft } = await supabase
    .from('onboarding_drafts')
    .select('*')
    .eq('user_id', user.id)
    .single();

  const currentPayload = (existingDraft?.payload as Record<string, unknown>) || {};
  const updatedPayload = { ...currentPayload, [step]: stepPayload };

  const { error: draftError } = await supabase
    .from('onboarding_drafts')
    .upsert({
      user_id: user.id,
      current_step: step,
      payload: updatedPayload as unknown as Json,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  if (draftError) {
    return { success: false, message: 'Failed to save onboarding progress.' };
  }

  // Update profile status to in_progress
  await supabase
    .from('user_profiles')
    .update({ onboarding_status: 'in_progress' })
    .eq('id', user.id);

  return {
    success: true,
    message: 'Progress saved.',
    data: { currentStep: step },
  };
}

/**
 * Fetches user's saved onboarding draft.
 */
export async function getOnboardingDraftAction(): Promise<
  ActionResponse<{ currentStep: string; payload: Partial<FullOnboardingPayload> }>
> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, message: 'Unauthorized.' };
  }

  const supabase = await createClient();
  const { data: draft } = await supabase
    .from('onboarding_drafts')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!draft) {
    return {
      success: true,
      data: { currentStep: 'business', payload: {} },
    };
  }

  return {
    success: true,
    data: {
      currentStep: draft.current_step,
      payload: (draft.payload as unknown as Partial<FullOnboardingPayload>) || {},
    },
  };
}

/**
 * Completes onboarding atomically by validating draft payload and executing PostgreSQL RPC.
 */
export async function completeOnboardingAction(
  rawPayload: FullOnboardingPayload
): Promise<ActionResponse<{ businessId: string; slug: string }>> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, message: 'Unauthorized session.' };
  }

  const supabase = await createClient();

  // Check double submission guard
  const { data: existingMem } = await supabase
    .from('business_memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('role', 'business_owner')
    .eq('membership_status', 'active')
    .single();

  if (existingMem) {
    return { success: false, message: 'You have already completed onboarding and created a business.' };
  }

  // Validate full payload using Zod
  const parsed = fullOnboardingSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Onboarding validation failed. Please check all steps.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const { business, location, hours, branding } = parsed.data;

  // Generate URL slug with collision resolution
  let slug = generateSlug(business.name);
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 5) {
    const { data: existing } = await supabase
      .from('businesses')
      .select('id')
      .eq('slug', slug)
      .single();

    if (!existing) {
      isUnique = true;
    } else {
      slug = appendSlugSuffix(generateSlug(business.name));
      attempts++;
    }
  }

  // Convert operating hours format for PostgreSQL RPC
  const formattedHours = hours.hours.map((h) => ({
    day_of_week: h.dayOfWeek,
    is_closed: h.isClosed,
    opens_at: h.opensAt.length === 5 ? `${h.opensAt}:00` : h.opensAt,
    closes_at: h.closesAt.length === 5 ? `${h.closesAt}:00` : h.closesAt,
  }));

  // Execute atomic completion RPC
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    'complete_business_onboarding',
    {
      p_name: business.name,
      p_slug: slug,
      p_business_type: business.businessType,
      p_description: business.description || null,
      p_country_code: business.countryCode,
      p_default_currency: business.defaultCurrency,
      p_timezone: business.timezone,
      p_email: location.email || null,
      p_phone: location.phone || null,
      p_website: location.website || null,
      p_logo_url: branding.logoUrl || null,
      p_branch_name: location.branchName,
      p_branch_code: location.branchCode,
      p_branch_address_line_1: location.addressLine1 || null,
      p_branch_address_line_2: location.addressLine2 || null,
      p_branch_city: location.city || null,
      p_branch_region: location.region || null,
      p_branch_postal_code: location.postalCode || null,
      p_hours: formattedHours as unknown as Json,
    }
  );

  if (rpcError) {
    return {
      success: false,
      message: rpcError.message || 'Failed to complete onboarding transaction.',
    };
  }

  const result = rpcData as { business_id: string; slug: string };

  // Provision initial 14-day Starter trial subscription
  try {
    const { SubscriptionService } = await import('@/server/services/subscription.service');
    await SubscriptionService.createTrialSubscription(result.business_id, user.id);
  } catch (subErr) {
    console.warn('[completeOnboardingAction] Subscription trial provisioning warning:', subErr);
  }

  // Set active business cookie
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BUSINESS_COOKIE, result.business_id, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  revalidatePath('/dashboard');
  revalidatePath('/onboarding');

  return {
    success: true,
    message: 'Onboarding completed successfully!',
    data: {
      businessId: result.business_id,
      slug: result.slug,
    },
  };
}
