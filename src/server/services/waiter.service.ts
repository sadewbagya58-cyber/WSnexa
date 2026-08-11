import { createClient } from '@/lib/supabase/server';
import { SupabaseClient } from '@supabase/supabase-js';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { hashQrToken } from '@/lib/qr/security';
import {
  SubmitCustomerAssistanceInput,
  submitCustomerAssistanceSchema,
  WaiterRequestStatus,
} from '@/lib/validation/waiter';

export interface WaiterRequestRecord {
  id: string;
  business_id: string;
  branch_id: string;
  table_id: string;
  order_id: string | null;
  request_type: string;
  status: WaiterRequestStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  table?: {
    id: string;
    name: string;
    code: string;
    table_number: number | null;
  } | null;
}

export class WaiterService {
  /**
   * Submits a customer assistance request (Call Waiter, Need Water, Need Bill, Need Assistance).
   */
  static async submitCustomerAssistance(input: SubmitCustomerAssistanceInput) {
    const parsed = submitCustomerAssistanceSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        message: 'Invalid assistance request input.',
        errors: parsed.error.flatten().fieldErrors,
      };
    }

    const { rawQrToken, tableId, requestType, orderId, notes } = parsed.data;
    const tokenHash = hashQrToken(rawQrToken);

    const supabase = await createClient();

    const { data, error } = await supabase.rpc('submit_customer_assistance', {
      p_token_hash: tokenHash,
      p_table_id: tableId,
      p_request_type: requestType,
      p_order_id: orderId || null,
      p_notes: notes || null,
    });

    if (error || !data) {
      return {
        success: false,
        message: error?.message || 'Failed to submit assistance request.',
      };
    }

    const res = data as {
      success: boolean;
      error?: string;
      request_id?: string;
      table_name?: string;
      request_type?: string;
    };

    if (!res.success) {
      return {
        success: false,
        message: res.error || 'Failed to submit assistance request.',
      };
    }

    return {
      success: true,
      data: {
        requestId: res.request_id!,
        tableName: res.table_name!,
        requestType: res.request_type!,
      },
    };
  }

  /**
   * Fetches active waiter requests for active branch staff.
   */
  static async getBranchWaiterRequests(
    branchIdInput?: string,
    userIdInput?: string,
    client?: SupabaseClient
  ): Promise<WaiterRequestRecord[]> {
    const supabase = client || (await createClient());

    let businessId: string;
    let branchId: string;
    let memberRole: string | null = null;
    let membershipId: string | null = null;

    if (branchIdInput && client) {
      branchId = branchIdInput;
      // Resolve businessId from branch
      const { data: bRow } = await supabase
        .from('branches')
        .select('business_id')
        .eq('id', branchIdInput)
        .single();
      businessId = bRow?.business_id;

      if (userIdInput && businessId) {
        const { data: mem } = await supabase
          .from('business_memberships')
          .select('id, role')
          .eq('business_id', businessId)
          .eq('user_id', userIdInput)
          .single();
        if (mem) {
          membershipId = mem.id;
          memberRole = mem.role;
        }
      }
    } else {
      const tenantContext = await resolveActiveBusinessContext();
      if (!tenantContext || !tenantContext.activeBranch) return [];
      businessId = tenantContext.business.id;
      branchId = tenantContext.activeBranch.id;
      membershipId = tenantContext.membership.id;
      memberRole = tenantContext.membership.role;
    }

    // Check if user is waiter role and has explicit area assignments
    let allowedAreaIds: string[] | null = null;
    if (memberRole === 'waiter' && membershipId) {
      const { data: areaAssigns } = await supabase
        .from('staff_area_assignments')
        .select('service_area_id')
        .eq('business_membership_id', membershipId);

      if (areaAssigns && areaAssigns.length > 0) {
        allowedAreaIds = areaAssigns.map((a: { service_area_id: string }) => a.service_area_id);
      }
    }

    const { data, error } = await supabase
      .from('waiter_requests')
      .select(`
        *,
        table:dining_tables(id, name, code, table_number, service_area_id)
      `)
      .eq('business_id', businessId)
      .eq('branch_id', branchId)
      .in('status', ['pending', 'accepted'])
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    const records = data as unknown as Array<
      WaiterRequestRecord & { table?: { service_area_id?: string } | null }
    >;

    if (allowedAreaIds !== null) {
      return records.filter(
        (r) => r.table?.service_area_id && allowedAreaIds!.includes(r.table.service_area_id)
      );
    }

    return records;
  }

  /**
   * Updates status of a waiter request (Accepted / Completed / Dismissed).
   */
  static async updateWaiterRequestStatus(requestId: string, status: WaiterRequestStatus) {
    const tenantContext = await resolveActiveBusinessContext();
    if (!tenantContext || !tenantContext.activeBranch) {
      return { success: false, message: 'Unauthorized or active branch context not found.' };
    }

    const supabase = await createClient();

    const updatePayload: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'completed' || status === 'dismissed') {
      updatePayload.resolved_at = new Date().toISOString();
      updatePayload.resolved_by = tenantContext.user.id;
    }

    const { error } = await supabase
      .from('waiter_requests')
      .update(updatePayload)
      .eq('id', requestId)
      .eq('business_id', tenantContext.business.id)
      .eq('branch_id', tenantContext.activeBranch.id);

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, message: `Request marked as ${status}.` };
  }
}
