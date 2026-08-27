import { redirect } from 'next/navigation';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { resolveAuthorizationContext } from '@/server/auth/authorization-context';
import { can } from '@/server/auth/policy-engine';

export default async function SettingsRootPage() {
  const context = await resolveActiveBusinessContext();
  if (!context) {
    redirect('/login');
  }

  let authContext: Awaited<ReturnType<typeof resolveAuthorizationContext>>;
  try {
    authContext = await resolveAuthorizationContext();
  } catch {
    redirect('/dashboard');
  }

  if (authContext) {
    if (
      authContext.isBusinessOwner ||
      (await can({ context: authContext, permission: 'business.settings.manage' }))
    ) {
      redirect('/dashboard/settings/subscription');
    }
    if (await can({ context: authContext, permission: 'business.view' })) {
      redirect('/dashboard/business');
    }
    if (
      (await can({ context: authContext, permission: 'branches.view' })) ||
      (await can({ context: authContext, permission: 'branches.manage' }))
    ) {
      redirect('/dashboard/branches');
    }
    if (
      (await can({ context: authContext, permission: 'venue_profile.view' })) ||
      (await can({ context: authContext, permission: 'venue_profile.manage' }))
    ) {
      redirect('/dashboard/venue-profile');
    }
    if (
      (await can({ context: authContext, permission: 'order_security.view' })) ||
      (await can({ context: authContext, permission: 'order_security.manage' }))
    ) {
      redirect('/dashboard/settings/order-security');
    }
  }

  redirect('/dashboard');
}
