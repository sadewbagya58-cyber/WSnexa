'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { generateSlug, appendSlugSuffix } from '@/lib/tenant/slug';
import { ACTIVE_BUSINESS_COOKIE, getCurrentUser } from '@/server/tenant/resolver';
import { ActionResponse } from './auth';

const createBusinessSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Business name is required')
    .max(100, 'Business name cannot exceed 100 characters'),
  businessType: z.string().default('restaurant'),
  countryCode: z.string().length(2).default('US'),
  defaultCurrency: z.string().length(3).default('USD'),
  timezone: z.string().default('UTC'),
  branchName: z.string().default('Main Branch'),
  branchCode: z.string().default('MAIN'),
});

export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;

/**
 * Creates a new business, default branch, and owner membership atomically.
 */
export async function createBusinessAction(
  formData: CreateBusinessInput
): Promise<ActionResponse<{ businessId: string; slug: string }>> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      success: false,
      message: 'Unauthorized. Please sign in to create a business.',
    };
  }

  const parsed = createBusinessSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const {
    name,
    businessType,
    countryCode,
    defaultCurrency,
    timezone,
    branchName,
    branchCode,
  } = parsed.data;

  const supabase = await createClient();

  // Slug generation with collision handling
  let slug = generateSlug(name);
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
      slug = appendSlugSuffix(generateSlug(name));
      attempts++;
    }
  }

  // Execute atomic business creation via Supabase RPC or fallback client transaction
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    'create_business_with_default_branch',
    {
      p_name: name,
      p_slug: slug,
      p_business_type: businessType,
      p_country_code: countryCode,
      p_default_currency: defaultCurrency,
      p_timezone: timezone,
      p_branch_name: branchName,
      p_branch_code: branchCode,
    }
  );

  if (rpcError) {
    return {
      success: false,
      message: rpcError.message || 'Failed to create business.',
    };
  }

  const result = rpcData as { business_id: string; slug: string };

  // Set active business cookie
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BUSINESS_COOKIE, result.business_id, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  revalidatePath('/dashboard');

  return {
    success: true,
    message: 'Business created successfully!',
    data: {
      businessId: result.business_id,
      slug: result.slug,
    },
  };
}

/**
 * Switches the active business context for multi-tenant users.
 */
export async function switchActiveBusinessAction(businessId: string): Promise<ActionResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, message: 'Unauthorized.' };
  }

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from('business_memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('business_id', businessId)
    .eq('membership_status', 'active')
    .single();

  if (!membership) {
    return { success: false, message: 'Forbidden. You do not hold an active membership in this business.' };
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BUSINESS_COOKIE, businessId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  revalidatePath('/dashboard');

  return { success: true, message: 'Active business switched.' };
}
