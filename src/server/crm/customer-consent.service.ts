import { createAdminClient } from '@/lib/supabase/server';
import { AuthorizationContext } from '@/types/authorization.types';
import { can } from '@/server/auth/policy-engine';
import { ConsentChannel, ConsentStatus, CustomerConsentDTO } from '@/lib/crm/crm-types';

export class CustomerConsentService {
  /**
   * Retrieves all consent records for a customer.
   */
  static async getConsentRecords(
    customerId: string,
    businessId: string,
    authContext: AuthorizationContext
  ): Promise<CustomerConsentDTO[]> {
    if (!(await can({ context: authContext, permission: 'customers.view' }))) {
      return [];
    }

    if (authContext.businessId !== businessId) {
      return [];
    }

    const admin = createAdminClient();
    const { data } = await admin
      .from('crm_consent_records')
      .select('channel, status, updated_at')
      .eq('business_id', businessId)
      .eq('crm_customer_id', customerId);

    if (!data) return [];

    return data.map((d) => ({
      channel: d.channel as ConsentChannel,
      status: d.status as ConsentStatus,
      updatedAt: d.updated_at,
    }));
  }

  /**
   * Internal helper to fetch consent summary for service-role evaluation.
   */
  static async getCustomerConsentSummary(
    businessId: string,
    customerId: string
  ): Promise<{ emailConsent: ConsentStatus; smsConsent: ConsentStatus }> {
    const admin = createAdminClient();
    const { data } = await admin
      .from('crm_consent_records')
      .select('channel, status')
      .eq('business_id', businessId)
      .eq('crm_customer_id', customerId);

    let emailConsent: ConsentStatus = 'UNKNOWN';
    let smsConsent: ConsentStatus = 'UNKNOWN';

    for (const row of data || []) {
      if (row.channel === 'MARKETING_EMAIL') emailConsent = row.status as ConsentStatus;
      if (row.channel === 'MARKETING_SMS' || row.channel === 'MARKETING_WHATSAPP') {
        if (row.status === 'DENIED' || row.status === 'OPTED_OUT') smsConsent = row.status as ConsentStatus;
        else if (row.status === 'GRANTED' && smsConsent !== 'DENIED') smsConsent = 'GRANTED';
      }
    }

    return { emailConsent, smsConsent };
  }

  /**
   * Records or updates a consent status with auditable event log.
   */
  static async updateConsentStatus(
    customerId: string,
    businessId: string,
    channel: ConsentChannel,
    status: ConsentStatus,
    source: string,
    authContext: AuthorizationContext,
    reason?: string
  ): Promise<boolean> {
    if (!(await can({ context: authContext, permission: 'customers.manage' }))) {
      return false;
    }

    if (authContext.businessId !== businessId) {
      return false;
    }

    const admin = createAdminClient();
    const now = new Date().toISOString();

    // 1. Upsert consent record
    const { error: recordErr } = await admin
      .from('crm_consent_records')
      .upsert(
        {
          business_id: businessId,
          crm_customer_id: customerId,
          channel,
          status,
          updated_at: now,
        },
        { onConflict: 'business_id,crm_customer_id,channel' }
      );

    if (recordErr) {
      console.error('Failed to update crm_consent_record:', recordErr);
      return false;
    }

    // 2. Insert auditable consent event
    const action = status === 'GRANTED' ? 'GRANT' : status === 'OPTED_OUT' ? 'OPT_OUT' : 'DENY';
    await admin.from('crm_consent_events').insert({
      business_id: businessId,
      crm_customer_id: customerId,
      channel,
      action,
      source,
      reason: reason || null,
      created_by: authContext.userId,
    });

    return true;
  }
}
