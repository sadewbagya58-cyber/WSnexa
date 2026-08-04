import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { PageHeader } from '@/components/ui/page-header';

export default async function TeamPage() {
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
    members = (data as unknown as typeof members) || [];
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Team Members (${members.length})`}
        description="Staff members, roles, and branch assignments for your business."
        breadcrumbs={[{ label: 'Team Members' }]}
        backHref="/dashboard"
      />

      <div className="space-y-4">
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
