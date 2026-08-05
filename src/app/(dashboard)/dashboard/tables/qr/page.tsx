import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { PageHeader } from '@/components/ui/page-header';
import { BulkQrExporter } from '@/components/qr/bulk-qr-exporter';

export default async function BulkQrPage() {
  const tenantContext = await resolveActiveBusinessContext();
  if (!tenantContext || !tenantContext.defaultBranch) redirect('/login');

  const supabase = await createClient();

  // Fetch service areas
  const { data: areas } = await supabase
    .from('service_areas')
    .select('id, name, code')
    .eq('business_id', tenantContext.business.id)
    .eq('branch_id', tenantContext.defaultBranch.id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('display_order', { ascending: true });

  // Fetch dining tables with active QR code status
  const { data: tables } = await supabase
    .from('dining_tables')
    .select(`
      id,
      name,
      code,
      table_number,
      capacity,
      service_area_id,
      service_areas (name, code),
      table_qr_codes!left (id, is_active, version, token_prefix)
    `)
    .eq('business_id', tenantContext.business.id)
    .eq('branch_id', tenantContext.defaultBranch.id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('display_order', { ascending: true });

  interface TableWithQr {
    id: string;
    name: string;
    code: string;
    table_number: number | null;
    capacity: number;
    service_area_id: string;
    service_areas: { name: string; code: string } | null;
    table_qr_codes: { id: string; is_active: boolean; version: number; token_prefix: string | null }[] | { id: string; is_active: boolean; version: number; token_prefix: string | null } | null;
  }

  const formattedTables = ((tables as unknown as TableWithQr[]) || []).map((t) => {
    const activeQr = Array.isArray(t.table_qr_codes)
      ? t.table_qr_codes.find((q) => q.is_active)
      : t.table_qr_codes?.is_active
      ? t.table_qr_codes
      : null;

    return {
      id: t.id,
      name: t.name,
      code: t.code,
      table_number: t.table_number,
      capacity: t.capacity,
      service_area_id: t.service_area_id,
      areaName: t.service_areas?.name || 'Main Hall',
      areaCode: t.service_areas?.code || 'HALL',
      hasActiveQr: !!activeQr,
      qrVersion: activeQr?.version || 0,
      tokenPrefix: activeQr?.token_prefix || null,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Table QR Codes & Bulk Export"
        description={`Manage and batch export table QR codes for ${tenantContext.defaultBranch.name}.`}
        breadcrumbs={[
          { label: 'Tables', href: '/dashboard/tables' },
          { label: 'Bulk QR Export' },
        ]}
        backHref="/dashboard/tables"
      />

      <BulkQrExporter
        businessName={tenantContext.business.name}
        branchName={tenantContext.defaultBranch.name}
        branchCode={tenantContext.defaultBranch.code}
        areas={areas || []}
        tables={formattedTables}
      />
    </div>
  );
}
