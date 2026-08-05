import { createClient } from '@/lib/supabase/server';
import { generateSecureQrToken, hashQrToken, decryptRawToken } from '@/lib/qr/security';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';

export interface BranchQrResult {
  success: boolean;
  message?: string;
  rawToken?: string;
  qrUrl?: string;
  qrCodeId?: string;
}

export class QrService {
  /**
   * Generates a new active Branch QR code for the current branch.
   */
  static async generateBranchQr(): Promise<BranchQrResult> {
    const tenantContext = await resolveActiveBusinessContext();
    if (!tenantContext || !tenantContext.defaultBranch) {
      return { success: false, message: 'Unauthorized or invalid business context' };
    }

    const role = tenantContext.membership.role;
    if (role !== 'business_owner' && role !== 'branch_manager') {
      return { success: false, message: 'Forbidden: Insufficient permissions to generate Branch QR code' };
    }

    const supabase = await createClient();
    const branchId = tenantContext.defaultBranch.id;

    // Generate secure token pair
    const { rawToken, tokenHash, tokenPrefix, encryptedToken } = generateSecureQrToken();

    // Revoke any existing active QR code for this branch
    await supabase
      .from('branch_qr_codes')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_by: tenantContext.user.id,
      })
      .eq('branch_id', branchId)
      .eq('is_active', true);

    // Insert new active branch QR record
    const { data: qr, error: qrErr } = await supabase
      .from('branch_qr_codes')
      .insert({
        business_id: tenantContext.business.id,
        branch_id: branchId,
        token_hash: tokenHash,
        token_prefix: tokenPrefix,
        encrypted_token: encryptedToken,
        version: 1,
        is_active: true,
        generated_by: tenantContext.user.id,
        generated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (qrErr || !qr) {
      return { success: false, message: qrErr?.message || 'Failed to create Branch QR record in database' };
    }

    // Write Audit Log
    await supabase.from('audit_logs').insert({
      business_id: tenantContext.business.id,
      actor_id: tenantContext.user.id,
      action: 'branch_qr.generated',
      target_type: 'branch_qr_code',
      target_id: qr.id,
      payload: { branch_id: branchId, version: 1, token_prefix: tokenPrefix },
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
   * Regenerates a new Branch QR code, invalidating the previous version.
   */
  static async regenerateBranchQr(): Promise<BranchQrResult> {
    const tenantContext = await resolveActiveBusinessContext();
    if (!tenantContext || !tenantContext.defaultBranch) {
      return { success: false, message: 'Unauthorized or invalid business context' };
    }

    const role = tenantContext.membership.role;
    if (role !== 'business_owner' && role !== 'branch_manager') {
      return { success: false, message: 'Forbidden: Insufficient permissions to regenerate Branch QR code' };
    }

    const supabase = await createClient();
    const branchId = tenantContext.defaultBranch.id;

    // Fetch existing QR record for version increment
    const { data: existingQr } = await supabase
      .from('branch_qr_codes')
      .select('version')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .maybeSingle();

    const newVersion = (existingQr?.version || 1) + 1;

    // Revoke old QR code
    await supabase
      .from('branch_qr_codes')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_by: tenantContext.user.id,
      })
      .eq('branch_id', branchId)
      .eq('is_active', true);

    // Generate new token pair
    const { rawToken, tokenHash, tokenPrefix, encryptedToken } = generateSecureQrToken();

    const { data: qr, error: qrErr } = await supabase
      .from('branch_qr_codes')
      .insert({
        business_id: tenantContext.business.id,
        branch_id: branchId,
        token_hash: tokenHash,
        token_prefix: tokenPrefix,
        encrypted_token: encryptedToken,
        version: newVersion,
        is_active: true,
        generated_by: tenantContext.user.id,
        generated_at: new Date().toISOString(),
        last_regenerated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (qrErr || !qr) {
      return { success: false, message: qrErr?.message || 'Failed to regenerate Branch QR code' };
    }

    // Write Audit Log
    await supabase.from('audit_logs').insert({
      business_id: tenantContext.business.id,
      actor_id: tenantContext.user.id,
      action: 'branch_qr.regenerated',
      target_type: 'branch_qr_code',
      target_id: qr.id,
      payload: { branch_id: branchId, new_version: newVersion, token_prefix: tokenPrefix },
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
   * Revokes/disables the active Branch QR code.
   */
  static async disableBranchQr(): Promise<{ success: boolean; message?: string }> {
    const tenantContext = await resolveActiveBusinessContext();
    if (!tenantContext || !tenantContext.defaultBranch) {
      return { success: false, message: 'Unauthorized' };
    }

    const role = tenantContext.membership.role;
    if (role !== 'business_owner' && role !== 'branch_manager') {
      return { success: false, message: 'Forbidden' };
    }

    const supabase = await createClient();
    const branchId = tenantContext.defaultBranch.id;

    const { data: updated, error } = await supabase
      .from('branch_qr_codes')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_by: tenantContext.user.id,
      })
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .select();

    if (error) {
      return { success: false, message: error.message };
    }

    if (updated && updated.length > 0) {
      await supabase.from('audit_logs').insert({
        business_id: tenantContext.business.id,
        actor_id: tenantContext.user.id,
        action: 'branch_qr.disabled',
        target_type: 'branch_qr_code',
        target_id: updated[0].id,
        payload: { branch_id: branchId },
      });
    }

    return { success: true };
  }

  /**
   * Updates Branch ordering settings (require_table_selection, require_table_pin, table_pin_length).
   */
  static async updateBranchOrderingSettings(settings: {
    require_table_selection?: boolean;
    require_table_pin?: boolean;
    table_pin_length?: number;
  }): Promise<{ success: boolean; message?: string }> {
    const tenantContext = await resolveActiveBusinessContext();
    if (!tenantContext || !tenantContext.defaultBranch) {
      return { success: false, message: 'Unauthorized' };
    }

    const role = tenantContext.membership.role;
    if (role !== 'business_owner' && role !== 'branch_manager') {
      return { success: false, message: 'Forbidden: Owner or Branch Manager role required' };
    }

    // Rule: require_table_pin cannot be enabled if require_table_selection is disabled
    const nextSelection = settings.require_table_selection ?? tenantContext.defaultBranch.require_table_selection ?? true;
    let nextPin = settings.require_table_pin ?? tenantContext.defaultBranch.require_table_pin ?? false;
    let nextLength = settings.table_pin_length ?? tenantContext.defaultBranch.table_pin_length ?? 4;

    if (!nextSelection) {
      nextPin = false; // Bypass PIN if table selection is OFF
    }

    if (![4, 5, 6].includes(nextLength)) {
      nextLength = 4;
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from('branches')
      .update({
        require_table_selection: nextSelection,
        require_table_pin: nextPin,
        table_pin_length: nextLength,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantContext.defaultBranch.id);

    if (error) {
      return { success: false, message: error.message };
    }

    await supabase.from('audit_logs').insert({
      business_id: tenantContext.business.id,
      actor_id: tenantContext.user.id,
      action: 'branch.settings_updated',
      target_type: 'branch',
      target_id: tenantContext.defaultBranch.id,
      payload: { require_table_selection: nextSelection, require_table_pin: nextPin, table_pin_length: nextLength },
    });

    return { success: true };
  }

  /**
   * Resolves a raw public QR token to its branch menu payload via RPC.
   */
  static async resolvePublicBranchMenuByToken(rawToken: string) {
    const tokenHash = hashQrToken(rawToken);
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('resolve_public_branch_menu', {
      p_token_hash: tokenHash,
    });

    if (error || !data) {
      return { success: false, error: 'INVALID_QR' };
    }

    // Pass the raw token through to client state for share/copy links
    const payload = data as Record<string, unknown>;
    payload.rawToken = rawToken;

    return payload;
  }

  /**
   * Fetches active branch QR record for owner management dashboard.
   */
  static async getActiveBranchQr() {
    const tenantContext = await resolveActiveBusinessContext();
    if (!tenantContext || !tenantContext.defaultBranch) return null;

    const supabase = await createClient();

    const { data: qr } = await supabase
      .from('branch_qr_codes')
      .select('*')
      .eq('branch_id', tenantContext.defaultBranch.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!qr) return null;

    const rawToken = decryptRawToken(qr.encrypted_token);

    return {
      ...qr,
      rawToken,
    };
  }
}
