import React from 'react';
import { redirect } from 'next/navigation';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreateTableForm } from '@/components/table/create-table-form';
import { PageHeader } from '@/components/ui/page-header';
import Link from 'next/link';

export default async function NewTablePage() {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) {
    redirect('/login');
  }

  const supabase = await createClient();

  const { data: areas } = await supabase
    .from('service_areas')
    .select('id, name, code')
    .eq('business_id', context.business.id)
    .eq('branch_id', context.activeBranch.id)
    .is('deleted_at', null)
    .order('display_order', { ascending: true });

  if (!areas || areas.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Add Single Table"
          description="Create an individual dining table."
          breadcrumbs={[{ label: 'Tables', href: '/dashboard/tables' }, { label: 'Add Table' }]}
          backHref="/dashboard/tables"
        />

        <Card className="p-8 text-center space-y-4 max-w-xl mx-auto">
          <div className="flex justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-2xl text-amber-800">
              📁
            </span>
          </div>
          <h3 className="text-base font-bold text-zinc-950">Service Area Required</h3>
          <p className="text-xs text-zinc-500">
            You must create at least one Service Area (e.g. Main Hall, Outdoor) before adding dining tables.
          </p>
          <Link href="/dashboard/areas">
            <Button size="sm">+ Create Service Area First</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Add Single Table"
        description="Configure guest capacity, shape, and code for an individual table."
        breadcrumbs={[{ label: 'Tables', href: '/dashboard/tables' }, { label: 'Add Table' }]}
        backHref="/dashboard/tables"
      />

      <Card className="p-6">
        <CreateTableForm areas={areas} />
      </Card>
    </div>
  );
}
