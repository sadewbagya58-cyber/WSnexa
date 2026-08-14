import { createAdminClient } from '@/lib/supabase/server';
import { OnboardingIntent } from '@/lib/validation/account';

export interface MinimalUserProfile {
  id: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  onboarding_intent?: OnboardingIntent | null;
  preferred_workspace?: string | null;
  customer_profile_created_at?: string | null;
}

export interface MinimalMembership {
  id: string;
  business_id: string;
  role: string;
  membership_status?: string;
  status?: string;
}

export class AccountService {
  /**
   * Resolves target redirect path based on verified server-side business membership and user intent.
   * PRIORITY ORDER:
   * 1. Active Business Membership (Always authoritative for B2B accounts)
   * 2. Customer intent or initialized customer profile -> /customer
   * 3. Unverified Manager/Staff intent -> /account/pending-access
   * 4. Unverified Owner intent -> /onboarding
   * 5. Unclassified account (no intent) -> /onboarding/account-type
   */
  static async resolveAccountRoute(
    user: { id: string },
    profile: MinimalUserProfile | null,
    membership: (MinimalMembership & { custom_role_id?: string | null }) | null,
    permissions?: string[]
  ): Promise<string> {
    const isMembershipActive = membership && (
      membership.membership_status === 'active' ||
      membership.status === 'active'
    );

    // 1. Verified Active Business Membership Routing (Highest Priority)
    if (isMembershipActive && membership) {
      // Business Owner always has full access to main dashboard
      if (membership.role === 'business_owner') {
        return '/dashboard';
      }

      // Custom Role assigned: resolve workspace from effective permissions
      if (membership.custom_role_id || permissions) {
        let perms = permissions;
        if (!perms && membership.business_id) {
          try {
            const { PermissionService } = await import('@/server/services/permission.service');
            perms = await PermissionService.getMemberEffectivePermissions(user.id, membership.business_id, null);
          } catch {
            perms = [];
          }
        }

        const has = (key: string) => perms?.includes(key);

        if (has('waiter.access') || has('waiter.orders.create') || has('waiter.requests.view')) {
          return '/dashboard/waiter';
        }
        if (has('kitchen.access') || has('kitchen.orders.view') || has('kitchen.update')) {
          return '/dashboard/kitchen';
        }
        if (has('cashier.access') || has('payments.record') || has('receipts.print')) {
          return '/dashboard/cashier';
        }
        if (has('reports.view') || has('reports.financial.view')) {
          return '/dashboard/reports';
        }
        if (has('menu.view') || has('menu.items.create') || has('menu.manage')) {
          return '/dashboard/menu';
        }
        if (has('tables.view') || has('tables.status.update') || has('tables.manage')) {
          return '/dashboard/tables';
        }
        if (has('staff.view') || has('staff.manage')) {
          return '/dashboard/team';
        }
        if (has('orders.view') || has('orders.create')) {
          return '/dashboard';
        }

        return '/dashboard';
      }

      // Standard built-in roles without custom role override
      switch (membership.role) {
        case 'branch_manager':
          return '/dashboard';
        case 'cashier':
          return '/dashboard/cashier';
        case 'kitchen_staff':
          return '/dashboard/kitchen';
        case 'waiter':
          return '/dashboard/waiter';
        default:
          break;
      }

      return '/dashboard';
    }

    // 2. Suspended or Deactivated Membership -> Pending Access
    if (membership && (membership.membership_status === 'suspended' || membership.membership_status === 'inactive' || membership.status === 'suspended')) {
      return '/account/pending-access';
    }

    const intent = profile?.onboarding_intent;

    // 3. Customer intent or initialized Customer Profile
    if (intent === 'customer' || profile?.customer_profile_created_at) {
      return '/customer';
    }

    // 4. Manager/Staff intent WITHOUT verified server-side active membership -> Pending Access
    if (intent === 'branch_manager' || intent === 'staff') {
      return '/account/pending-access';
    }

    // 5. Business Owner intent without registered business -> Onboarding Flow
    if (intent === 'business_owner') {
      return '/onboarding';
    }

    // 6. Unclassified Account (Missing intent and missing business membership) -> Account-Type Selection
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

    const targetRoute = await this.resolveAccountRoute(
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
