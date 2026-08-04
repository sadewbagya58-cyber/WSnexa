import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProfileEditor } from '@/components/profile/profile-editor';
import { CreateBusinessModal } from '@/components/tenant/create-business-modal';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { signOutAction } from '@/server/actions/auth';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Resolve active tenant context
  const tenantContext = await resolveActiveBusinessContext();

  // Fetch profile row
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const firstName = profile?.first_name || user.user_metadata?.first_name || 'User';
  const lastName = profile?.last_name || user.user_metadata?.last_name || null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Top Header Navigation */}
      <div className="flex flex-col gap-4 border-b border-zinc-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="success" className="mb-1">
              Onboarding Completed
            </Badge>
            {tenantContext && (
              <Badge variant="neutral" className="mb-1">
                Role: {tenantContext.membership.role}
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">
            {tenantContext ? tenantContext.business.name : `Welcome, ${firstName}`}
          </h1>
          <p className="text-xs text-zinc-500">
            {tenantContext
              ? `Active Branch: ${tenantContext.defaultBranch?.name || 'Default Branch'} (${tenantContext.defaultBranch?.code || 'MAIN'})`
              : 'No business assigned yet.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <CreateBusinessModal />
          <form action={signOutAction}>
            <Button variant="outline" size="sm" type="submit">
              Sign Out
            </Button>
          </form>
        </div>
      </div>

      {/* Sub Navigation Bar */}
      <div className="mt-4 flex border-b border-zinc-200">
        <Link
          href="/dashboard"
          className="border-b-2 border-zinc-950 px-4 py-2 text-sm font-semibold text-zinc-950"
        >
          Overview
        </Link>
        <Link
          href="/dashboard/business"
          className="border-b-2 border-transparent px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-950"
        >
          Business Profile
        </Link>
        <Link
          href="/dashboard/branches"
          className="border-b-2 border-transparent px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-950"
        >
          Branches
        </Link>
        <Link
          href="/dashboard/team"
          className="border-b-2 border-transparent px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-950"
        >
          Team & Memberships
        </Link>
      </div>

      {/* Active Business Summary Cards */}
      {tenantContext ? (
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-zinc-500">Active Business</h3>
            <p className="mt-2 text-xl font-bold text-zinc-950">{tenantContext.business.name}</p>
            <p className="mt-1 text-xs text-zinc-400">Slug: {tenantContext.business.slug}</p>
          </Card>

          <Card className="p-6">
            <h3 className="text-sm font-semibold text-zinc-500">Default Branch</h3>
            <p className="mt-2 text-xl font-bold text-zinc-950">
              {tenantContext.defaultBranch?.name || 'Main Branch'}
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              Code: {tenantContext.defaultBranch?.code || 'MAIN'}
            </p>
          </Card>

          <Card className="p-6">
            <h3 className="text-sm font-semibold text-zinc-500">Your Membership Role</h3>
            <p className="mt-2 text-xl font-bold text-zinc-950">
              {tenantContext.membership.role}
            </p>
            <p className="mt-1 text-xs text-zinc-400">Status: {tenantContext.membership.status}</p>
          </Card>
        </div>
      ) : (
        <Card className="mt-8 p-8 text-center">
          <h3 className="text-lg font-bold text-zinc-900">No Business Created Yet</h3>
          <p className="mt-2 text-sm text-zinc-500">
            Complete onboarding to create your first hospitality business.
          </p>
        </Card>
      )}

      {/* Setup Checklist Placeholder */}
      <div className="mt-8">
        <Card className="p-6">
          <h2 className="text-base font-semibold text-zinc-950">Setup Checklist</h2>
          <p className="mt-1 text-xs text-zinc-500">Track your business configuration progress.</p>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <span className="text-xs font-bold text-emerald-800">✅ Business Profile</span>
              <p className="mt-1 text-xs text-emerald-700">Completed during onboarding</p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 opacity-75">
              <span className="text-xs font-bold text-zinc-700">⬜ Add Menu Items</span>
              <p className="mt-1 text-[11px] text-zinc-400">Phase 5 (Coming Soon)</p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 opacity-75">
              <span className="text-xs font-bold text-zinc-700">⬜ Setup Dining Tables</span>
              <p className="mt-1 text-[11px] text-zinc-400">Phase 7 (Coming Soon)</p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 opacity-75">
              <span className="text-xs font-bold text-zinc-700">⬜ Generate QR Codes</span>
              <p className="mt-1 text-[11px] text-zinc-400">Phase 8 (Coming Soon)</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Personal Profile Settings */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="space-y-4 p-6">
          <h2 className="text-base font-semibold text-zinc-950">User Account</h2>
          <dl className="space-y-3 text-xs">
            <div>
              <dt className="font-medium text-zinc-500">User ID</dt>
              <dd className="font-mono text-zinc-800 break-all">{user.id}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-500">Email</dt>
              <dd className="text-zinc-800">{user.email}</dd>
            </div>
          </dl>
        </Card>

        <Card className="p-6 lg:col-span-2">
          <h2 className="mb-4 text-base font-semibold text-zinc-950">
            Personal Profile Settings
          </h2>
          <ProfileEditor
            initialProfile={{
              firstName: firstName,
              lastName: lastName,
              phone: profile?.phone || null,
              avatarUrl: profile?.avatar_url || null,
              preferredLanguage: profile?.preferred_language || 'en',
            }}
          />
        </Card>
      </div>
    </div>
  );
}
