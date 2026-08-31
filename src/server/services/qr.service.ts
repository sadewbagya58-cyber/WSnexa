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

export interface PublicBranchMenuResult {
  success: boolean;
  error?: string;
  scope?: string;
  qr_scope?: string;
  service_area_id?: string | null;
  service_area_name?: string | null;
  rawToken?: string;
  qrVisitSessionToken?: string | null;
  business?: Record<string, unknown>;
  branch?: Record<string, unknown>;
  service_areas?: Array<Record<string, unknown>>;
  dining_tables?: Array<Record<string, unknown>>;
  categories?: Array<Record<string, unknown>>;
  items?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export class QrService {

  /**
   * Generates a new active Branch QR code for the current branch.
   */
  static async generateBranchQr(): Promise<BranchQrResult> {
    const { can, resolveAuthorizationContext } = await import('@/server/auth');
    let authContext;
    try {
      authContext = await resolveAuthorizationContext();
    } catch {
      return { success: false, message: 'Unauthorized or invalid business context' };
    }

    if (!authContext || !authContext.activeBranchId) {
      return { success: false, message: 'Unauthorized or invalid business context' };
    }

    const branchResource = { type: 'branch' as const, id: authContext.activeBranchId };
    const isAuthorized =
      (await can({ context: authContext, permission: 'qr.generate', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'qr.manage', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'tables.manage', resource: branchResource }));

    if (!isAuthorized) {
      return { success: false, message: 'Forbidden: Insufficient permissions to generate Branch QR code' };
    }

    const supabase = await createClient();
    const branchId = authContext.activeBranchId;

    // Generate secure token pair
    const { rawToken, tokenHash, tokenPrefix, encryptedToken } = generateSecureQrToken();

    // Revoke any existing active QR code for this branch
    await supabase
      .from('branch_qr_codes')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_by: authContext.userId,
      })
      .eq('branch_id', branchId)
      .eq('is_active', true);

    // Insert new active branch QR record
    const { data: qr, error: qrErr } = await supabase
      .from('branch_qr_codes')
      .insert({
        business_id: authContext.businessId,
        branch_id: branchId,
        token_hash: tokenHash,
        token_prefix: tokenPrefix,
        encrypted_token: encryptedToken,
        version: 1,
        is_active: true,
        generated_by: authContext.userId,
        generated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (qrErr || !qr) {
      return { success: false, message: qrErr?.message || 'Failed to create Branch QR record in database' };
    }

    // Write Audit Log
    await supabase.from('audit_logs').insert({
      business_id: authContext.businessId,
      actor_id: authContext.userId,
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
    const { can, resolveAuthorizationContext } = await import('@/server/auth');
    let authContext;
    try {
      authContext = await resolveAuthorizationContext();
    } catch {
      return { success: false, message: 'Unauthorized or invalid business context' };
    }

    if (!authContext || !authContext.activeBranchId) {
      return { success: false, message: 'Unauthorized or invalid business context' };
    }

    const branchResource = { type: 'branch' as const, id: authContext.activeBranchId };
    const isAuthorized =
      (await can({ context: authContext, permission: 'qr.security.reset', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'qr.manage', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'tables.manage', resource: branchResource }));

    if (!isAuthorized) {
      return { success: false, message: 'Forbidden: Insufficient permissions to regenerate Branch QR code' };
    }

    const supabase = await createClient();
    const branchId = authContext.activeBranchId;

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
        revoked_by: authContext.userId,
      })
      .eq('branch_id', branchId)
      .eq('is_active', true);

    // Generate new token pair
    const { rawToken, tokenHash, tokenPrefix, encryptedToken } = generateSecureQrToken();

    const { data: qr, error: qrErr } = await supabase
      .from('branch_qr_codes')
      .insert({
        business_id: authContext.businessId,
        branch_id: branchId,
        token_hash: tokenHash,
        token_prefix: tokenPrefix,
        encrypted_token: encryptedToken,
        version: newVersion,
        is_active: true,
        generated_by: authContext.userId,
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
      business_id: authContext.businessId,
      actor_id: authContext.userId,
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
    const { can, resolveAuthorizationContext } = await import('@/server/auth');
    let authContext;
    try {
      authContext = await resolveAuthorizationContext();
    } catch {
      return { success: false, message: 'Unauthorized' };
    }

    if (!authContext || !authContext.activeBranchId) {
      return { success: false, message: 'Unauthorized' };
    }

    const branchResource = { type: 'branch' as const, id: authContext.activeBranchId };
    const isAuthorized =
      (await can({ context: authContext, permission: 'qr.manage', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'tables.manage', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'business.settings.manage' }));

    if (!isAuthorized) {
      return { success: false, message: 'Forbidden' };
    }

    const supabase = await createClient();
    const branchId = authContext.activeBranchId;

    const { data: updated, error } = await supabase
      .from('branch_qr_codes')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_by: authContext.userId,
      })
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .select();

    if (error) {
      return { success: false, message: error.message };
    }

    if (updated && updated.length > 0) {
      await supabase.from('audit_logs').insert({
        business_id: authContext.businessId,
        actor_id: authContext.userId,
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
    const { can, resolveAuthorizationContext } = await import('@/server/auth');
    let authContext;
    try {
      authContext = await resolveAuthorizationContext();
    } catch {
      return { success: false, message: 'Unauthorized' };
    }

    if (!authContext || !authContext.activeBranchId) {
      return { success: false, message: 'Unauthorized' };
    }

    const branchResource = { type: 'branch' as const, id: authContext.activeBranchId };
    const isAuthorized =
      (await can({ context: authContext, permission: 'branches.operational.manage', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'branches.manage', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'business.settings.manage' }));

    if (!isAuthorized) {
      return { success: false, message: 'Forbidden: Insufficient permissions to update branch ordering settings' };
    }

    const supabase = await createClient();

    // Fetch existing branch config
    const { data: currentBranch } = await supabase
      .from('branches')
      .select('require_table_selection, require_table_pin, table_pin_length')
      .eq('id', authContext.activeBranchId)
      .single();

    // Rule: require_table_pin cannot be enabled if require_table_selection is disabled
    const nextSelection = settings.require_table_selection ?? currentBranch?.require_table_selection ?? true;
    let nextPin = settings.require_table_pin ?? currentBranch?.require_table_pin ?? false;
    let nextLength = settings.table_pin_length ?? currentBranch?.table_pin_length ?? 4;

    if (!nextSelection) {
      nextPin = false; // Bypass PIN if table selection is OFF
    }

    if (![4, 5, 6].includes(nextLength)) {
      nextLength = 4;
    }

    const { error } = await supabase
      .from('branches')
      .update({
        require_table_selection: nextSelection,
        require_table_pin: nextPin,
        table_pin_length: nextLength,
        updated_at: new Date().toISOString(),
      })
      .eq('id', authContext.activeBranchId);

    if (error) {
      return { success: false, message: error.message };
    }

    await supabase.from('audit_logs').insert({
      business_id: authContext.businessId,
      actor_id: authContext.userId,
      action: 'branch.settings_updated',
      target_type: 'branch',
      target_id: authContext.activeBranchId,
      payload: { require_table_selection: nextSelection, require_table_pin: nextPin, table_pin_length: nextLength },
    });

    return { success: true };
  }

  /**
   * Resolves a raw public QR token (Area QR or Branch QR) to its menu payload.
   */
  static async resolvePublicBranchMenuByToken(rawToken: string): Promise<PublicBranchMenuResult> {
    if (!rawToken || typeof rawToken !== 'string') {

      return { success: false, error: 'INVALID_QR' };
    }

    const { verifyAreaQrToken } = await import('@/lib/qr/area-qr-token');
    const areaVerification = verifyAreaQrToken(rawToken);

    // If token claims to be an Area QR token but is invalid/tampered, reject immediately
    if (rawToken.startsWith('WSN-AQ.')) {
      if (!areaVerification.valid || !areaVerification.payload) {
        return { success: false, error: 'INVALID_QR' };
      }
    }

    // ── 1. AREA-LEVEL QR RESOLUTION ──────────────────────────────────────
    if (areaVerification.valid && areaVerification.payload) {
      const { branchId, areaId, businessId, version } = areaVerification.payload;
      const { createAdminClient } = await import('@/lib/supabase/server');
      const admin = createAdminClient();

      // 1a. Authoritative persistent DB Area QR record lookup
      const tokenHash = hashQrToken(rawToken);
      const { data: dbAreaQr, error: dbQrErr } = await admin
        .from('area_qr_codes')
        .select('id, business_id, branch_id, service_area_id, version, is_active, revoked_at, expires_at')
        .eq('token_hash', tokenHash)
        .maybeSingle();

      // Enforce authoritative persistent DB state
      if (!dbQrErr) {
        if (!dbAreaQr) {
          return { success: false, error: 'INVALID_OR_REVOKED_QR' };
        }
        if (!dbAreaQr.is_active || dbAreaQr.revoked_at !== null) {
          return { success: false, error: 'QR_REVOKED' };
        }
        if (dbAreaQr.expires_at && new Date(dbAreaQr.expires_at).getTime() < Date.now()) {
          return { success: false, error: 'QR_EXPIRED' };
        }
        if (
          dbAreaQr.business_id !== businessId ||
          dbAreaQr.branch_id !== branchId ||
          dbAreaQr.service_area_id !== areaId ||
          dbAreaQr.version !== version
        ) {
          return { success: false, error: 'TOKEN_METADATA_MISMATCH' };
        }
      }

      // Fetch Area and verify it is active and non-deleted
      const { data: area, error: areaErr } = await admin
        .from('service_areas')
        .select('id, business_id, branch_id, name, code, description, display_order, is_active, deleted_at')
        .eq('id', areaId)
        .eq('branch_id', branchId)
        .is('deleted_at', null)
        .maybeSingle();

      if (areaErr || !area || !area.is_active) {
        return { success: false, error: 'AREA_UNAVAILABLE' };
      }

      // Fetch Branch details
      const { data: branch, error: branchErr } = await admin
        .from('branches')
        .select('id, name, code, phone, address_line_1, city, status, deleted_at, require_table_selection, require_table_pin, table_pin_length')
        .eq('id', branchId)
        .is('deleted_at', null)
        .maybeSingle();

      if (branchErr || !branch || branch.status !== 'active') {
        return { success: false, error: 'BRANCH_UNAVAILABLE' };
      }

      // Fetch Business details
      const { data: business, error: bizErr } = await admin
        .from('businesses')
        .select('id, name, logo_url, description, default_currency')
        .eq('id', businessId)
        .maybeSingle();

      if (bizErr || !business) {
        return { success: false, error: 'BUSINESS_UNAVAILABLE' };
      }

      // Fetch Dining Tables strictly scoped to this service area
      const { data: diningTables } = await admin
        .from('dining_tables')
        .select('id, name, code, table_number, capacity, service_area_id, is_active, deleted_at, table_pin_hash, display_order')
        .eq('business_id', businessId)
        .eq('branch_id', branchId)
        .eq('service_area_id', areaId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('display_order', { ascending: true });

      // Fetch Active Categories
      const { data: categories } = await admin
        .from('menu_categories')
        .select('id, name, slug, description, display_order, is_active, deleted_at')
        .eq('business_id', businessId)
        .eq('branch_id', branchId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('display_order', { ascending: true });

      // Fetch Active Menu Items with Modifiers
      const { data: items } = await admin
        .from('menu_items')
        .select(`
          id, category_id, name, slug, description, price_cents, currency,
          availability_status, is_featured, primary_image_url, display_order,
          modifier_groups (
            id, name, description, selection_type, min_selections, max_selections, is_required, display_order, is_active, deleted_at,
            modifier_options (
              id, name, additional_price_cents, is_active, display_order, deleted_at
            )
          )
        `)
        .eq('business_id', businessId)
        .eq('branch_id', branchId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .neq('availability_status', 'hidden')
        .order('display_order', { ascending: true });

      // Format Items & Modifiers
      const formattedItems = (items || []).map((item) => {
        const activeGroups = ((item.modifier_groups || []) as Array<{
          id: string;
          name: string;
          description: string | null;
          selection_type: string;
          min_selections: number;
          max_selections: number;
          is_required: boolean;
          display_order: number;
          is_active: boolean;
          deleted_at: string | null;
          modifier_options: Array<{
            id: string;
            name: string;
            additional_price_cents: number;
            is_active: boolean;
            display_order: number;
            deleted_at: string | null;
          }>;
        }>)
          .filter((g) => g.is_active && !g.deleted_at)
          .map((g) => ({
            id: g.id,
            name: g.name,
            description: g.description,
            selection_type: g.selection_type,
            min_selections: g.min_selections,
            max_selections: g.max_selections,
            is_required: g.is_required,
            display_order: g.display_order,
            options: (g.modifier_options || [])
              .filter((o) => o.is_active && !o.deleted_at)
              .map((o) => ({
                id: o.id,
                name: o.name,
                price_cents: o.additional_price_cents,
                is_available: o.is_active,
                display_order: o.display_order,
              })),
          }));

        return {
          id: item.id,
          category_id: item.category_id,
          name: item.name,
          slug: item.slug,
          description: item.description,
          price_cents: item.price_cents,
          currency: item.currency,
          availability_status: item.availability_status,
          is_featured: item.is_featured,
          primary_image_url: item.primary_image_url,
          display_order: item.display_order,
          modifier_groups: activeGroups,
        };
      });

      // Create QR visit session tied to this area
      const { OrderSecurityService } = await import('./order-security.service');
      const sessionRes = await OrderSecurityService.createQrVisitSession(
        branch.id,
        area.id,
        null
      );

      return {
        success: true,
        scope: 'area',
        qr_scope: 'area',
        service_area_id: area.id,
        service_area_name: area.name,
        rawToken,
        qrVisitSessionToken: sessionRes.sessionToken || null,
        business: {
          id: business.id,
          name: business.name,
          logo_url: business.logo_url,
          description: business.description,
          currency: business.default_currency,
        },
        branch: {
          id: branch.id,
          name: branch.name,
          code: branch.code,
          phone: branch.phone,
          address_line1: branch.address_line_1,
          city: branch.city,
          require_table_selection: branch.require_table_selection,
          require_table_pin: branch.require_table_pin,
          table_pin_length: branch.table_pin_length,
        },
        service_areas: [
          {
            id: area.id,
            name: area.name,
            code: area.code,
            display_order: area.display_order,
          },
        ],
        dining_tables: (diningTables || []).map((t) => ({
          id: t.id,
          name: t.name,
          code: t.code,
          table_number: t.table_number,
          capacity: t.capacity,
          service_area_id: t.service_area_id,
          has_pin: Boolean(t.table_pin_hash),
        })),
        categories: (categories || []).map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description,
          display_order: c.display_order,
        })),
        items: formattedItems,
      };
    }

    // ── 2. BRANCH-LEVEL QR RESOLUTION (Backwards Compatible) ─────────────
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
    payload.success = true;
    payload.rawToken = rawToken;
    payload.scope = 'branch';
    payload.qr_scope = 'branch';

    const branchObj = payload.branch as { id?: string };
    const serviceAreaId = (payload.service_area_id as string) || null;
    const tableId = (payload.table_id as string) || null;

    if (branchObj && branchObj.id) {
      const { OrderSecurityService } = await import('./order-security.service');
      const sessionRes = await OrderSecurityService.createQrVisitSession(
        branchObj.id,
        serviceAreaId,
        tableId
      );
      if (sessionRes.success && sessionRes.sessionToken) {
        payload.qrVisitSessionToken = sessionRes.sessionToken;
      }
    }

    return payload as PublicBranchMenuResult;
  }

  /**
   * Generates a new active Area QR code for a specified service area, persisting to DB.
   */
  static async generateAreaQr(areaId: string): Promise<BranchQrResult & { areaId?: string; areaName?: string }> {
    const { can, resolveAuthorizationContext } = await import('@/server/auth');
    let authContext;
    try {
      authContext = await resolveAuthorizationContext();
    } catch {
      return { success: false, message: 'Unauthorized or invalid business context' };
    }

    if (!authContext || !authContext.activeBranchId) {
      return { success: false, message: 'Unauthorized or invalid business context' };
    }

    const branchResource = { type: 'branch' as const, id: authContext.activeBranchId };
    const isAuthorized =
      (await can({ context: authContext, permission: 'qr.generate', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'qr.manage', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'tables.manage', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'areas.manage', resource: branchResource })) ||
      authContext.isBusinessOwner;

    if (!isAuthorized) {
      return { success: false, message: 'Forbidden: Insufficient permissions to generate Area QR code' };
    }

    const supabase = await createClient();

    // Verify service area exists and belongs to active branch
    const { data: area, error: areaErr } = await supabase
      .from('service_areas')
      .select('id, name, code, is_active')
      .eq('id', areaId)
      .eq('branch_id', authContext.activeBranchId)
      .is('deleted_at', null)
      .single();

    if (areaErr || !area) {
      return { success: false, message: 'Service Area not found or deleted' };
    }

    const { createSignedAreaQrToken } = await import('@/lib/qr/area-qr-token');
    const { encryptRawToken } = await import('@/lib/qr/security');
    const { rawToken, tokenPrefix } = createSignedAreaQrToken(
      authContext.businessId,
      authContext.activeBranchId,
      areaId,
      1
    );

    const tokenHash = hashQrToken(rawToken);
    const encryptedToken = encryptRawToken(rawToken);

    // Deactivate any existing active Area QR code for this service area
    await supabase
      .from('area_qr_codes')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_by: authContext.userId,
        updated_at: new Date().toISOString(),
      })
      .eq('service_area_id', areaId)
      .eq('is_active', true);

    // Insert authoritative persistent Area QR record
    await supabase.from('area_qr_codes').insert({
      business_id: authContext.businessId,
      branch_id: authContext.activeBranchId,
      service_area_id: areaId,
      token_hash: tokenHash,
      token_prefix: tokenPrefix,
      encrypted_token: encryptedToken,
      version: 1,
      is_active: true,
      generated_by: authContext.userId,
      generated_at: new Date().toISOString(),
    });

    // Audit Log
    await supabase.from('audit_logs').insert({
      business_id: authContext.businessId,
      actor_id: authContext.userId,
      action: 'area_qr.generated',
      target_type: 'service_area',
      target_id: areaId,
      payload: {
        branch_id: authContext.activeBranchId,
        area_id: areaId,
        area_name: area.name,
        token_prefix: tokenPrefix,
        version: 1,
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const qrUrl = `${baseUrl}/m/${rawToken}`;

    return {
      success: true,
      rawToken,
      qrUrl,
      qrCodeId: `area_qr_${areaId}_v1`,
      areaId: area.id,
      areaName: area.name,
    };
  }

  /**
   * Regenerates an Area QR code, invalidating previous versions in DB.
   */
  static async regenerateAreaQr(
    areaId: string,
    currentVersion: number = 1
  ): Promise<BranchQrResult & { areaId?: string; areaName?: string; version?: number }> {
    const { can, resolveAuthorizationContext } = await import('@/server/auth');
    let authContext;
    try {
      authContext = await resolveAuthorizationContext();
    } catch {
      return { success: false, message: 'Unauthorized or invalid business context' };
    }

    if (!authContext || !authContext.activeBranchId) {
      return { success: false, message: 'Unauthorized or invalid business context' };
    }

    const branchResource = { type: 'branch' as const, id: authContext.activeBranchId };
    const isAuthorized =
      (await can({ context: authContext, permission: 'qr.security.reset', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'qr.manage', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'tables.manage', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'areas.manage', resource: branchResource })) ||
      authContext.isBusinessOwner;

    if (!isAuthorized) {
      return { success: false, message: 'Forbidden: Insufficient permissions to regenerate Area QR code' };
    }

    const supabase = await createClient();

    const { data: area, error: areaErr } = await supabase
      .from('service_areas')
      .select('id, name, code, is_active')
      .eq('id', areaId)
      .eq('branch_id', authContext.activeBranchId)
      .is('deleted_at', null)
      .single();

    if (areaErr || !area) {
      return { success: false, message: 'Service Area not found or deleted' };
    }

    const newVersion = currentVersion + 1;
    const { createSignedAreaQrToken } = await import('@/lib/qr/area-qr-token');
    const { encryptRawToken } = await import('@/lib/qr/security');
    const { rawToken, tokenPrefix } = createSignedAreaQrToken(
      authContext.businessId,
      authContext.activeBranchId,
      areaId,
      newVersion
    );

    const tokenHash = hashQrToken(rawToken);
    const encryptedToken = encryptRawToken(rawToken);

    // Deactivate and revoke previous active records for this area
    await supabase
      .from('area_qr_codes')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_by: authContext.userId,
        updated_at: new Date().toISOString(),
      })
      .eq('service_area_id', areaId)
      .eq('is_active', true);

    // Insert new version into area_qr_codes
    await supabase.from('area_qr_codes').insert({
      business_id: authContext.businessId,
      branch_id: authContext.activeBranchId,
      service_area_id: areaId,
      token_hash: tokenHash,
      token_prefix: tokenPrefix,
      encrypted_token: encryptedToken,
      version: newVersion,
      is_active: true,
      generated_by: authContext.userId,
      generated_at: new Date().toISOString(),
      last_regenerated_at: new Date().toISOString(),
    });

    // Audit Log
    await supabase.from('audit_logs').insert({
      business_id: authContext.businessId,
      actor_id: authContext.userId,
      action: 'area_qr.regenerated',
      target_type: 'service_area',
      target_id: areaId,
      payload: {
        branch_id: authContext.activeBranchId,
        area_id: areaId,
        area_name: area.name,
        token_prefix: tokenPrefix,
        version: newVersion,
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const qrUrl = `${baseUrl}/m/${rawToken}`;

    return {
      success: true,
      rawToken,
      qrUrl,
      qrCodeId: `area_qr_${areaId}_v${newVersion}`,
      areaId: area.id,
      areaName: area.name,
      version: newVersion,
    };
  }

  /**
   * Disables/revokes an Area QR code in DB.
   */
  static async disableAreaQr(areaId: string): Promise<{ success: boolean; message?: string }> {
    const { can, resolveAuthorizationContext } = await import('@/server/auth');
    let authContext;
    try {
      authContext = await resolveAuthorizationContext();
    } catch {
      return { success: false, message: 'Unauthorized' };
    }

    if (!authContext || !authContext.activeBranchId) {
      return { success: false, message: 'Unauthorized' };
    }

    const branchResource = { type: 'branch' as const, id: authContext.activeBranchId };
    const isAuthorized =
      (await can({ context: authContext, permission: 'qr.manage', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'tables.manage', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'areas.manage', resource: branchResource })) ||
      authContext.isBusinessOwner;

    if (!isAuthorized) {
      return { success: false, message: 'Forbidden' };
    }

    const supabase = await createClient();

    // Revoke active Area QR record
    await supabase
      .from('area_qr_codes')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_by: authContext.userId,
        updated_at: new Date().toISOString(),
      })
      .eq('service_area_id', areaId)
      .eq('is_active', true);

    await supabase.from('audit_logs').insert({
      business_id: authContext.businessId,
      actor_id: authContext.userId,
      action: 'area_qr.disabled',
      target_type: 'service_area',
      target_id: areaId,
      payload: {
        branch_id: authContext.activeBranchId,
        area_id: areaId,
      },
    });

    return { success: true };
  }

  /**
   * Retrieves active Area QR metadata for a specified service area from DB.
   */
  static async getActiveAreaQr(areaId: string) {
    const tenantContext = await resolveActiveBusinessContext();
    if (!tenantContext || !tenantContext.activeBranch) return null;

    const supabase = await createClient();

    const [areaRes, qrRes] = await Promise.all([
      supabase
        .from('service_areas')
        .select('id, name, code, is_active, deleted_at')
        .eq('id', areaId)
        .eq('branch_id', tenantContext.activeBranch.id)
        .is('deleted_at', null)
        .maybeSingle(),
      supabase
        .from('area_qr_codes')
        .select('*')
        .eq('service_area_id', areaId)
        .eq('is_active', true)
        .maybeSingle(),
    ]);

    const area = areaRes.data;
    if (!area || !area.is_active) return null;

    const qr = qrRes.data;
    if (!qr) return null;

    const { decryptRawToken } = await import('@/lib/qr/security');
    const { createSignedAreaQrToken } = await import('@/lib/qr/area-qr-token');
    const rawToken =
      (qr.encrypted_token ? decryptRawToken(qr.encrypted_token) : null) ||
      createSignedAreaQrToken(tenantContext.business.id, tenantContext.activeBranch.id, area.id, qr.version).rawToken;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    return {
      id: qr.id,
      areaId: area.id,
      areaName: area.name,
      areaCode: area.code,
      version: qr.version,
      token_prefix: qr.token_prefix,
      rawToken,
      qrUrl: `${baseUrl}/m/${rawToken}`,
      is_active: qr.is_active,
      generated_at: qr.generated_at,
    };
  }

  /**
   * Lists all active service areas in the branch with their persisted Area QR metadata and table stats.
   */
  static async listBranchAreaQrs() {
    const tenantContext = await resolveActiveBusinessContext();
    if (!tenantContext || !tenantContext.activeBranch) return [];

    const supabase = await createClient();
    const branchId = tenantContext.activeBranch.id;
    const businessId = tenantContext.business.id;

    const [areasRes, tablesRes, qrsRes] = await Promise.all([
      supabase
        .from('service_areas')
        .select('id, name, code, description, display_order, is_active')
        .eq('business_id', businessId)
        .eq('branch_id', branchId)
        .is('deleted_at', null)
        .order('display_order', { ascending: true }),
      supabase
        .from('dining_tables')
        .select('id, service_area_id, table_pin_hash, is_active')
        .eq('business_id', businessId)
        .eq('branch_id', branchId)
        .is('deleted_at', null)
        .eq('is_active', true),
      supabase
        .from('area_qr_codes')
        .select('*')
        .eq('business_id', businessId)
        .eq('branch_id', branchId)
        .eq('is_active', true),
    ]);

    const areas = areasRes.data || [];
    const tables = tablesRes.data || [];
    const qrs = qrsRes.data || [];

    const { decryptRawToken } = await import('@/lib/qr/security');
    const { createSignedAreaQrToken } = await import('@/lib/qr/area-qr-token');
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    return areas.map((area) => {
      const areaTables = tables.filter((t) => t.service_area_id === area.id);
      const tablesWithPin = areaTables.filter((t) => t.table_pin_hash !== null).length;
      const activeQrRecord = qrs.find((q) => q.service_area_id === area.id);

      let rawToken: string;
      let tokenPrefix: string;
      let version = 1;
      let generatedAt = new Date().toISOString();

      if (activeQrRecord) {
        rawToken =
          (activeQrRecord.encrypted_token ? decryptRawToken(activeQrRecord.encrypted_token) : null) ||
          createSignedAreaQrToken(businessId, branchId, area.id, activeQrRecord.version).rawToken;
        tokenPrefix = activeQrRecord.token_prefix;
        version = activeQrRecord.version;
        generatedAt = activeQrRecord.generated_at;
      } else {
        const generated = createSignedAreaQrToken(businessId, branchId, area.id, 1);
        rawToken = generated.rawToken;
        tokenPrefix = generated.tokenPrefix;
        generatedAt = generated.issuedAt;
      }

      return {
        areaId: area.id,
        areaName: area.name,
        areaCode: area.code,
        description: area.description,
        isActive: area.is_active,
        tableCount: areaTables.length,
        tablesWithPinCount: tablesWithPin,
        version,
        tokenPrefix,
        rawToken,
        qrUrl: `${baseUrl}/m/${rawToken}`,
        generatedAt,
      };
    });
  }


  /**
   * Fetches active branch QR record for owner management dashboard.

   */
  static async getActiveBranchQr() {
    const tenantContext = await resolveActiveBusinessContext();
    if (!tenantContext || !tenantContext.activeBranch) return null;

    const supabase = await createClient();

    const { data: qr } = await supabase
      .from('branch_qr_codes')
      .select('*')
      .eq('branch_id', tenantContext.activeBranch.id)
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
