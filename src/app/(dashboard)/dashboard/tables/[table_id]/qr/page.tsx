import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { PageHeader } from '@/components/ui/page-header';
import { QrCardManager } from '@/components/qr/qr-card-manager';

interface SingleTableQrPageProps {
  params: Promise<{ table_id: string }>;
}

export default async function SingleTableQrPage({ params }: SingleTableQrPageProps) {
  const { table_id } = await params;
  const tenantContext = await resolveActiveBusinessContext();
  if (!tenantContext || !tenantContext.defaultBranch) redirect('/login');

  const supabase = await createClient();

  // Fetch dining table details
  const { data: table, error: tableErr } = await supabase
    .from('dining_tables')
    .select('*, service_areas(name, code)')
    .eq('id', table_id)
    .eq('business_id', tenantContext.business.id)
    .eq('branch_id', tenantContext.defaultBranch.id)
    .single();

  if (tableErr || !table) {
    redirect('/dashboard/tables');
  }

  // Fetch active QR code if present
  const { data: qrCode } = await supabase
    .from('table_qr_codes')
    .select('*')
    .eq('dining_table_id', table_id)
    .eq('is_active', true)
    .maybeSingle();

  const areaName = Array.isArray(table.service_areas)
    ? table.service_areas[0]?.name
    : table.service_areas?.name || 'Main Hall';

  return (
    <div className="space-y-6">
      <PageHeader
        title={`QR Code — ${table.name}`}
        description={`Manage, preview, print, or regenerate table QR code for ${table.name} (${table.code}).`}
        breadcrumbs={[
          { label: 'Tables', href: '/dashboard/tables' },
          { label: table.name, href: `/dashboard/tables` },
          { label: 'QR Card' },
        ]}
        backHref="/dashboard/tables"
      />

      <QrCardManager
        businessName={tenantContext.business.name}
        branchName={tenantContext.defaultBranch.name}
        areaName={areaName}
        tableName={table.name}
        tableCode={table.code}
        tableId={table.id}
        initialQr={qrCode}
      />
    </div>
  );
}
