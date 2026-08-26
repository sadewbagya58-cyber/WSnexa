import { createAdminClient } from '@/lib/supabase/server';
import { SubscriptionPaymentStatus } from './subscription-pricing.service';
import { SubscriptionPaymentProviderCode, PaymentPurpose } from '../payments/subscriptions/subscription-payment-provider';

export interface OwnerPaymentFilterInput {
  businessId: string;
  page?: number;
  limit?: number;
}

export interface AdminPaymentFilterInput {
  page?: number;
  limit?: number;
  status?: string;
  provider?: string;
  purpose?: string;
  plan?: string;
  search?: string;
  businessId?: string;
}

export class SubscriptionPaymentQueryService {
  /**
   * List subscription payment records for a specific business owner (tenant isolated).
   */
  static async listOwnerSubscriptionPayments({
    businessId,
    page = 1,
    limit = 10,
  }: OwnerPaymentFilterInput) {
    const admin = createAdminClient();
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const offset = (safePage - 1) * safeLimit;

    const countQuery = admin
      .from('business_subscription_payments')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId);

    const { count, error: countError } = await countQuery;
    if (countError) {
      throw new Error(`Failed to count owner payment records: ${countError.message}`);
    }

    const { data, error } = await admin
      .from('business_subscription_payments')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .range(offset, offset + safeLimit - 1);

    if (error) {
      throw new Error(`Failed to list owner payment records: ${error.message}`);
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / safeLimit) || 1;

    return {
      data: data || [],
      total,
      page: safePage,
      limit: safeLimit,
      totalPages,
    };
  }

  /**
   * Get single subscription payment record for an owner (tenant isolated).
   */
  static async getOwnerSubscriptionPayment({
    businessId,
    paymentId,
  }: {
    businessId: string;
    paymentId: string;
  }) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('business_subscription_payments')
      .select('*')
      .eq('id', paymentId)
      .eq('business_id', businessId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch owner payment record: ${error.message}`);
    }

    return data;
  }

  /**
   * List subscription payment records platform-wide for Super Admin with search & filters.
   */
  static async listAdminSubscriptionPayments({
    page = 1,
    limit = 20,
    status,
    provider,
    purpose,
    plan,
    search,
    businessId,
  }: AdminPaymentFilterInput) {
    const admin = createAdminClient();
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const offset = (safePage - 1) * safeLimit;

    let baseQuery = admin
      .from('business_subscription_payments')
      .select(
        `
        *,
        business:businesses(id, name, slug, status)
      `,
        { count: 'exact' }
      );

    if (businessId) {
      baseQuery = baseQuery.eq('business_id', businessId);
    }

    if (status && status !== 'all') {
      baseQuery = baseQuery.eq('status', status as SubscriptionPaymentStatus);
    }

    if (provider && provider !== 'all') {
      if (provider === 'none') {
        baseQuery = baseQuery.is('provider', null);
      } else {
        baseQuery = baseQuery.eq('provider', provider as SubscriptionPaymentProviderCode);
      }
    }

    if (purpose && purpose !== 'all') {
      baseQuery = baseQuery.eq('payment_purpose', purpose as PaymentPurpose);
    }

    if (plan && plan !== 'all') {
      baseQuery = baseQuery.eq('plan_code', plan);
    }

    if (search && search.trim()) {
      const q = search.trim();
      baseQuery = baseQuery.or(
        `id.ilike.%${q}%,provider_transaction_id.ilike.%${q}%,provider_reference.ilike.%${q}%`
      );
    }

    baseQuery = baseQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + safeLimit - 1);

    const { data, count, error } = await baseQuery;

    if (error) {
      throw new Error(`Failed to list admin payment records: ${error.message}`);
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / safeLimit) || 1;

    return {
      data: data || [],
      total,
      page: safePage,
      limit: safeLimit,
      totalPages,
    };
  }

  /**
   * Get single subscription payment record detail for Super Admin.
   */
  static async getAdminSubscriptionPayment({ paymentId }: { paymentId: string }) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('business_subscription_payments')
      .select(
        `
        *,
        business:businesses(id, name, slug, status)
      `
      )
      .eq('id', paymentId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch admin payment detail: ${error.message}`);
    }

    return data;
  }
}
