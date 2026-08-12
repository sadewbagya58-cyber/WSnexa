import { createClient } from '@/lib/supabase/server';
import { checkBranchQuota } from './branch-limit.service';
import { QrService } from './qr.service';

export interface CreateBranchInput {
  name: string;
  code: string;
  phone?: string;
  email?: string;
  address_line_1?: string;
  city?: string;
  timezone?: string;
  currency?: string;
  require_table_selection?: boolean;
  require_table_pin?: boolean;
  table_pin_length?: number;
  latitude?: number | null;
  longitude?: number | null;
}

export interface UpdateBranchInput extends Partial<CreateBranchInput> {
  status?: string;
}

export class BranchService {
  /**
   * Fetches all branches for a business.
   */
  static async getBusinessBranches(businessId: string, includeArchived = false) {
    const supabase = await createClient();
    let query = supabase
      .from('branches')
      .select('*')
      .eq('business_id', businessId)
      .order('is_default', { ascending: false });

    if (!includeArchived) {
      query = query.is('deleted_at', null);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch branches: ${error.message}`);
    return data;
  }

  /**
   * Creates a new branch with subscription quota validation, 7 operating hours, and Branch QR generation.
   */
  static async createBranch(businessId: string, userId: string, input: CreateBranchInput) {
    const quota = await checkBranchQuota(businessId);
    if (!quota.allowed) {
      throw new Error(`Branch limit reached. Your ${quota.subscriptionTier} plan allows up to ${quota.maxBranchLimit} branch(es).`);
    }

    const supabase = await createClient();

    // Check duplicate code within same business
    const { data: existingCode } = await supabase
      .from('branches')
      .select('id')
      .eq('business_id', businessId)
      .eq('code', input.code.toUpperCase().trim())
      .is('deleted_at', null)
      .maybeSingle();

    if (existingCode) {
      throw new Error(`Branch code "${input.code.toUpperCase()}" already exists in this business.`);
    }

    const branchCode = input.code.toUpperCase().trim();

    const { error: insertErr } = await supabase
      .from('branches')
      .insert({
        business_id: businessId,
        name: input.name.trim(),
        code: branchCode,
        phone: input.phone || null,
        email: input.email || null,
        address_line_1: input.address_line_1 || null,
        city: input.city || null,
        timezone: input.timezone || 'UTC',
        is_default: false,
        status: 'active',
        require_table_selection: input.require_table_selection ?? true,
        require_table_pin: input.require_table_pin ?? false,
        table_pin_length: input.table_pin_length ?? 4,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
      });

    if (insertErr) {
      throw new Error(`Failed to create branch: ${insertErr.message}`);
    }

    const { data: newBranch, error: fetchErr } = await supabase
      .from('branches')
      .select('*')
      .eq('business_id', businessId)
      .eq('code', branchCode)
      .single();

    if (fetchErr || !newBranch) {
      throw new Error(`Failed to retrieve created branch: ${fetchErr?.message}`);
    }

    // Initialize 7 default operating hours records (Monday-Sunday)
    const days = [1, 2, 3, 4, 5, 6, 0];
    const operatingHoursRows = days.map((day) => ({
      business_id: businessId,
      branch_id: newBranch.id,
      day_of_week: day,
      is_open: true,
      open_time: '09:00:00',
      close_time: '22:00:00',
    }));

    await supabase.from('branch_operating_hours').insert(operatingHoursRows);

    // Generate initial Branch QR code
    try {
      await QrService.generateBranchQr();
    } catch (err: unknown) {
      console.warn('Initial Branch QR generation warning:', (err as Error).message);
    }

    return newBranch;
  }

  /**
   * Updates an existing branch.
   */
  static async updateBranch(branchId: string, input: UpdateBranchInput) {
    const supabase = await createClient();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.name !== undefined) updateData.name = input.name.trim();
    if (input.code !== undefined) updateData.code = input.code.toUpperCase().trim();
    if (input.phone !== undefined) updateData.phone = input.phone || null;
    if (input.email !== undefined) updateData.email = input.email || null;
    if (input.address_line_1 !== undefined) updateData.address_line_1 = input.address_line_1 || null;
    if (input.city !== undefined) updateData.city = input.city || null;
    if (input.timezone !== undefined) updateData.timezone = input.timezone;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.require_table_selection !== undefined) updateData.require_table_selection = input.require_table_selection;
    if (input.require_table_pin !== undefined) updateData.require_table_pin = input.require_table_pin;
    if (input.table_pin_length !== undefined) updateData.table_pin_length = input.table_pin_length;
    if (input.latitude !== undefined) updateData.latitude = input.latitude;
    if (input.longitude !== undefined) updateData.longitude = input.longitude;

    const { data, error } = await supabase
      .from('branches')
      .update(updateData)
      .eq('id', branchId)
      .select('*')
      .single();

    if (error) throw new Error(`Failed to update branch: ${error.message}`);
    return data;
  }

  /**
   * Archives a branch. Protects default branch.
   */
  static async archiveBranch(branchId: string) {
    const supabase = await createClient();

    const { data: branch } = await supabase
      .from('branches')
      .select('is_default, name')
      .eq('id', branchId)
      .single();

    if (!branch) throw new Error('Branch not found');
    if (branch.is_default) throw new Error('The default primary branch cannot be archived.');

    const { data, error } = await supabase
      .from('branches')
      .update({
        status: 'archived',
        deleted_at: new Date().toISOString(),
      })
      .eq('id', branchId)
      .select('*')
      .single();

    if (error) throw new Error(`Failed to archive branch: ${error.message}`);
    return data;
  }

  /**
   * Restores an archived branch.
   */
  static async restoreBranch(branchId: string) {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('branches')
      .update({
        status: 'active',
        deleted_at: null,
      })
      .eq('id', branchId)
      .select('*')
      .single();

    if (error) throw new Error(`Failed to restore branch: ${error.message}`);
    return data;
  }

  /**
   * Physical delete of empty archived branch ONLY.
   */
  static async deleteBranch(branchId: string) {
    const supabase = await createClient();

    const { data: branch } = await supabase
      .from('branches')
      .select('is_default, status, deleted_at')
      .eq('id', branchId)
      .single();

    if (!branch) throw new Error('Branch not found');
    if (branch.is_default) throw new Error('Default primary branch cannot be deleted.');

    // Check if branch owns any categories, items, tables, or service areas
    const [{ count: tablesCount }, { count: itemsCount }, { count: catCount }] = await Promise.all([
      supabase.from('dining_tables').select('id', { count: 'exact', head: true }).eq('branch_id', branchId).is('deleted_at', null),
      supabase.from('menu_items').select('id', { count: 'exact', head: true }).eq('branch_id', branchId).is('deleted_at', null),
      supabase.from('menu_categories').select('id', { count: 'exact', head: true }).eq('branch_id', branchId).is('deleted_at', null),
    ]);

    if ((tablesCount || 0) > 0 || (itemsCount || 0) > 0 || (catCount || 0) > 0) {
      throw new Error('Cannot delete non-empty branch. Archive the branch or delete its tables and menu items first.');
    }

    // Delete operating hours & branch QR
    await supabase.from('branch_operating_hours').delete().eq('branch_id', branchId);
    await supabase.from('branch_qr_codes').delete().eq('branch_id', branchId);

    const { error } = await supabase.from('branches').delete().eq('id', branchId);
    if (error) throw new Error(`Failed to delete branch: ${error.message}`);

    return { success: true };
  }
}
