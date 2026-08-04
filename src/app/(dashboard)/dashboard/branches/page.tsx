import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { PageHeader } from '@/components/ui/page-header';

export default async function BranchesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const tenantContext = await resolveActiveBusinessContext();

  let branches: {
    id: string;
    name: string;
    code: string;
    status: string;
    is_default: boolean;
  }[] = [];

  if (tenantContext) {
    const { data } = await supabase
      .from('branches')
      .select('*')
      .eq('business_id', tenantContext.business.id);
    branches = data || [];
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Branches (${branches.length})`}
        description="Multi-branch locations for your venue."
        breadcrumbs={[{ label: 'Branches' }]}
        backHref="/dashboard"
      />

      <div className="space-y-4">
        {branches.map((b) => (
          <Card key={b.id} className="flex items-center justify-between p-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-zinc-950">{b.name}</span>
                {b.is_default && <Badge variant="success">Default Branch</Badge>}
              </div>
              <p className="text-xs text-zinc-500">Code: {b.code} | Status: {b.status}</p>
            </div>
            <span className="text-xs font-mono text-zinc-400">{b.id}</span>
          </Card>
        ))}

        {branches.length === 0 && (
          <Card className="p-8 text-center text-xs text-zinc-500">
            No branches found for this business.
          </Card>
        )}
      </div>
    </div>
  );
}
