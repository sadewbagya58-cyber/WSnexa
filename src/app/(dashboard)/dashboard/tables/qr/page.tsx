import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { PageHeader } from '@/components/ui/page-header';
import { BranchQrManager } from '@/components/qr/branch-qr-manager';
import { QrService } from '@/server/services/qr.service';

export default async function BranchQrPage() {
  const tenantContext = await resolveActiveBusinessContext();
  if (!tenantContext || !tenantContext.activeBranch) redirect('/login');

  const supabase = await createClient();
  const branchId = tenantContext.activeBranch.id;

  // Fetch active Branch QR record for the active branch
  const activeQr = await QrService.getActiveBranchQr();

  // Fetch dining tables summary (total, with PIN, missing PIN) for the active branch
  const { data: tables } = await supabase
    .from('dining_tables')
    .select('id, table_pin_hash')
    .eq('business_id', tenantContext.business.id)
    .eq('branch_id', branchId)
    .eq('is_active', true)
    .is('deleted_at', null);

  const total = tables?.length || 0;
  const withPin = tables?.filter((t) => t.table_pin_hash !== null).length || 0;
  const missingPin = total - withPin;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Branch QR Code & Ordering Settings"
        description={`Manage venue QR code and guest table PIN settings for ${tenantContext.activeBranch.name}.`}
        breadcrumbs={[
          { label: 'Tables', href: '/dashboard/tables' },
          { label: 'Branch QR & PIN' },
        ]}
        backHref="/dashboard/tables"
        helpSlug="generate-qr-codes"
      />

      <BranchQrManager
        businessName={tenantContext.business.name}
        branchName={tenantContext.activeBranch.name}
        branchCode={tenantContext.activeBranch.code}
        requireTableSelection={tenantContext.activeBranch.require_table_selection ?? true}
        requireTablePin={tenantContext.activeBranch.require_table_pin ?? false}
        tablePinLength={tenantContext.activeBranch.table_pin_length ?? 4}
        tablesSummary={{ total, withPin, missingPin }}
        initialQr={activeQr}
      />
    </div>
  );
}
