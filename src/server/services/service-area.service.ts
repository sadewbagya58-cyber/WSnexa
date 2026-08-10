import { createClient } from '@/lib/supabase/server';
import { SupabaseClient } from '@supabase/supabase-js';

export interface FormattedServiceArea {
  id: string;
  businessId: string;
  branchId: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  tableCount: number;
  staffCount: number;
  activeOrderCount: number;
  createdAt: string;
}

export class ServiceAreaService {
  /**
   * Lists service areas for a given branch with table, staff, and active order counts.
   */
  static async listBranchAreas(
    businessId: string,
    branchId: string,
    client?: SupabaseClient
  ): Promise<FormattedServiceArea[]> {
    const supabase = client || (await createClient());

    const [areasRes, tablesRes, staffAssRes, ordersRes] = await Promise.all([
      supabase
        .from('service_areas')
        .select('*')
        .eq('business_id', businessId)
        .eq('branch_id', branchId)
        .is('deleted_at', null)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true }),

      supabase
        .from('dining_tables')
        .select('id, service_area_id')
        .eq('business_id', businessId)
        .eq('branch_id', branchId)
        .is('deleted_at', null),

      supabase
        .from('staff_area_assignments')
        .select('id, service_area_id')
        .eq('business_id', businessId)
        .eq('branch_id', branchId),

      supabase
        .from('orders')
        .select('id, service_area_id, status')
        .eq('business_id', businessId)
        .eq('branch_id', branchId)
        .in('status', ['pending', 'confirmed', 'preparing', 'ready']),
    ]);

    if (areasRes.error || !areasRes.data) {
      return [];
    }

    const tables = tablesRes.data || [];
    const staffAssignments = staffAssRes.data || [];
    const activeOrders = ordersRes.data || [];

    const tableCountMap = new Map<string, number>();
    for (const t of tables) {
      if (t.service_area_id) {
        tableCountMap.set(t.service_area_id, (tableCountMap.get(t.service_area_id) || 0) + 1);
      }
    }

    const staffCountMap = new Map<string, number>();
    for (const s of staffAssignments) {
      if (s.service_area_id) {
        staffCountMap.set(s.service_area_id, (staffCountMap.get(s.service_area_id) || 0) + 1);
      }
    }

    const activeOrderCountMap = new Map<string, number>();
    for (const o of activeOrders) {
      if (o.service_area_id) {
        activeOrderCountMap.set(o.service_area_id, (activeOrderCountMap.get(o.service_area_id) || 0) + 1);
      }
    }

    return areasRes.data.map((a: { id: string; business_id: string; branch_id: string; name: string; code: string; description: string | null; is_active: boolean; created_at: string }) => ({
      id: a.id,
      businessId: a.business_id,
      branchId: a.branch_id,
      name: a.name,
      code: a.code,
      description: a.description,
      isActive: a.is_active,
      tableCount: tableCountMap.get(a.id) || 0,
      staffCount: staffCountMap.get(a.id) || 0,
      activeOrderCount: activeOrderCountMap.get(a.id) || 0,
      createdAt: a.created_at,
    }));
  }

  /**
   * Creates a new service area for the branch.
   */
  static async createArea(
    businessId: string,
    branchId: string,
    name: string,
    description?: string | null,
    creatorUserId?: string | null,
    client?: SupabaseClient
  ) {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return { success: false, message: 'Area name is required.' };
    }

    const code = trimmedName
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .slice(0, 40);

    const supabase = client || (await createClient());

    const { data, error } = await supabase
      .from('service_areas')
      .insert({
        business_id: businessId,
        branch_id: branchId,
        name: trimmedName,
        code: `${code}_${Date.now().toString(36).slice(-4)}`,
        description: description?.trim() || null,
        created_by: creatorUserId || null,
        is_active: true,
      })
      .select('*')
      .single();

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, area: data };
  }

  /**
   * Updates an existing service area.
   */
  static async updateArea(
    areaId: string,
    businessId: string,
    branchId: string,
    name: string,
    description?: string | null,
    isActive?: boolean,
    client?: SupabaseClient
  ) {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return { success: false, message: 'Area name is required.' };
    }

    const supabase = client || (await createClient());

    const updatePayload: Record<string, unknown> = {
      name: trimmedName,
      description: description?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (typeof isActive === 'boolean') {
      updatePayload.is_active = isActive;
    }

    const { error } = await supabase
      .from('service_areas')
      .update(updatePayload)
      .eq('id', areaId)
      .eq('business_id', businessId)
      .eq('branch_id', branchId);

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, message: 'Area updated successfully.' };
  }

  /**
   * Soft deletes a service area.
   */
  static async deleteArea(areaId: string, businessId: string, branchId: string, client?: SupabaseClient) {
    const supabase = client || (await createClient());

    const { error } = await supabase
      .from('service_areas')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq('id', areaId)
      .eq('business_id', businessId)
      .eq('branch_id', branchId);

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, message: 'Area deleted successfully.' };
  }

  /**
   * Gets assigned area IDs for a staff membership.
   */
  static async getStaffAssignedAreaIds(businessMembershipId: string, client?: SupabaseClient): Promise<string[]> {
    const supabase = client || (await createClient());

    const { data, error } = await supabase
      .from('staff_area_assignments')
      .select('service_area_id')
      .eq('business_membership_id', businessMembershipId);

    if (error || !data) return [];
    return data.map((d: { service_area_id: string }) => d.service_area_id);
  }

  /**
   * Assigns staff member to selected service area IDs.
   */
  static async assignStaffToAreas(
    businessMembershipId: string,
    businessId: string,
    branchId: string,
    areaIds: string[],
    assignerUserId?: string | null,
    client?: SupabaseClient
  ) {
    const supabase = client || (await createClient());

    // 1. Delete existing assignments for membership
    await supabase
      .from('staff_area_assignments')
      .delete()
      .eq('business_membership_id', businessMembershipId);

    if (areaIds.length === 0) {
      return { success: true, message: 'All area assignments removed.' };
    }

    // 2. Insert new area assignments
    const rowsToInsert = areaIds.map((areaId) => ({
      business_id: businessId,
      branch_id: branchId,
      service_area_id: areaId,
      business_membership_id: businessMembershipId,
      assigned_by: assignerUserId || null,
    }));

    const { error } = await supabase.from('staff_area_assignments').insert(rowsToInsert);

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, message: 'Staff area assignments updated.' };
  }
}
