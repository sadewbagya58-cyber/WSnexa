import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BulkGeneratorForm } from '@/components/table/bulk-generator-form';

export default async function BulkGeneratorPage() {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.defaultBranch) {
    redirect('/login');
  }

  const supabase = await createClient();

  const { data: areas } = await supabase
    .from('service_areas')
    .select('id, name, code')
    .eq('business_id', context.business.id)
    .eq('branch_id', context.defaultBranch.id)
    .is('deleted_at', null)
    .order('display_order', { ascending: true });

  if (!areas || areas.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight text-zinc-950">Bulk Table Generator</h1>
          <Link href="/dashboard/tables">
            <Button variant="outline" size="sm">← Back</Button>
          </Link>
        </div>

        <Card className="p-8 text-center space-y-4">
          <p className="text-sm text-zinc-600">
            You must create at least one Service Area before generating tables.
          </p>
          <Link href="/dashboard/tables/areas">
            <Button size="sm">+ Create Service Area</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-950">Bulk Table Generator</h1>
          <p className="text-xs text-zinc-500">
            Atomically generate up to 500 numbered dining tables in a single operation.
          </p>
        </div>

        <Link href="/dashboard/tables">
          <Button variant="outline" size="sm">
            ← Back
          </Button>
        </Link>
      </div>

      <Card className="p-6">
        <BulkGeneratorForm areas={areas} />
      </Card>
    </div>
  );
}
