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
  userCoordinates?: { latitude: number; longitude: number } | null;
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

const memorySecuritySettings = new Map<string, BranchOrderSecuritySettings>();
const memoryQrSessions = new Map<string, QrVisitSession>();
const memoryTableSessions = new Map<string, TableSession>();

export class OrderSecurityService {
  /**
   * Retrieves branch security settings, auto-seeding defaults if not yet created.
   */
  static async getBranchSecuritySettings(branchId: string): Promise<BranchOrderSecuritySettings> {
    if (memorySecuritySettings.has(branchId)) {
      return memorySecuritySettings.get(branchId)!;
    }

    const admin = createAdminClient();

    try {
      const { data: existing } = await admin
        .from('branch_order_security_settings')
        .select('*')
        .eq('branch_id', branchId)
        .maybeSingle();

      if (existing) {
        memorySecuritySettings.set(branchId, existing as BranchOrderSecuritySettings);
        return existing as BranchOrderSecuritySettings;
      }
    } catch {
      // Table missing fallback
    }

    let businessId = '';
    try {
      const { data: branchData } = await admin
        .from('branches')
        .select('business_id')
        .eq('id', branchId)
        .single();
      businessId = branchData?.business_id || '';
    } catch {
      // ignore
    }

    const defaultSettings: BranchOrderSecuritySettings = {
      id: `sec_${branchId}`,
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
        .upsert(defaultSettings, { onConflict: 'branch_id' })
        .select('*')
        .single();

      if (seeded) {
        memorySecuritySettings.set(branchId, seeded as BranchOrderSecuritySettings);
        return seeded as BranchOrderSecuritySettings;
      }
    } catch {
      // ignore
    }

    memorySecuritySettings.set(branchId, defaultSettings);
    return defaultSettings;
  }

  /**
   * Updates branch order security settings.
   */
  static async updateBranchSecuritySettings(
    branchId: string,
    updates: Partial<BranchOrderSecuritySettings>
  ): Promise<{ success: boolean; message?: string }> {
    const existing = await this.getBranchSecuritySettings(branchId);

    const payload: BranchOrderSecuritySettings = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    memorySecuritySettings.set(branchId, payload);

    try {
      const admin = createAdminClient();
      await admin
        .from('branch_order_security_settings')
        .upsert(payload, { onConflict: 'branch_id' });
    } catch {
      // ignore
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
   * Creates or refreshes a temporary opaque QR visit session.
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
    let businessId = '';
    try {
      const admin = createAdminClient();
      const { data: branchData } = await admin
        .from('branches')
        .select('business_id')
        .eq('id', branchId)
        .single();
      businessId = branchData?.business_id || '';
    } catch {
      // ignore
    }

    const rawToken = 'WSN-QRS-' + crypto.randomBytes(24).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const sessionId = `qrs_${crypto.randomBytes(8).toString('hex')}`;
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();

    const sessionObj: QrVisitSession = {
      id: sessionId,
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

    memoryQrSessions.set(tokenHash, sessionObj);

    try {
      const admin = createAdminClient();
      await admin.from('qr_visit_sessions').insert(sessionObj);
    } catch {
      // ignore table missing
    }

    return {
      success: true,
      sessionId,
      sessionToken: rawToken,
      expiresAt,
    };
  }

  /**
   * Validates an opaque QR visit session token.
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

    let session: QrVisitSession | undefined = memoryQrSessions.get(tokenHash);

    if (!session) {
      try {
        const admin = createAdminClient();
        const { data: dbSession } = await admin
          .from('qr_visit_sessions')
          .select('*')
          .eq('session_token_hash', tokenHash)
          .maybeSingle();

        if (dbSession) {
          session = dbSession as QrVisitSession;
          memoryQrSessions.set(tokenHash, session);
        }
      } catch {
        // ignore
      }
    }

    if (!session) {
      return { valid: false, errorType: 'NOT_FOUND' };
    }

    if (session.revoked_at) {
      return { valid: false, session, errorType: 'REVOKED' };
    }

    if (new Date(session.expires_at).getTime() < Date.now()) {
      return { valid: false, session, errorType: 'EXPIRED' };
    }

    session.last_activity_at = new Date().toISOString();
    memoryQrSessions.set(tokenHash, session);

    return { valid: true, session };
  }

  /**
   * Revokes a QR visit session.
   */
  static async revokeQrVisitSession(sessionId: string): Promise<boolean> {
    for (const [hash, sess] of memoryQrSessions.entries()) {
      if (sess.id === sessionId) {
        sess.revoked_at = new Date().toISOString();
        memoryQrSessions.set(hash, sess);
      }
    }

    try {
      const admin = createAdminClient();
      await admin
        .from('qr_visit_sessions')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', sessionId);
    } catch {
      // ignore
    }

    return true;
  }

  /**
   * Opens or retrieves active table session.
   */
  static async openTableSession(
    branchId: string,
    tableId: string,
    serviceAreaId?: string | null
  ): Promise<TableSession | null> {
    if (memoryTableSessions.has(tableId)) {
      const existing = memoryTableSessions.get(tableId)!;
      if (existing.status === 'active') {
        return existing;
      }
    }

    let businessId = '';
    try {
      const admin = createAdminClient();
      const { data: branchData } = await admin
        .from('branches')
        .select('business_id')
        .eq('id', branchId)
        .single();
      businessId = branchData?.business_id || '';
    } catch {
      // ignore
    }

    const created: TableSession = {
      id: `ts_${crypto.randomBytes(8).toString('hex')}`,
      business_id: businessId,
      branch_id: branchId,
      service_area_id: serviceAreaId || null,
      table_id: tableId,
      status: 'active',
      opened_at: new Date().toISOString(),
      expires_at: null,
      closed_at: null,
      created_at: new Date().toISOString(),
    };

    memoryTableSessions.set(tableId, created);

    try {
      const admin = createAdminClient();
      await admin.from('table_sessions').insert(created);
    } catch {
      // ignore
    }

    return created;
  }

  /**
   * Closes active table session.
   */
  static async closeTableSession(tableId: string): Promise<boolean> {
    if (memoryTableSessions.has(tableId)) {
      const sess = memoryTableSessions.get(tableId)!;
      sess.status = 'closed';
      sess.closed_at = new Date().toISOString();
      memoryTableSessions.set(tableId, sess);
    }

    try {
      const admin = createAdminClient();
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
  ): Promise<{ verified: boolean; distanceMeters?: number; allowedRadiusMeters?: number; reason?: string }> {
    const admin = createAdminClient();

    const { data: branch } = await admin
      .from('branches')
      .select('latitude, longitude')
      .eq('id', branchId)
      .single();

    if (!branch || branch.latitude == null || branch.longitude == null) {
      // If branch coordinates not set, default to verified with warning
      return { verified: true, reason: 'Branch coordinates not configured' };
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
    };
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

    let qrSessionObj: QrVisitSession | undefined;

    // 1. Check Active QR Visit Session Requirement
    if (settings.require_active_qr_session) {
      if (!qrSessionToken) {
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

      const qrVal = await this.validateQrVisitSession(qrSessionToken);
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
          failureCode: 'QR_SESSION_EXPIRED',
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
        // Create table session if table is active
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
          failureReason: 'Account login is required by this venue before placing an order.',
          failureCode: 'ACCOUNT_REQUIRED',
        };
      }
    }

    // 4. Check Location Verification Requirement
    if (settings.require_location_verification) {
      if (!userCoordinates || typeof userCoordinates.latitude !== 'number' || typeof userCoordinates.longitude !== 'number') {
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
          failureCode: 'LOCATION_OUTSIDE_RADIUS',
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
    const admin = createAdminClient();
    try {
      await admin.from('order_security_audit_logs').insert({
        business_id: input.businessId,
        branch_id: input.branchId,
        order_id: input.orderId || null,
        actor_user_id: input.actorUserId || null,
        event_type: input.eventType,
        safe_metadata: input.safeMetadata || {},
      });
    } catch (err) {
      console.warn('Failed to log security audit event:', err);
    }
  }
}
