import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';

export default async function TeamPlaceholderPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const tenantContext = await resolveActiveBusinessContext();

  let members: {
    id: string;
    role: string;
    membership_status: string;
    user_id: string;
    user_profiles: { first_name: string; last_name: string | null } | null;
  }[] = [];
  if (tenantContext) {
    const { data } = await supabase
      .from('business_memberships')
      .select('*, user_profiles(*)')
      .eq('business_id', tenantContext.business.id);
    members = data || [];
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between border-b border-zinc-200 pb-5">
        <div>
          <Badge variant="neutral" className="mb-1">
            Team & Memberships Placeholder
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">
            Team Members ({members.length})
          </h1>
        </div>
        <Link
          href="/dashboard"
          className="text-xs font-semibold text-zinc-600 hover:text-zinc-950"
        >
          ← Back to Dashboard Overview
        </Link>
      </div>

      <div className="mt-8 space-y-4">
        {members.map((m) => (
          <Card key={m.id} className="flex items-center justify-between p-6">
            <div>
              <span className="font-bold text-zinc-950">
                {m.user_profiles?.first_name} {m.user_profiles?.last_name || ''}
              </span>
              <div className="mt-1 flex gap-2">
                <Badge variant="neutral">Role: {m.role}</Badge>
                <Badge variant="success">Status: {m.membership_status}</Badge>
              </div>
            </div>
            <span className="text-xs font-mono text-zinc-400">User ID: {m.user_id}</span>
          </Card>
        ))}

        {members.length === 0 && (
          <Card className="p-8 text-center text-xs text-zinc-500">
            No team memberships found for this business.
          </Card>
        )}
      </div>
    </div>
  );
}
