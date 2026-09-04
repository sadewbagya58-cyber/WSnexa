import { createAdminClient } from '@/lib/supabase/server';

export interface LogAuditEventParams {
  businessId: string;
  branchId?: string | null;
  serviceAreaId?: string | null;
  actorUserId?: string | null;
  actorNameSnapshot?: string | null;
  actorRoleSnapshot?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
}

export type AuditLogEntry = AuditLogRecord;

export interface AuditLogRecord {
  id: string;
  business_id: string;
  branch_id: string | null;
  service_area_id: string | null;
  actor_id: string | null;
  actor_name_snapshot: string | null;
  actor_role_snapshot: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  payload: Record<string, unknown> | null;
  created_at: string;
  branch?: {
    id: string;
    name: string;
    code: string | null;
  } | null;
  service_area?: {
    id: string;
    name: string;
  } | null;
}

export interface GetAuditLogsParams {
  businessId: string;
  branchId?: string | null;
  branchIds?: string[] | null;
  serviceAreaId?: string | null;
  action?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  actorId?: string | null;
  searchQuery?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  limit?: number;
  offset?: number;
}

export class AuditService {
  /**
   * Records a structured permanent audit event.
   * Automatically captures actor identity snapshots and maintains backward compatibility.
   */
  static async logAuditEvent(params: LogAuditEventParams): Promise<{ success: boolean; auditId?: string }> {
    try {
      const admin = createAdminClient();

      let actorName = params.actorNameSnapshot || null;
      let actorRole = params.actorRoleSnapshot || null;

      // If actor snapshot details are not passed explicitly, attempt to resolve them from DB
      if (params.actorUserId && (!actorName || !actorRole)) {
        try {
          const [profRes, memRes] = await Promise.all([
            !actorName
              ? admin.from('user_profiles').select('first_name, last_name, email').eq('id', params.actorUserId).maybeSingle()
              : Promise.resolve({ data: null }),
            !actorRole
              ? admin
                  .from('business_memberships')
                  .select('role')
                  .eq('business_id', params.businessId)
                  .eq('user_id', params.actorUserId)
                  .maybeSingle()
              : Promise.resolve({ data: null }),
          ]);

          if (!actorName && profRes.data) {
            const p = profRes.data;
            const full = `${p.first_name || ''} ${p.last_name || ''}`.trim();
            actorName = full || p.email || 'Staff';
          }

          if (!actorRole && memRes.data) {
            actorRole = memRes.data.role || 'Staff';
          }
        } catch {
          // Non-blocking fallback
        }
      }

      if (!actorName && !params.actorUserId) {
        actorName = 'System / Guest';
        actorRole = 'System';
      }

      const payload = {
        oldValues: params.oldValues || null,
        newValues: params.newValues || null,
        reason: params.reason || null,
        metadata: params.metadata || null,
      };

      const { data, error } = await admin
        .from('audit_logs')
        .insert({
          business_id: params.businessId,
          branch_id: params.branchId || null,
          service_area_id: params.serviceAreaId || null,
          actor_id: params.actorUserId || null,
          actor_name_snapshot: actorName,
          actor_role_snapshot: actorRole,
          action: params.action,
          target_type: params.entityType,
          target_id: String(params.entityId),
          entity_type: params.entityType,
          entity_id: String(params.entityId),
          old_values: params.oldValues || null,
          new_values: params.newValues || null,
          reason: params.reason || null,
          metadata: params.metadata || null,
          payload,
        })
        .select('id')
        .single();

      if (error) {
        console.warn('[AuditService.logAuditEvent] Failed to insert audit log:', error.message);
        return { success: false };
      }

      return { success: true, auditId: data?.id };
    } catch (err) {
      console.warn('[AuditService.logAuditEvent] Unexpected error writing audit event:', err);
      return { success: false };
    }
  }

  /**
   * Retrieves paginated audit logs with multi-branch, entity, action, and date filtering.
   */
  static async getAuditLogs(params: GetAuditLogsParams): Promise<{
    logs: AuditLogRecord[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  }> {
    const admin = createAdminClient();
    const limit = Math.min(Math.max(params.limit || 25, 1), 100);
    const offset = Math.max(params.offset || 0, 0);

    let query = admin
      .from('audit_logs')
      .select(
        `
        id,
        business_id,
        branch_id,
        service_area_id,
        actor_id,
        actor_name_snapshot,
        actor_role_snapshot,
        action,
        entity_type,
        entity_id,
        target_type,
        target_id,
        old_values,
        new_values,
        reason,
        metadata,
        payload,
        created_at,
        branch:branches(id, name, code),
        service_area:service_areas(id, name)
      `,
        { count: 'exact' }
      )
      .eq('business_id', params.businessId);

    // Multi-branch scope filtering
    if (params.branchId) {
      query = query.eq('branch_id', params.branchId);
    } else if (params.branchIds && params.branchIds.length > 0) {
      // Allowed subset of branches
      query = query.in('branch_id', params.branchIds);
    }

    if (params.serviceAreaId) {
      query = query.eq('service_area_id', params.serviceAreaId);
    }

    if (params.action && params.action !== 'all') {
      query = query.ilike('action', `%${params.action}%`);
    }

    if (params.entityType && params.entityType !== 'all') {
      query = query.or(`entity_type.eq.${params.entityType},target_type.eq.${params.entityType}`);
    }

    if (params.entityId) {
      query = query.or(`entity_id.eq.${params.entityId},target_id.eq.${params.entityId}`);
    }

    if (params.actorId) {
      query = query.eq('actor_id', params.actorId);
    }

    if (params.startDate) {
      query = query.gte('created_at', params.startDate);
    }

    if (params.endDate) {
      query = query.lte('created_at', params.endDate);
    }

    if (params.searchQuery && params.searchQuery.trim()) {
      const q = params.searchQuery.trim();
      query = query.or(`action.ilike.%${q}%,actor_name_snapshot.ilike.%${q}%,reason.ilike.%${q}%,entity_id.ilike.%${q}%`);
    }

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      console.error('[AuditService.getAuditLogs] Query error:', error);
      return { logs: [], total: 0, limit, offset, hasMore: false };
    }

    const total = count || 0;
    const formattedLogs: AuditLogRecord[] = (data || []).map((row) => {
      const entityType = row.entity_type || row.target_type || 'unknown';
      const entityId = row.entity_id || row.target_id || '';
      const oldVals = row.old_values || (row.payload as Record<string, unknown> | null)?.oldValues || null;
      const newVals = row.new_values || (row.payload as Record<string, unknown> | null)?.newValues || null;
      const reasonVal = row.reason || (row.payload as Record<string, unknown> | null)?.reason || null;
      const metadataVal = row.metadata || (row.payload as Record<string, unknown> | null)?.metadata || null;

      return {
        id: row.id,
        business_id: row.business_id,
        branch_id: row.branch_id,
        service_area_id: row.service_area_id,
        actor_id: row.actor_id,
        actor_name_snapshot: row.actor_name_snapshot || 'Staff',
        actor_role_snapshot: row.actor_role_snapshot || 'Staff',
        action: row.action,
        entity_type: entityType,
        entity_id: entityId,
        old_values: oldVals as Record<string, unknown> | null,
        new_values: newVals as Record<string, unknown> | null,
        reason: reasonVal as string | null,
        metadata: metadataVal as Record<string, unknown> | null,
        payload: row.payload as Record<string, unknown> | null,
        created_at: row.created_at,
        branch: Array.isArray(row.branch) ? row.branch[0] : row.branch,
        service_area: Array.isArray(row.service_area) ? row.service_area[0] : row.service_area,
      };
    });

    return {
      logs: formattedLogs,
      total,
      limit,
      offset,
      hasMore: offset + formattedLogs.length < total,
    };
  }

  /**
   * Retrieves chronological audit history timeline for a specific business entity.
   */
  static async getEntityTimeline(
    businessId: string,
    entityType: string,
    entityId: string
  ): Promise<AuditLogRecord[]> {
    const admin = createAdminClient();

    const { data, error } = await admin
      .from('audit_logs')
      .select(
        `
        id,
        business_id,
        branch_id,
        service_area_id,
        actor_id,
        actor_name_snapshot,
        actor_role_snapshot,
        action,
        entity_type,
        entity_id,
        target_type,
        target_id,
        old_values,
        new_values,
        reason,
        metadata,
        payload,
        created_at,
        branch:branches(id, name, code),
        service_area:service_areas(id, name)
      `
      )
      .eq('business_id', businessId)
      .or(`and(entity_type.eq.${entityType},entity_id.eq.${entityId}),and(target_type.eq.${entityType},target_id.eq.${entityId})`)
      .order('created_at', { ascending: true });

    if (error || !data) {
      console.warn('[AuditService.getEntityTimeline] Query error:', error);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      business_id: row.business_id,
      branch_id: row.branch_id,
      service_area_id: row.service_area_id,
      actor_id: row.actor_id,
      actor_name_snapshot: row.actor_name_snapshot || 'Staff',
      actor_role_snapshot: row.actor_role_snapshot || 'Staff',
      action: row.action,
      entity_type: row.entity_type || row.target_type || entityType,
      entity_id: row.entity_id || row.target_id || entityId,
      old_values: (row.old_values || (row.payload as Record<string, unknown> | null)?.oldValues || null) as Record<string, unknown> | null,
      new_values: (row.new_values || (row.payload as Record<string, unknown> | null)?.newValues || null) as Record<string, unknown> | null,
      reason: (row.reason || (row.payload as Record<string, unknown> | null)?.reason || null) as string | null,
      metadata: (row.metadata || (row.payload as Record<string, unknown> | null)?.metadata || null) as Record<string, unknown> | null,
      payload: row.payload as Record<string, unknown> | null,
      created_at: row.created_at,
      branch: Array.isArray(row.branch) ? row.branch[0] : row.branch,
      service_area: Array.isArray(row.service_area) ? row.service_area[0] : row.service_area,
    }));
  }
}
