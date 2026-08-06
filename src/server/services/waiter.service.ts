import { createClient } from '@/lib/supabase/server';
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
  static async getBranchWaiterRequests(): Promise<WaiterRequestRecord[]> {
    const tenantContext = await resolveActiveBusinessContext();
    if (!tenantContext || !tenantContext.activeBranch) return [];

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('waiter_requests')
      .select(`
        *,
        table:dining_tables(id, name, code, table_number)
      `)
      .eq('business_id', tenantContext.business.id)
      .eq('branch_id', tenantContext.activeBranch.id)
      .in('status', ['pending', 'accepted'])
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data as unknown as WaiterRequestRecord[];
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
