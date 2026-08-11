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

const memoryPaymentMethods = new Map<string, BranchPaymentMethod[]>();

export class BranchPaymentService {
  /**
   * Retrieves configured payment methods for a branch.
   * Auto-seeds defaults if no payment methods have been configured yet.
   */
  static async getBranchPaymentMethods(branchId: string): Promise<BranchPaymentMethod[]> {
    if (memoryPaymentMethods.has(branchId)) {
      return memoryPaymentMethods.get(branchId)!;
    }

    const admin = createAdminClient();

    try {
      const { data: existing } = await admin
        .from('branch_payment_methods')
        .select('*')
        .eq('branch_id', branchId)
        .order('sort_order', { ascending: true });

      if (existing && existing.length > 0) {
        memoryPaymentMethods.set(branchId, existing as BranchPaymentMethod[]);
        return existing as BranchPaymentMethod[];
      }
    } catch {
      // ignore table missing
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

    const seedRows: BranchPaymentMethod[] = DEFAULT_PAYMENT_METHODS.map((m) => ({
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

    try {
      const { data: seeded } = await admin
        .from('branch_payment_methods')
        .upsert(seedRows, { onConflict: 'branch_id,method' })
        .select('*')
        .order('sort_order', { ascending: true });

      if (seeded && seeded.length > 0) {
        memoryPaymentMethods.set(branchId, seeded as BranchPaymentMethod[]);
        return seeded as BranchPaymentMethod[];
      }
    } catch {
      // ignore
    }

    memoryPaymentMethods.set(branchId, seedRows);
    return seedRows;
  }

  /**
   * Updates or toggles a specific payment method for a branch.
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
    const existingMethods = await this.getBranchPaymentMethods(branchId);
    const updatedList = existingMethods.map((m) => {
      if (m.method === method) {
        return {
          ...m,
          ...updates,
          updated_at: new Date().toISOString(),
        };
      }
      return m;
    });

    memoryPaymentMethods.set(branchId, updatedList);

    try {
      const admin = createAdminClient();
      const target = updatedList.find((m) => m.method === method);
      if (target) {
        await admin.from('branch_payment_methods').upsert(target, { onConflict: 'branch_id,method' });
      }
    } catch {
      // ignore
    }

    return { success: true };
  }

  /**
   * Server-side validation: verifies if a requested payment method is enabled for the branch.
   */
  static async isMethodEnabled(branchId: string, requestedMethod: string): Promise<boolean> {
    const methods = await this.getBranchPaymentMethods(branchId);
    const found = methods.find((m) => m.method === requestedMethod || m.method.replace('_', '') === requestedMethod.replace('_', ''));
    return Boolean(found && found.is_enabled);
  }
}
