import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';

export default async function BranchesPlaceholderPage() {
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
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between border-b border-zinc-200 pb-5">
        <div>
          <Badge variant="neutral" className="mb-1">
            Branch Management Placeholder
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">
            Branches ({branches.length})
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
