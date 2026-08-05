import { createClient } from '@/lib/supabase/server';
import { generateSecureQrToken, hashQrToken } from '@/lib/qr/security';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';

export interface QrGenerationResult {
  success: boolean;
  message?: string;
  rawToken?: string;
  qrUrl?: string;
  qrCodeId?: string;
}

export class QrService {
  /**
   * Generates a new active QR code for a single dining table.
   */
  static async generateTableQr(tableId: string): Promise<QrGenerationResult> {
    const tenantContext = await resolveActiveBusinessContext();
    if (!tenantContext || !tenantContext.defaultBranch) {
      return { success: false, message: 'Unauthorized or invalid business context' };
    }

    const role = tenantContext.membership.role;
    if (role !== 'business_owner' && role !== 'branch_manager') {
      return { success: false, message: 'Forbidden: Insufficient permissions to generate QR codes' };
    }

    const supabase = await createClient();

    // Verify dining table belongs to tenant & branch and is active
    const { data: table, error: tableErr } = await supabase
      .from('dining_tables')
      .select('id, name, code, is_active, deleted_at, service_area_id')
      .eq('id', tableId)
      .eq('business_id', tenantContext.business.id)
      .eq('branch_id', tenantContext.defaultBranch.id)
      .single();

    if (tableErr || !table || !table.is_active || table.deleted_at) {
      return { success: false, message: 'Dining table is inactive, archived, or not found' };
    }

    // Generate secure token pair
    const { rawToken, tokenHash, tokenPrefix } = generateSecureQrToken();

    // Revoke any existing active QR code for this table
    await supabase
      .from('table_qr_codes')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_by: tenantContext.user.id,
      })
      .eq('dining_table_id', tableId)
      .eq('is_active', true);

    // Insert new active QR record
    const { data: qr, error: qrErr } = await supabase
      .from('table_qr_codes')
      .insert({
        business_id: tenantContext.business.id,
        branch_id: tenantContext.defaultBranch.id,
        dining_table_id: tableId,
        token_hash: tokenHash,
        token_prefix: tokenPrefix,
        version: 1,
        is_active: true,
        generated_by: tenantContext.user.id,
        generated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (qrErr || !qr) {
      return { success: false, message: qrErr?.message || 'Failed to create QR record in database' };
    }

    // Write Audit Log
    await supabase.from('audit_logs').insert({
      business_id: tenantContext.business.id,
      actor_id: tenantContext.user.id,
      action: 'qr.generated',
      target_type: 'table_qr_code',
      target_id: qr.id,
      payload: { dining_table_id: tableId, version: 1, token_prefix: tokenPrefix },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const qrUrl = `${baseUrl}/m/${rawToken}`;

    return {
      success: true,
      rawToken,
      qrUrl,
      qrCodeId: qr.id,
    };
  }

  /**
   * Regenerates a new QR code for a dining table, invalidating the previous version.
   */
  static async regenerateTableQr(tableId: string): Promise<QrGenerationResult> {
    const tenantContext = await resolveActiveBusinessContext();
    if (!tenantContext || !tenantContext.defaultBranch) {
      return { success: false, message: 'Unauthorized or invalid business context' };
    }

    const role = tenantContext.membership.role;
    if (role !== 'business_owner' && role !== 'branch_manager') {
      return { success: false, message: 'Forbidden: Insufficient permissions to regenerate QR codes' };
    }

    const supabase = await createClient();

    // Fetch existing QR record for version increment
    const { data: existingQr } = await supabase
      .from('table_qr_codes')
      .select('version')
      .eq('dining_table_id', tableId)
      .eq('is_active', true)
      .maybeSingle();

    const newVersion = (existingQr?.version || 1) + 1;

    // Revoke old QR code
    await supabase
      .from('table_qr_codes')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_by: tenantContext.user.id,
      })
      .eq('dining_table_id', tableId)
      .eq('is_active', true);

    // Generate new token pair
    const { rawToken, tokenHash, tokenPrefix } = generateSecureQrToken();

    const { data: qr, error: qrErr } = await supabase
      .from('table_qr_codes')
      .insert({
        business_id: tenantContext.business.id,
        branch_id: tenantContext.defaultBranch.id,
        dining_table_id: tableId,
        token_hash: tokenHash,
        token_prefix: tokenPrefix,
        version: newVersion,
        is_active: true,
        generated_by: tenantContext.user.id,
        generated_at: new Date().toISOString(),
        last_regenerated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (qrErr || !qr) {
      return { success: false, message: qrErr?.message || 'Failed to regenerate QR code' };
    }

    // Write Audit Log
    await supabase.from('audit_logs').insert({
      business_id: tenantContext.business.id,
      actor_id: tenantContext.user.id,
      action: 'qr.regenerated',
      target_type: 'table_qr_code',
      target_id: qr.id,
      payload: { dining_table_id: tableId, new_version: newVersion, token_prefix: tokenPrefix },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const qrUrl = `${baseUrl}/m/${rawToken}`;

    return {
      success: true,
      rawToken,
      qrUrl,
      qrCodeId: qr.id,
    };
  }

  /**
   * Revokes/disables the active QR code for a dining table.
   */
  static async disableTableQr(tableId: string): Promise<{ success: boolean; message?: string }> {
    const tenantContext = await resolveActiveBusinessContext();
    if (!tenantContext || !tenantContext.defaultBranch) {
      return { success: false, message: 'Unauthorized or invalid business context' };
    }

    const role = tenantContext.membership.role;
    if (role !== 'business_owner' && role !== 'branch_manager') {
      return { success: false, message: 'Forbidden: Insufficient permissions to disable QR codes' };
    }

    const supabase = await createClient();

    const { data: updated, error } = await supabase
      .from('table_qr_codes')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_by: tenantContext.user.id,
      })
      .eq('dining_table_id', tableId)
      .eq('is_active', true)
      .select();

    if (error) {
      return { success: false, message: error.message };
    }

    if (updated && updated.length > 0) {
      await supabase.from('audit_logs').insert({
        business_id: tenantContext.business.id,
        actor_id: tenantContext.user.id,
        action: 'qr.disabled',
        target_type: 'table_qr_code',
        target_id: updated[0].id,
        payload: { dining_table_id: tableId },
      });
    }

    return { success: true };
  }

  /**
   * Bulk generates QR codes for all active tables in a branch or service area.
   */
  static async bulkGenerateTableQrs(
    areaId?: string,
    overrideExisting: boolean = false
  ): Promise<{ success: boolean; count: number; message?: string }> {
    const tenantContext = await resolveActiveBusinessContext();
    if (!tenantContext || !tenantContext.defaultBranch) {
      return { success: false, count: 0, message: 'Unauthorized' };
    }

    const role = tenantContext.membership.role;
    if (role !== 'business_owner' && role !== 'branch_manager') {
      return { success: false, count: 0, message: 'Forbidden' };
    }

    const supabase = await createClient();

    let query = supabase
      .from('dining_tables')
      .select('id, name, code')
      .eq('business_id', tenantContext.business.id)
      .eq('branch_id', tenantContext.defaultBranch.id)
      .eq('is_active', true)
      .is('deleted_at', null);

    if (areaId) {
      query = query.eq('service_area_id', areaId);
    }

    const { data: tables, error: tablesErr } = await query;
    if (tablesErr || !tables) {
      return { success: false, count: 0, message: tablesErr?.message || 'Failed to fetch tables' };
    }

    let generatedCount = 0;

    for (const table of tables) {
      // Check if table already has active QR
      const { data: existing } = await supabase
        .from('table_qr_codes')
        .select('id')
        .eq('dining_table_id', table.id)
        .eq('is_active', true)
        .maybeSingle();

      if (existing && !overrideExisting) {
        continue; // Skip existing if override not requested
      }

      // Generate new token pair
      const { tokenHash, tokenPrefix } = generateSecureQrToken();

      if (existing) {
        await supabase
          .from('table_qr_codes')
          .update({ is_active: false, revoked_at: new Date().toISOString(), revoked_by: tenantContext.user.id })
          .eq('dining_table_id', table.id)
          .eq('is_active', true);
      }

      await supabase.from('table_qr_codes').insert({
        business_id: tenantContext.business.id,
        branch_id: tenantContext.defaultBranch.id,
        dining_table_id: table.id,
        token_hash: tokenHash,
        token_prefix: tokenPrefix,
        version: 1,
        is_active: true,
        generated_by: tenantContext.user.id,
        generated_at: new Date().toISOString(),
      });

      generatedCount++;
    }

    await supabase.from('audit_logs').insert({
      business_id: tenantContext.business.id,
      actor_id: tenantContext.user.id,
      action: 'qr.bulk_generated',
      target_type: 'branch',
      target_id: tenantContext.defaultBranch.id,
      payload: { count: generatedCount, area_id: areaId || 'all', override_existing: overrideExisting },
    });

    return {
      success: true,
      count: generatedCount,
      message: `Successfully generated ${generatedCount} table QR code(s).`,
    };
  }

  /**
   * Resolves a raw public QR token to its browse-only public menu payload via RPC.
   */
  static async resolvePublicMenuByToken(rawToken: string) {
    const tokenHash = hashQrToken(rawToken);
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('resolve_public_table_menu', {
      p_token_hash: tokenHash,
    });

    if (error || !data) {
      return { success: false, error: 'INVALID_QR' };
    }

    return data as Record<string, unknown>;
  }
}
