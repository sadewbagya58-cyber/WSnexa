import { createAdminClient } from '@/lib/supabase/server';
import { OnboardingIntent } from '@/lib/validation/account';

export interface MinimalUserProfile {
  id: string;
  email?: string | null;
  full_name?: string | null;
  onboarding_intent?: OnboardingIntent | null;
  preferred_workspace?: string | null;
  customer_profile_created_at?: string | null;
}

export interface MinimalMembership {
  id: string;
  business_id: string;
  role: string;
  membership_status: string;
}

export class AccountService {
  /**
   * Resolves target redirect path based on verified server-side business membership and user intent.
   */
  static resolveAccountRoute(
    user: { id: string },
    profile: MinimalUserProfile | null,
    membership: MinimalMembership | null
  ): string {
    // 1. Verified Active Business Membership Routing (Server-Side Verified)
    if (membership && membership.membership_status === 'active') {
      switch (membership.role) {
        case 'business_owner':
        case 'branch_manager':
          return '/dashboard';
        case 'cashier':
          return '/dashboard/cashier';
        case 'kitchen_staff':
          return '/dashboard/kitchen';
        case 'waiter':
          return '/dashboard/waiter';
        default:
          return '/dashboard';
      }
    }

    const intent = profile?.onboarding_intent;

    // 2. Manager/Staff intent WITHOUT verified server-side membership ➔ Pending Access
    if (intent === 'branch_manager' || intent === 'staff') {
      return '/account/pending-access';
    }

    // 3. Customer intent or initialized Customer Profile ➔ Customer Workspace
    if (intent === 'customer' || profile?.customer_profile_created_at) {
      return '/customer';
    }

    // 4. Business Owner intent without registered business ➔ Onboarding Flow
    if (intent === 'business_owner') {
      return '/onboarding';
    }

    // 5. Unclassified Account ➔ Account-Type Selection
    return '/onboarding/account-type';
  }

  /**
   * Saves onboarding intent and initializes customer profile if intent is customer.
   */
  static async saveOnboardingIntent(
    userId: string,
    intent: OnboardingIntent
  ): Promise<{ success: boolean; message?: string; targetRoute?: string }> {
    const admin = createAdminClient();

    const isCustomer = intent === 'customer';
    const preferredWorkspace = isCustomer ? 'customer' : 'dashboard';

    // 1. Update user_profiles
    const { error: profileErr } = await admin
      .from('user_profiles')
      .update({
        onboarding_intent: intent,
        preferred_workspace: preferredWorkspace,
        ...(isCustomer ? { customer_profile_created_at: new Date().toISOString() } : {}),
      })
      .eq('id', userId);

    if (profileErr) {
      return { success: false, message: `Failed to update profile: ${profileErr.message}` };
    }

    // 2. Initialize customer_profiles row if customer intent
    if (isCustomer) {
      const { data: existingProfile } = await admin
        .from('customer_profiles')
        .select('user_id')
        .eq('user_id', userId)
        .single();

      if (!existingProfile) {
        await admin.from('customer_profiles').insert({
          user_id: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    }

    // 3. Resolve target route
    const { data: updatedProfile } = await admin
      .from('user_profiles')
      .select('id, first_name, last_name, onboarding_intent, preferred_workspace, customer_profile_created_at')
      .eq('id', userId)
      .single();

    const { data: membership } = await admin
      .from('business_memberships')
      .select('id, business_id, role, membership_status')
      .eq('user_id', userId)
      .eq('membership_status', 'active')
      .limit(1)
      .single();

    const targetRoute = this.resolveAccountRoute(
      { id: userId },
      updatedProfile as MinimalUserProfile,
      membership as MinimalMembership
    );

    return {
      success: true,
      targetRoute,
    };
  }

  /**
   * Fetches customer profile data for customer workspace.
   */
  static async getCustomerProfile(userId: string) {
    const admin = createAdminClient();

    const { data: profile } = await admin
      .from('customer_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    const { data: userProfile } = await admin
      .from('user_profiles')
      .select('first_name, last_name, onboarding_intent, preferred_workspace')
      .eq('id', userId)
      .single();

    const { data: authUser } = await admin.auth.admin.getUserById(userId);

    const fullName = [userProfile?.first_name, userProfile?.last_name].filter(Boolean).join(' ') || 'Valued Customer';

    return {
      userId,
      email: authUser?.user?.email || '',
      displayName: profile?.display_name || fullName,
      phone: profile?.phone || '',
      avatarUrl: profile?.avatar_url || '',
      createdAt: profile?.created_at || new Date().toISOString(),
    };
  }
}
