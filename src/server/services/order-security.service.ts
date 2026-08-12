import { createAdminClient } from '@/lib/supabase/server';
import crypto from 'crypto';
import {
  BranchOrderSecuritySettings,
  QrVisitSession,
  TableSession,
  SecurityPresetLevel,
} from '@/types/database.types';

export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export interface SecurityEvaluationInput {
  branchId: string;
  tableId?: string | null;
  qrSessionToken?: string | null;
  customerId?: string | null;
  userCoordinates?: { latitude: number; longitude: number; accuracy?: number } | null;
  locationProof?: string | null;
  isServerVerifiedOnlinePayment?: boolean;
  orderSource?: 'qr_customer' | 'waiter' | 'pos_cashier' | 'other';
}

export interface SecurityEvaluationResult {
  allowed: boolean;
  requiresWaiterApproval: boolean;
  checks: {
    qrSession: 'passed' | 'failed' | 'not_applicable';
    customerAccount: 'passed' | 'failed' | 'not_applicable';
    location: 'passed' | 'failed' | 'not_applicable';
    tableSession: 'passed' | 'failed' | 'not_applicable';
    paymentBypass: 'applied' | 'not_applicable';
  };
  failureReason?: string;
  failureCode?: string;
  qrVisitSessionId?: string | null;
  tableSessionId?: string | null;
}

export class OrderSecurityService {
  /**
   * Generates a signed, short-lived (15-minute) location verification proof token.
   */
  static createLocationProof(
    branchId: string,
    latitude: number,
    longitude: number,
    tableId?: string | null
  ): string {
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15m expiry
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || 'wsnexa_loc_secret';
    const dataToSign = `${branchId}:${tableId || ''}:${latitude}:${longitude}:${expiresAt}`;
    const signature = crypto.createHmac('sha256', secret).update(dataToSign).digest('hex');
    const payload = { branchId, tableId: tableId || null, latitude, longitude, expiresAt, signature };
    return Buffer.from(JSON.stringify(payload)).toString('base64url');
  }

  /**
   * Validates a signed location verification proof token.
   */
  static verifyLocationProof(
    proofString: string,
    expectedBranchId: string
  ): { valid: boolean; latitude?: number; longitude?: number; reason?: string } {
    try {
      const raw = Buffer.from(proofString, 'base64url').toString('utf8');
      const payload = JSON.parse(raw);
      if (!payload.expiresAt || payload.expiresAt < Date.now()) {
        return { valid: false, reason: 'Location verification expired. Please verify your location again.' };
      }
      if (payload.branchId !== expectedBranchId) {
        return { valid: false, reason: 'Location verification belongs to another branch.' };
      }
      const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || 'wsnexa_loc_secret';
      const dataToSign = `${payload.branchId}:${payload.tableId || ''}:${payload.latitude}:${payload.longitude}:${payload.expiresAt}`;
      const expectedSig = crypto.createHmac('sha256', secret).update(dataToSign).digest('hex');
      if (payload.signature !== expectedSig) {
        return { valid: false, reason: 'Invalid location verification proof.' };
      }
      return { valid: true, latitude: payload.latitude, longitude: payload.longitude };
    } catch {
      return { valid: false, reason: 'Invalid location verification format.' };
    }
  }

  /**
   * Retrieves branch security settings directly from DB at submission time.
   */
  static async getBranchSecuritySettings(branchId: string): Promise<BranchOrderSecuritySettings> {
    const admin = createAdminClient();

    try {
      const { data: existing } = await admin
        .from('branch_order_security_settings')
        .select('*')
        .eq('branch_id', branchId)
        .maybeSingle();

      if (existing) {
        return existing as BranchOrderSecuritySettings;
      }
    } catch (err) {
      console.warn('[OrderSecurityService.getBranchSecuritySettings] DB fetch warning:', err);
    }

    let businessId = '';
    try {
      const { data: branchData } = await admin
        .from('branches')
        .select('business_id')
        .eq('id', branchId)
        .maybeSingle();
      businessId = branchData?.business_id || '';
    } catch {
      // ignore
    }

    const defaultPayload = {
      business_id: businessId,
      branch_id: branchId,
      require_customer_account: false,
      require_waiter_approval: false,
      require_location_verification: false,
      require_active_qr_session: true,
      require_table_session: true,
      qr_session_duration_minutes: 120,
      location_radius_meters: 150,
      allow_verified_online_payment_bypass: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const { data: seeded } = await admin
        .from('branch_order_security_settings')
        .upsert(defaultPayload, { onConflict: 'branch_id' })
        .select('*')
        .single();

      if (seeded) {
        return seeded as BranchOrderSecuritySettings;
      }
    } catch (err) {
      console.warn('[OrderSecurityService.getBranchSecuritySettings] DB seed warning:', err);
    }

    return {
      id: `sec_${branchId}`,
      ...defaultPayload,
    } as BranchOrderSecuritySettings;
  }

  /**
   * Updates branch order security settings in DB.
   */
  static async updateBranchSecuritySettings(
    branchId: string,
    updates: Partial<BranchOrderSecuritySettings>
  ): Promise<{ success: boolean; message?: string }> {
    const admin = createAdminClient();

    const existing = await this.getBranchSecuritySettings(branchId);

    const payload = {
      business_id: existing.business_id,
      branch_id: branchId,
      require_customer_account:
        updates.require_customer_account !== undefined
          ? updates.require_customer_account
          : existing.require_customer_account,
      require_waiter_approval:
        updates.require_waiter_approval !== undefined
          ? updates.require_waiter_approval
          : existing.require_waiter_approval,
      require_location_verification:
        updates.require_location_verification !== undefined
          ? updates.require_location_verification
          : existing.require_location_verification,
      require_active_qr_session:
        updates.require_active_qr_session !== undefined
          ? updates.require_active_qr_session
          : existing.require_active_qr_session,
      require_table_session:
        updates.require_table_session !== undefined
          ? updates.require_table_session
          : existing.require_table_session,
      qr_session_duration_minutes:
        updates.qr_session_duration_minutes !== undefined
          ? updates.qr_session_duration_minutes
          : existing.qr_session_duration_minutes,
      location_radius_meters:
        updates.location_radius_meters !== undefined
          ? updates.location_radius_meters
          : existing.location_radius_meters,
      allow_verified_online_payment_bypass:
        updates.allow_verified_online_payment_bypass !== undefined
          ? updates.allow_verified_online_payment_bypass
          : existing.allow_verified_online_payment_bypass,
      updated_at: new Date().toISOString(),
    };

    try {
      const { error } = await admin
        .from('branch_order_security_settings')
        .upsert(payload, { onConflict: 'branch_id' });

      if (error) {
        console.error('[OrderSecurityService.updateBranchSecuritySettings] Error:', error.message);
        return { success: false, message: error.message };
      }
    } catch (err) {
      console.error('[OrderSecurityService.updateBranchSecuritySettings] Exception:', err);
      return { success: false, message: 'Failed to update security settings.' };
    }

    return { success: true };
  }

  /**
   * Applies preset security configurations (LOW, BALANCED, HIGH).
   */
  static async applySecurityPreset(
    branchId: string,
    preset: SecurityPresetLevel
  ): Promise<{ success: boolean; message?: string }> {
    if (preset === 'custom') {
      return { success: true };
    }

    let updates: Partial<BranchOrderSecuritySettings> = {};

    switch (preset) {
      case 'low':
        updates = {
          require_active_qr_session: true,
          require_table_session: true,
          require_customer_account: false,
          require_location_verification: false,
          require_waiter_approval: false,
        };
        break;
      case 'balanced':
        updates = {
          require_active_qr_session: true,
          require_table_session: true,
          require_customer_account: true,
          require_location_verification: false,
          require_waiter_approval: true,
        };
        break;
      case 'high':
        updates = {
          require_active_qr_session: true,
          require_table_session: true,
          require_customer_account: true,
          require_location_verification: true,
          require_waiter_approval: true,
        };
        break;
    }

    return this.updateBranchSecuritySettings(branchId, updates);
  }

  /**
   * Creates or refreshes a temporary opaque QR visit session in DB.
   */
  static async createQrVisitSession(
    branchId: string,
    serviceAreaId?: string | null,
    tableId?: string | null,
    durationMinutes = 120
  ): Promise<{
    success: boolean;
    sessionId?: string;
    sessionToken?: string;
    expiresAt?: string;
    message?: string;
  }> {
    const admin = createAdminClient();
    let businessId = '';
    try {
      const { data: branchData } = await admin
        .from('branches')
        .select('business_id')
        .eq('id', branchId)
        .maybeSingle();
      businessId = branchData?.business_id || '';
    } catch {
      // ignore
    }

    const rawToken = 'WSN-QRS-' + crypto.randomBytes(24).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();

    const insertPayload = {
      business_id: businessId,
      branch_id: branchId,
      service_area_id: serviceAreaId || null,
      table_id: tableId || null,
      session_token_hash: tokenHash,
      created_at: new Date().toISOString(),
      expires_at: expiresAt,
      revoked_at: null,
      last_activity_at: new Date().toISOString(),
    };

    let sessionId = `qrs_${Date.now()}`;
    try {
      const { data, error } = await admin
        .from('qr_visit_sessions')
        .insert(insertPayload)
        .select('id')
        .single();

      if (data && !error) {
        sessionId = data.id;
      }
    } catch (err) {
      console.warn('[OrderSecurityService.createQrVisitSession] Insert warning:', err);
    }

    return {
      success: true,
      sessionId,
      sessionToken: rawToken,
      expiresAt,
    };
  }

  /**
   * Revokes an active QR visit session.
   */
  static async revokeQrVisitSession(identifier: string): Promise<boolean> {
    if (!identifier) return false;
    const admin = createAdminClient();
    try {
      const isRawToken = identifier.startsWith('WSN-QRS-') || identifier.length > 36;
      if (isRawToken) {
        const tokenHash = crypto.createHash('sha256').update(identifier.trim()).digest('hex');
        await admin
          .from('qr_visit_sessions')
          .update({ revoked_at: new Date().toISOString() })
          .eq('session_token_hash', tokenHash);
      } else {
        await admin
          .from('qr_visit_sessions')
          .update({ revoked_at: new Date().toISOString() })
          .eq('id', identifier);
      }
    } catch {
      // ignore
    }
    return true;
  }

  /**
   * Validates an opaque QR visit session token against DB.
   */
  static async validateQrVisitSession(sessionToken: string): Promise<{
    valid: boolean;
    session?: QrVisitSession;
    errorType?: 'EXPIRED' | 'REVOKED' | 'NOT_FOUND';
  }> {
    if (!sessionToken || sessionToken.trim().length === 0) {
      return { valid: false, errorType: 'NOT_FOUND' };
    }

    const tokenHash = crypto.createHash('sha256').update(sessionToken.trim()).digest('hex');
    const admin = createAdminClient();

    try {
      const { data: dbSession } = await admin
        .from('qr_visit_sessions')
        .select('*')
        .eq('session_token_hash', tokenHash)
        .maybeSingle();

      if (!dbSession) {
        return { valid: false, errorType: 'NOT_FOUND' };
      }

      const session = dbSession as QrVisitSession;
      if (session.revoked_at) {
        return { valid: false, session, errorType: 'REVOKED' };
      }

      if (new Date(session.expires_at).getTime() < Date.now()) {
        return { valid: false, session, errorType: 'EXPIRED' };
      }

      // Safely update last_activity_at asynchronously
      void admin
        .from('qr_visit_sessions')
        .update({ last_activity_at: new Date().toISOString() })
        .eq('session_token_hash', tokenHash);

      return { valid: true, session };
    } catch {
      return { valid: false, errorType: 'NOT_FOUND' };
    }
  }

  /**
   * Binds a verified dining table (and its service area) to an active QR visit session.
   */
  static async bindTableToQrVisitSession(
    sessionToken: string,
    tableId: string
  ): Promise<{ success: boolean; serviceAreaId?: string }> {
    if (!sessionToken || !tableId) return { success: false };
    const tokenHash = crypto.createHash('sha256').update(sessionToken.trim()).digest('hex');
    const admin = createAdminClient();

    try {
      const { data: tData } = await admin
        .from('dining_tables')
        .select('service_area_id')
        .eq('id', tableId)
        .maybeSingle();

      const serviceAreaId = tData?.service_area_id || null;

      await admin
        .from('qr_visit_sessions')
        .update({
          table_id: tableId,
          service_area_id: serviceAreaId,
          last_activity_at: new Date().toISOString(),
        })
        .eq('session_token_hash', tokenHash);

      return { success: true, serviceAreaId: serviceAreaId || undefined };
    } catch {
      return { success: false };
    }
  }

  /**
   * Opens or retrieves an active dining table session in DB.
   */
  static async openTableSession(
    branchId: string,
    tableId: string,
    customServiceAreaId?: string | null
  ): Promise<TableSession> {
    const admin = createAdminClient();

    try {
      const { data: existing } = await admin
        .from('table_sessions')
        .select('*')
        .eq('table_id', tableId)
        .eq('status', 'active')
        .maybeSingle();

      if (existing) {
        return existing as TableSession;
      }
    } catch {
      // ignore
    }

    let businessId = '';
    let serviceAreaId: string | null = customServiceAreaId || null;

    try {
      const { data: tData } = await admin
        .from('dining_tables')
        .select('business_id, service_area_id')
        .eq('id', tableId)
        .single();
      businessId = tData?.business_id || '';
      if (!serviceAreaId) serviceAreaId = tData?.service_area_id || null;
    } catch {
      // ignore
    }

    const insertPayload = {
      business_id: businessId,
      branch_id: branchId,
      service_area_id: serviceAreaId,
      table_id: tableId,
      status: 'active',
      opened_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    try {
      const { data: created } = await admin
        .from('table_sessions')
        .insert(insertPayload)
        .select('*')
        .single();

      if (created) {
        return created as TableSession;
      }
    } catch (err) {
      console.warn('[OrderSecurityService.openTableSession] Insert warning:', err);
    }

    return {
      id: `ts_${tableId}`,
      ...insertPayload,
    } as TableSession;
  }

  /**
   * Closes an active table session.
   */
  static async closeTableSession(tableId: string): Promise<boolean> {
    const admin = createAdminClient();
    try {
      await admin
        .from('table_sessions')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
        })
        .eq('table_id', tableId)
        .eq('status', 'active');
    } catch {
      // ignore
    }

    return true;
  }

  /**
   * Calculates Haversine distance and checks location against branch coordinates.
   */
  static async verifyLocation(
    branchId: string,
    userLat: number,
    userLng: number
  ): Promise<{ verified: boolean; distanceMeters?: number; allowedRadiusMeters?: number; reason?: string; errorCode?: string }> {
    const admin = createAdminClient();

    const { data: branch } = await admin
      .from('branches')
      .select('latitude, longitude')
      .eq('id', branchId)
      .maybeSingle();

    if (!branch || branch.latitude == null || branch.longitude == null) {
      return {
        verified: false,
        reason: 'This venue has not completed its location setup. Please ask a staff member for assistance.',
        errorCode: 'VENUE_LOCATION_NOT_CONFIGURED',
      };
    }

    const settings = await this.getBranchSecuritySettings(branchId);
    const radius = settings.location_radius_meters;

    const distance = calculateHaversineDistanceMeters(
      Number(branch.latitude),
      Number(branch.longitude),
      userLat,
      userLng
    );

    const verified = distance <= radius;

    return {
      verified,
      distanceMeters: Math.round(distance),
      allowedRadiusMeters: radius,
      reason: verified ? 'Within allowed radius' : `Device is ${Math.round(distance)}m away (max allowed ${radius}m)`,
      errorCode: verified ? undefined : 'LOCATION_OUTSIDE_RADIUS',
    };
  }

  /**
   * Single Authoritative Server Gate for QR Order Checkouts.
   */
  static async authorizeQrCheckout(
    input: SecurityEvaluationInput
  ): Promise<SecurityEvaluationResult> {
    return this.evaluateOrderSubmission(input);
  }

  /**
   * Authoritative server-side Order Security Evaluator.
   */
  static async evaluateOrderSubmission(
    input: SecurityEvaluationInput
  ): Promise<SecurityEvaluationResult> {
    const {
      branchId,
      tableId,
      qrSessionToken,
      customerId,
      userCoordinates,
      locationProof,
      isServerVerifiedOnlinePayment = false,
      orderSource = 'qr_customer',
    } = input;

    // Staff waiter & POS orders bypass guest security checks
    if (orderSource === 'waiter' || orderSource === 'pos_cashier') {
      return {
        allowed: true,
        requiresWaiterApproval: false,
        checks: {
          qrSession: 'not_applicable',
          customerAccount: 'not_applicable',
          location: 'not_applicable',
          tableSession: 'not_applicable',
          paymentBypass: 'not_applicable',
        },
      };
    }

    // Always fetch LATEST settings from DB at submission time
    const settings = await this.getBranchSecuritySettings(branchId);

    // Verified online payment bypass logic
    if (settings.allow_verified_online_payment_bypass && isServerVerifiedOnlinePayment) {
      return {
        allowed: true,
        requiresWaiterApproval: false,
        checks: {
          qrSession: 'not_applicable',
          customerAccount: 'not_applicable',
          location: 'not_applicable',
          tableSession: 'not_applicable',
          paymentBypass: 'applied',
        },
      };
    }

    // 1. Check Active QR Visit Session Requirement
    let qrSessionObj: QrVisitSession | null = null;
    if (settings.require_active_qr_session || (qrSessionToken && qrSessionToken.trim().length > 0)) {
      if (!qrSessionToken && settings.require_active_qr_session) {
        return {
          allowed: false,
          requiresWaiterApproval: false,
          checks: {
            qrSession: 'failed',
            customerAccount: 'not_applicable',
            location: 'not_applicable',
            tableSession: 'not_applicable',
            paymentBypass: 'not_applicable',
          },
          failureReason: 'Active QR session is required. Please scan the venue QR code again.',
          failureCode: 'QR_SESSION_REQUIRED',
        };
      }

      const qrVal = await this.validateQrVisitSession(qrSessionToken || '');
      if (!qrVal.valid || !qrVal.session) {
        return {
          allowed: false,
          requiresWaiterApproval: false,
          checks: {
            qrSession: 'failed',
            customerAccount: 'not_applicable',
            location: 'not_applicable',
            tableSession: 'not_applicable',
            paymentBypass: 'not_applicable',
          },
          failureReason:
            qrVal.errorType === 'EXPIRED'
              ? 'This table session has expired. Please scan the WSNexa QR code again.'
              : 'Invalid or revoked QR session. Please scan the WSNexa QR code again.',
          failureCode: qrVal.errorType === 'EXPIRED' ? 'QR_SESSION_EXPIRED' : 'QR_SESSION_REVOKED',
        };
      }

      qrSessionObj = qrVal.session;

      // Verify QR session branch matches order branch
      if (qrSessionObj.branch_id !== branchId) {
        return {
          allowed: false,
          requiresWaiterApproval: false,
          checks: {
            qrSession: 'failed',
            customerAccount: 'not_applicable',
            location: 'not_applicable',
            tableSession: 'not_applicable',
            paymentBypass: 'not_applicable',
          },
          failureReason: 'QR session belongs to a different branch location.',
          failureCode: 'BRANCH_MISMATCH',
        };
      }

      // Verify QR session service area matches table service area if bound
      if (qrSessionObj.service_area_id && tableId) {
        const admin = createAdminClient();
        const { data: tData } = await admin
          .from('dining_tables')
          .select('service_area_id')
          .eq('id', tableId)
          .maybeSingle();

        if (tData && tData.service_area_id && tData.service_area_id !== qrSessionObj.service_area_id) {
          return {
            allowed: false,
            requiresWaiterApproval: false,
            checks: {
              qrSession: 'failed',
              customerAccount: 'not_applicable',
              location: 'not_applicable',
              tableSession: 'not_applicable',
              paymentBypass: 'not_applicable',
            },
            failureReason: 'QR session is restricted to a different service area.',
            failureCode: 'AREA_MISMATCH',
          };
        }
      }

      // Verify QR session table matches order table if bound
      if (qrSessionObj.table_id && tableId && qrSessionObj.table_id !== tableId) {
        return {
          allowed: false,
          requiresWaiterApproval: false,
          checks: {
            qrSession: 'failed',
            customerAccount: 'not_applicable',
            location: 'not_applicable',
            tableSession: 'not_applicable',
            paymentBypass: 'not_applicable',
          },
          failureReason: 'QR session is bound to a different dining table.',
          failureCode: 'TABLE_MISMATCH',
        };
      }
    }

    // 2. Check Table Session Requirement
    let tableSessionObj: TableSession | null = null;
    if (tableId && settings.require_table_session) {
      const admin = createAdminClient();
      const { data: tSession } = await admin
        .from('table_sessions')
        .select('*')
        .eq('table_id', tableId)
        .eq('status', 'active')
        .maybeSingle();

      if (tSession && tSession.status === 'active') {
        tableSessionObj = tSession as TableSession;
      } else {
        tableSessionObj = await this.openTableSession(branchId, tableId);
      }
    }

    // 3. Check Customer Account Requirement
    if (settings.require_customer_account) {
      if (!customerId || customerId.trim().length === 0) {
        return {
          allowed: false,
          requiresWaiterApproval: false,
          checks: {
            qrSession: settings.require_active_qr_session ? 'passed' : 'not_applicable',
            customerAccount: 'failed',
            location: 'not_applicable',
            tableSession: tableSessionObj ? 'passed' : 'not_applicable',
            paymentBypass: 'not_applicable',
          },
          failureReason: 'Sign in to place your order at this venue.',
          failureCode: 'ACCOUNT_REQUIRED',
        };
      }
    }

    // 4. Check Location Verification Requirement
    if (settings.require_location_verification) {
      if (locationProof) {
        const pCheck = this.verifyLocationProof(locationProof, branchId);
        if (!pCheck.valid) {
          return {
            allowed: false,
            requiresWaiterApproval: false,
            checks: {
              qrSession: settings.require_active_qr_session ? 'passed' : 'not_applicable',
              customerAccount: settings.require_customer_account ? 'passed' : 'not_applicable',
              location: 'failed',
              tableSession: tableSessionObj ? 'passed' : 'not_applicable',
              paymentBypass: 'not_applicable',
            },
            failureReason: pCheck.reason || 'Invalid location proof.',
            failureCode: 'LOCATION_REQUIRED',
          };
        }
      } else if (userCoordinates && typeof userCoordinates.latitude === 'number' && typeof userCoordinates.longitude === 'number') {
        if (userCoordinates.accuracy && userCoordinates.accuracy > 500) {
          return {
            allowed: false,
            requiresWaiterApproval: false,
            checks: {
              qrSession: settings.require_active_qr_session ? 'passed' : 'not_applicable',
              customerAccount: settings.require_customer_account ? 'passed' : 'not_applicable',
              location: 'failed',
              tableSession: tableSessionObj ? 'passed' : 'not_applicable',
              paymentBypass: 'not_applicable',
            },
            failureReason: 'Your location is not accurate enough. Move closer to an open area and try again.',
            failureCode: 'LOCATION_INACCURATE',
          };
        }

        const locCheck = await this.verifyLocation(branchId, userCoordinates.latitude, userCoordinates.longitude);
        if (!locCheck.verified) {
          return {
            allowed: false,
            requiresWaiterApproval: false,
            checks: {
              qrSession: settings.require_active_qr_session ? 'passed' : 'not_applicable',
              customerAccount: settings.require_customer_account ? 'passed' : 'not_applicable',
              location: 'failed',
              tableSession: tableSessionObj ? 'passed' : 'not_applicable',
              paymentBypass: 'not_applicable',
            },
            failureReason: locCheck.reason || 'Device location is outside the venue ordering radius.',
            failureCode: locCheck.errorCode || 'LOCATION_OUTSIDE_RADIUS',
          };
        }
      } else {
        return {
          allowed: false,
          requiresWaiterApproval: false,
          checks: {
            qrSession: settings.require_active_qr_session ? 'passed' : 'not_applicable',
            customerAccount: settings.require_customer_account ? 'passed' : 'not_applicable',
            location: 'failed',
            tableSession: tableSessionObj ? 'passed' : 'not_applicable',
            paymentBypass: 'not_applicable',
          },
          failureReason: 'Location access is required by this venue before placing an order.',
          failureCode: 'LOCATION_REQUIRED',
        };
      }
    }

    return {
      allowed: true,
      requiresWaiterApproval: settings.require_waiter_approval,
      checks: {
        qrSession: settings.require_active_qr_session ? 'passed' : 'not_applicable',
        customerAccount: settings.require_customer_account ? 'passed' : 'not_applicable',
        location: settings.require_location_verification ? 'passed' : 'not_applicable',
        tableSession: tableSessionObj ? 'passed' : 'not_applicable',
        paymentBypass: 'not_applicable',
      },
      qrVisitSessionId: qrSessionObj?.id || null,
      tableSessionId: tableSessionObj?.id || null,
    };
  }

  /**
   * Logs a security audit event in order_security_audit_logs.
   */
  static async logSecurityEvent(input: {
    businessId: string;
    branchId: string;
    orderId?: string | null;
    actorUserId?: string | null;
    eventType:
      | 'QR_SESSION_CREATED'
      | 'QR_SESSION_EXPIRED'
      | 'LOCATION_VERIFIED'
      | 'LOCATION_REJECTED'
      | 'ORDER_SECURITY_REJECTED'
      | 'WAITER_APPROVED_ORDER'
      | 'WAITER_REJECTED_ORDER'
      | 'PAYMENT_VERIFIED'
      | 'PAYMENT_METHOD_REJECTED';
    safeMetadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      const admin = createAdminClient();
      await admin.from('order_security_audit_logs').insert({
        business_id: input.businessId,
        branch_id: input.branchId,
        order_id: input.orderId || null,
        actor_user_id: input.actorUserId || null,
        event_type: input.eventType,
        safe_metadata: input.safeMetadata || {},
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[OrderSecurityService.logSecurityEvent] Audit log write warning:', err);
    }
  }
}
