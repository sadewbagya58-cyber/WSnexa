import { createAdminClient } from '@/lib/supabase/server';
import type {
  EngagementChannel,
  EngagementEligibilityDTO,
  EngagementEligibilityReasonCode,
  EngagementPurpose,
} from '@/lib/crm/crm-action.types';
import { CustomerConsentService } from './customer-consent.service';

export class EngagementEligibilityService {
  /**
   * Evaluates consent-safe engagement eligibility for a customer and purpose.
   */
  public static async evaluateEligibility(input: {
    businessId: string;
    customerId: string;
    purpose: EngagementPurpose;
    hasContactViewPermission?: boolean;
  }): Promise<EngagementEligibilityDTO> {
    const { businessId, customerId, purpose, hasContactViewPermission = false } = input;
    const admin = createAdminClient();

    const { data: customer } = await admin
      .from('crm_customers')
      .select('id, email_normalized, phone_normalized')
      .eq('id', customerId)
      .eq('business_id', businessId)
      .maybeSingle();

    if (!customer) {
      return {
        eligible: false,
        purpose,
        reasonCode: 'NO_CONTACT_AVAILABLE',
        allowedChannels: [],
        message: 'Customer record not found.',
      };
    }

    const hasEmail = Boolean(customer.email_normalized);
    const hasPhone = Boolean(customer.phone_normalized);

    if (!hasEmail && !hasPhone) {
      return {
        eligible: false,
        purpose,
        reasonCode: 'NO_CONTACT_AVAILABLE',
        allowedChannels: [],
        message: 'No contact information (email or phone) is registered for this customer.',
      };
    }

    const availableChannels: EngagementChannel[] = [];
    if (hasEmail) availableChannels.push('EMAIL');
    if (hasPhone) availableChannels.push('SMS', 'PHONE', 'WHATSAPP');
    availableChannels.push('IN_APP');

    // Fetch customer consent records
    const consentSummary = await CustomerConsentService.getCustomerConsentSummary(businessId, customerId);

    // Purpose: MARKETING
    if (purpose === 'MARKETING') {
      const emailConsent = consentSummary.emailConsent;
      const smsConsent = consentSummary.smsConsent;

      if (emailConsent === 'DENIED' && smsConsent === 'DENIED') {
        return {
          eligible: false,
          purpose,
          reasonCode: 'CONSENT_DENIED',
          allowedChannels: [],
          message: 'Marketing consent has been explicitly DENIED by the customer.',
        };
      }

      if (emailConsent === 'UNKNOWN' && smsConsent === 'UNKNOWN') {
        return {
          eligible: false,
          purpose,
          reasonCode: 'CONSENT_UNKNOWN',
          allowedChannels: [],
          message: 'Marketing consent is UNKNOWN. Opt-in consent must be explicitly granted before marketing engagement.',
        };
      }

      const allowedChannels: EngagementChannel[] = [];
      if (hasEmail && emailConsent === 'GRANTED') allowedChannels.push('EMAIL');
      if (hasPhone && smsConsent === 'GRANTED') allowedChannels.push('SMS', 'WHATSAPP');
      allowedChannels.push('IN_APP');

      if (allowedChannels.length === 0) {
        return {
          eligible: false,
          purpose,
          reasonCode: 'CONSENT_DENIED',
          allowedChannels: [],
          message: 'No marketing channels have granted opt-in consent.',
        };
      }

      return {
        eligible: true,
        purpose,
        reasonCode: 'ELIGIBLE',
        allowedChannels,
        message: 'Customer has granted explicit marketing consent for authorized channels.',
      };
    }

    // Purpose: TRANSACTIONAL / SERVICE_RECOVERY / LOYALTY / MANUAL_GENERAL
    // Operational communication is permitted when contact is available unless opted out
    const allowedChannels: EngagementChannel[] = [];
    if (hasEmail && consentSummary.emailConsent !== 'DENIED') allowedChannels.push('EMAIL');
    if (hasPhone && consentSummary.smsConsent !== 'DENIED') allowedChannels.push('SMS', 'PHONE', 'WHATSAPP');
    allowedChannels.push('IN_APP');

    if (!hasContactViewPermission) {
      return {
        eligible: true,
        purpose,
        reasonCode: 'CONTACT_VIEW_REQUIRED',
        allowedChannels,
        message: 'Eligible for operational follow-up. Contact details remain masked until customers.contact_view permission is granted.',
      };
    }

    return {
      eligible: true,
      purpose,
      reasonCode: 'ELIGIBLE',
      allowedChannels,
      message: 'Eligible for operational guest follow-up.',
    };
  }
}
