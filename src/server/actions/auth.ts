'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  profileUpdateSchema,
  RegisterInput,
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  ProfileUpdateInput,
} from '@/lib/validation/auth';

export type ActionResponse<T = unknown> = {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
};

/**
 * Register a new user account with email and password.
 */
export async function signUpAction(
  formData: RegisterInput
): Promise<ActionResponse> {
  const parsed = registerSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed. Please check your inputs.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const { email, password, firstName, lastName } = parsed.data;
  const headerList = await headers();
  const origin = headerList.get('origin') || 'http://localhost:3000';

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
      data: {
        first_name: firstName,
        last_name: lastName || null,
      },
    },
  });

  if (error) {
    // Friendly error messaging without leaking stack traces or internal errors
    if (error.message.includes('already registered')) {
      return {
        success: false,
        message: 'An account with this email address already exists. Please sign in.',
      };
    }
    return {
      success: false,
      message: error.message || 'Unable to register account. Please try again.',
    };
  }

  // If email confirmation is required and session is not immediately active
  if (data?.user && !data.session) {
    return {
      success: true,
      message: 'Registration successful! Please check your email to verify your account.',
    };
  }

  redirect('/dashboard');
}

/**
 * Sign in an existing user with email and password.
 */
export async function signInAction(
  formData: LoginInput
): Promise<ActionResponse> {
  const parsed = loginSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Invalid input format.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const { email, password } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return {
      success: false,
      message: 'Invalid email or password. Please check your credentials.',
    };
  }

  redirect('/dashboard');
}

/**
 * Request password reset email.
 */
export async function forgotPasswordAction(
  formData: ForgotPasswordInput
): Promise<ActionResponse> {
  const parsed = forgotPasswordSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Please provide a valid email address.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const { email } = parsed.data;
  const headerList = await headers();
  const origin = headerList.get('origin') || 'http://localhost:3000';

  const supabase = await createClient();

  // Trigger reset email
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  // Always return generic success to prevent account enumeration
  return {
    success: true,
    message:
      'If an account exists with this email, you will receive password reset instructions shortly.',
  };
}

/**
 * Reset password using recovery session.
 */
export async function resetPasswordAction(
  formData: ResetPasswordInput
): Promise<ActionResponse> {
  const parsed = resetPasswordSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed. Please enter a valid password.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const { password } = parsed.data;
  const supabase = await createClient();

  // Verify active recovery session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      message: 'Password reset link is invalid or has expired. Please request a new link.',
    };
  }

  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    return {
      success: false,
      message: error.message || 'Failed to update password.',
    };
  }

  return {
    success: true,
    message: 'Your password has been reset successfully. You can now log in.',
  };
}

/**
 * Sign out current authenticated user.
 */
export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

/**
 * Update authenticated user's profile fields securely.
 */
export async function updateProfileAction(
  formData: ProfileUpdateInput
): Promise<ActionResponse> {
  const parsed = profileUpdateSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed for profile update.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      success: false,
      message: 'Unauthorized. Please sign in to update your profile.',
    };
  }

  // Only allow updating white-listed self-editable fields
  const allowedUpdates = {
    first_name: parsed.data.firstName,
    last_name: parsed.data.lastName || null,
    phone: parsed.data.phone || null,
    avatar_url: parsed.data.avatarUrl || null,
    preferred_language: parsed.data.preferredLanguage || 'en',
    updated_at: new Date().toISOString(),
  };

  const { error: dbError } = await supabase
    .from('user_profiles')
    .update(allowedUpdates)
    .eq('id', user.id);

  if (dbError) {
    return {
      success: false,
      message: 'Failed to update profile. Please try again.',
    };
  }

  return {
    success: true,
    message: 'Profile updated successfully.',
  };
}
