import { createAdminClient } from '@/lib/supabase/server';
import { BranchPaymentMethod, ConfiguredPaymentMethodType } from '@/types/database.types';

export const DEFAULT_PAYMENT_METHODS: Array<{
  method: ConfiguredPaymentMethodType;
  display_name: string;
  instructions: string;
  is_enabled: boolean;
  sort_order: number;
}> = [
  {
    method: 'pay_at_counter',
    display_name: 'Pay at Counter',
    instructions: 'Pay at the main cashier counter when your order is ready or after dining.',
    is_enabled: true,
    sort_order: 1,
  },
  {
    method: 'cash',
    display_name: 'Cash on Delivery / Table',
    instructions: 'Hand cash directly to your waiter or cashier upon order delivery.',
    is_enabled: true,
    sort_order: 2,
  },
  {
    method: 'card',
    display_name: 'Card at Venue / POS',
    instructions: 'Pay via credit or debit card using our mobile terminal at your table.',
    is_enabled: true,
    sort_order: 3,
  },
  {
    method: 'qr_payment',
    display_name: 'Venue QR Payment',
    instructions: 'Scan the venue payment QR code at your table to pay via mobile banking.',
    is_enabled: false,
    sort_order: 4,
  },
  {
    method: 'online_payment',
    display_name: 'Pay Online Now',
    instructions: 'Pay instantly and securely online using card or digital wallet.',
    is_enabled: false,
    sort_order: 5,
  },
];

export class BranchPaymentService {
  /**
   * Retrieves configured payment methods for a branch directly from DB.
   * Auto-seeds defaults if no payment methods have been configured yet for this branch.
   */
  static async getBranchPaymentMethods(branchId: string): Promise<BranchPaymentMethod[]> {
    const admin = createAdminClient();

    try {
      const { data: existing } = await admin
        .from('branch_payment_methods')
        .select('*')
        .eq('branch_id', branchId)
        .order('sort_order', { ascending: true });

      if (existing && existing.length > 0) {
        return existing as BranchPaymentMethod[];
      }
    } catch (err) {
      console.warn('[BranchPaymentService.getBranchPaymentMethods] DB fetch warning:', err);
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

    const seedRows = DEFAULT_PAYMENT_METHODS.map((m) => ({
      business_id: businessId,
      branch_id: branchId,
      method: m.method,
      display_name: m.display_name,
      instructions: m.instructions,
      is_enabled: m.is_enabled,
      sort_order: m.sort_order,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    try {
      const { data: seeded } = await admin
        .from('branch_payment_methods')
        .upsert(seedRows, { onConflict: 'branch_id,method' })
        .select('*')
        .order('sort_order', { ascending: true });

      if (seeded && seeded.length > 0) {
        return seeded as BranchPaymentMethod[];
      }
    } catch (err) {
      console.warn('[BranchPaymentService.getBranchPaymentMethods] DB seed warning:', err);
    }

    return DEFAULT_PAYMENT_METHODS.map((m) => ({
      id: `pm_${branchId}_${m.method}`,
      business_id: businessId,
      branch_id: branchId,
      method: m.method,
      display_name: m.display_name,
      instructions: m.instructions,
      is_enabled: m.is_enabled,
      sort_order: m.sort_order,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
  }

  /**
   * Updates or toggles a specific payment method for a branch in the database.
   */
  static async updateBranchPaymentMethod(
    branchId: string,
    method: ConfiguredPaymentMethodType,
    updates: {
      is_enabled?: boolean;
      display_name?: string;
      instructions?: string;
      sort_order?: number;
    }
  ): Promise<{ success: boolean; message?: string }> {
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

    // Get current method record or default
    const existingMethods = await this.getBranchPaymentMethods(branchId);
    const existing = existingMethods.find((m) => m.method === method);

    const payload = {
      business_id: businessId,
      branch_id: branchId,
      method,
      display_name: updates.display_name !== undefined ? updates.display_name : (existing?.display_name || method),
      instructions: updates.instructions !== undefined ? updates.instructions : (existing?.instructions || ''),
      is_enabled: updates.is_enabled !== undefined ? updates.is_enabled : (existing?.is_enabled ?? true),
      sort_order: updates.sort_order !== undefined ? updates.sort_order : (existing?.sort_order ?? 1),
      updated_at: new Date().toISOString(),
    };

    try {
      const { error } = await admin
        .from('branch_payment_methods')
        .upsert(payload, { onConflict: 'branch_id,method' });

      if (error) {
        console.error('[BranchPaymentService.updateBranchPaymentMethod] Error:', error.message);
        return { success: false, message: error.message };
      }
    } catch (err) {
      console.error('[BranchPaymentService.updateBranchPaymentMethod] Exception:', err);
      return { success: false, message: 'Failed to update payment method.' };
    }

    return { success: true };
  }

  /**
   * Server-side validation: verifies if a requested payment method is enabled for the branch.
   */
  static async isMethodEnabled(branchId: string, requestedMethod: string): Promise<boolean> {
    const methods = await this.getBranchPaymentMethods(branchId);
    const found = methods.find(
      (m) =>
        m.method === requestedMethod ||
        m.method.replace(/_/g, '') === requestedMethod.replace(/_/g, '')
    );
    return Boolean(found && found.is_enabled);
  }
}
