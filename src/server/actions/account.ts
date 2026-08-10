'use server';

import { createClient } from '@/lib/supabase/server';
import { AccountService } from '@/server/services/account.service';
import { selectAccountTypeSchema, updateCustomerProfileSchema, SelectAccountTypeInput, UpdateCustomerProfileInput } from '@/lib/validation/account';
import { createAdminClient } from '@/lib/supabase/server';

export async function selectAccountTypeAction(rawInput: SelectAccountTypeInput) {
  try {
    const validated = selectAccountTypeSchema.parse(rawInput);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: 'Unauthorized. Session expired.' };
    }

    return await AccountService.saveOnboardingIntent(user.id, validated.intent);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Invalid account selection input';
    return { success: false, message: msg };
  }
}

export async function updateCustomerProfileAction(rawInput: UpdateCustomerProfileInput) {
  try {
    const validated = updateCustomerProfileSchema.parse(rawInput);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: 'Unauthorized.' };
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from('customer_profiles')
      .upsert({
        user_id: user.id,
        display_name: validated.displayName,
        phone: validated.phone,
        avatar_url: validated.avatarUrl,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      return { success: false, message: `Update failed: ${error.message}` };
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update profile';
    return { success: false, message: msg };
  }
}

export async function reconcileAccountTypeIntentAction(targetIntent: 'branch_manager' | 'staff') {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: 'Unauthorized. Session expired.' };
    }

    return await AccountService.saveOnboardingIntent(user.id, targetIntent);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update account intent';
    return { success: false, message: msg };
  }
}
