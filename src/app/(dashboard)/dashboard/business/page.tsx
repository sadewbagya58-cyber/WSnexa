import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { PageHeader } from '@/components/ui/page-header';

export default async function BusinessProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const tenantContext = await resolveActiveBusinessContext();

  return (
    <div className="space-y-6">
      <PageHeader
        title={tenantContext ? tenantContext.business.name : 'Business Profile'}
        description="Core multi-tenant business identity, currency, and regional settings."
        breadcrumbs={[{ label: 'Business Profile' }]}
        backHref="/dashboard"
      />

      <Card className="p-6">
        <h2 className="text-base font-semibold text-zinc-950">Business Information</h2>
        {tenantContext ? (
          <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 text-xs">
            <div>
              <dt className="font-medium text-zinc-500">Business Name</dt>
              <dd className="font-semibold text-zinc-900">{tenantContext.business.name}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-500">Slug</dt>
              <dd className="font-mono text-zinc-900">{tenantContext.business.slug}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-500">Business Type</dt>
              <dd className="text-zinc-900 capitalize">{tenantContext.business.businessType}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-500">Currency & Country</dt>
              <dd className="text-zinc-900">{tenantContext.business.defaultCurrency} ({tenantContext.business.countryCode})</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-500">Timezone</dt>
              <dd className="text-zinc-900">{tenantContext.business.timezone}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-500">Status</dt>
              <dd className="text-zinc-900"><Badge variant="success">{tenantContext.business.status}</Badge></dd>
            </div>
          </dl>
        ) : (
          <p className="mt-2 text-xs text-zinc-500">No active business profile found.</p>
        )}
      </Card>
    </div>
  );
}
