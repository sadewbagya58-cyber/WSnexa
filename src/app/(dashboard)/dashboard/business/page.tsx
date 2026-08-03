import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';

export default async function BusinessPlaceholderPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const tenantContext = await resolveActiveBusinessContext();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between border-b border-zinc-200 pb-5">
        <div>
          <Badge variant="neutral" className="mb-1">
            Business Profile Placeholder
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">
            {tenantContext ? tenantContext.business.name : 'Business Profile'}
          </h1>
        </div>
        <Link
          href="/dashboard"
          className="text-xs font-semibold text-zinc-600 hover:text-zinc-950"
        >
          ← Back to Dashboard Overview
        </Link>
      </div>

      <div className="mt-8">
        <Card className="p-6">
          <h2 className="text-base font-semibold text-zinc-950">Business Metadata</h2>
          {tenantContext ? (
            <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
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
                <dd className="text-zinc-900">{tenantContext.business.businessType}</dd>
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
    </div>
  );
}
