import { createAdminClient } from '@/lib/supabase/server';
import { normalizeEmail, normalizePhone, normalizeDisplayName } from '@/lib/crm/crm-normalization';
import { IdentityType } from '@/lib/crm/crm-types';

export interface ResolveCustomerInput {
  businessId: string;
  authUserId?: string | null;
  guestEmail?: string | null;
  guestPhone?: string | null;
  guestName?: string | null;
}

export interface CustomerIdentityRecord {
  id: string;
  businessId: string;
  authUserId: string | null;
  displayName: string;
  emailNormalized: string | null;
  phoneNormalized: string | null;
  identityType: IdentityType;
  firstSeenAt: string;
  lastSeenAt: string;
}

export class CustomerIdentityService {
  /**
   * Deterministically resolves or creates a business-scoped CRM customer entity.
   * Priority:
   * 1. exact auth_user_id match
   * 2. exact normalized_email match (excluding conflicting registered auth users)
   * 3. exact normalized_phone match (excluding conflicting registered auth users)
   * 4. new REGISTERED / KNOWN_GUEST customer entity
   * 5. fully ANONYMOUS orders return null (orders.crm_customer_id stays NULL)
   */
  static async resolveOrCreateCustomerIdentity(
    input: ResolveCustomerInput
  ): Promise<CustomerIdentityRecord | null> {
    const { businessId, authUserId, guestEmail, guestPhone, guestName } = input;
    if (!businessId) return null;

    const admin = createAdminClient();
    const emailNorm = normalizeEmail(guestEmail);
    const phoneNorm = normalizePhone(guestPhone);
    const displayNameNorm = normalizeDisplayName(guestName) || (authUserId ? 'Registered Guest' : 'Guest');

    // Task 6 Guard: Fully anonymous orders (no auth_user_id, no email, no phone) return null.
    // Preserves orders.crm_customer_id = NULL without generating persistent database bloat.
    if (!authUserId && !emailNorm && !phoneNorm) {
      return null;
    }

    // Try atomic PostgreSQL RPC execution first (Item 3)
    const { data: rpcRows, error: rpcError } = await admin.rpc('resolve_or_create_crm_customer_identity', {
      p_business_id: businessId,
      p_auth_user_id: authUserId || null,
      p_email_normalized: emailNorm || null,
      p_phone_normalized: phoneNorm || null,
      p_display_name: displayNameNorm,
    });

    if (!rpcError && rpcRows && rpcRows.length > 0) {
      const row = rpcRows[0];
      return {
        id: row.id,
        businessId: row.business_id,
        authUserId: row.auth_user_id,
        displayName: row.display_name || displayNameNorm,
        emailNormalized: row.email_normalized,
        phoneNormalized: row.phone_normalized,
        identityType: row.identity_type as IdentityType,
        firstSeenAt: row.first_seen_at,
        lastSeenAt: row.last_seen_at,
      };
    }

    const now = new Date().toISOString();

    // 1. Priority 1: Auth User ID Match (Highest authority)
    if (authUserId) {
      const { data: existingAuthCustomer } = await admin
        .from('crm_customers')
        .select('*')
        .eq('business_id', businessId)
        .eq('auth_user_id', authUserId)
        .maybeSingle();

      if (existingAuthCustomer) {
        await admin
          .from('crm_customers')
          .update({
            last_seen_at: now,
            email_normalized: emailNorm || existingAuthCustomer.email_normalized,
            phone_normalized: phoneNorm || existingAuthCustomer.phone_normalized,
          })
          .eq('id', existingAuthCustomer.id);

        return {
          id: existingAuthCustomer.id,
          businessId: existingAuthCustomer.business_id,
          authUserId: existingAuthCustomer.auth_user_id,
          displayName: existingAuthCustomer.display_name || displayNameNorm,
          emailNormalized: emailNorm || existingAuthCustomer.email_normalized,
          phoneNormalized: phoneNorm || existingAuthCustomer.phone_normalized,
          identityType: 'REGISTERED',
          firstSeenAt: existingAuthCustomer.first_seen_at,
          lastSeenAt: now,
        };
      }
    }

    // 2. Priority 2: Exact Normalized Email Match
    if (emailNorm) {
      const { data: existingEmailCustomer } = await admin
        .from('crm_customers')
        .select('*')
        .eq('business_id', businessId)
        .eq('email_normalized', emailNorm)
        .maybeSingle();

      if (existingEmailCustomer) {
        // Task 2 Protection: Never auto-merge if existing customer is linked to a DIFFERENT auth_user_id!
        const isAuthConflict =
          authUserId &&
          existingEmailCustomer.auth_user_id &&
          existingEmailCustomer.auth_user_id !== authUserId;

        if (!isAuthConflict) {
          const updatedAuthUserId = authUserId || existingEmailCustomer.auth_user_id;
          const identityType: IdentityType = updatedAuthUserId ? 'REGISTERED' : 'KNOWN_GUEST';

          await admin
            .from('crm_customers')
            .update({
              last_seen_at: now,
              auth_user_id: updatedAuthUserId,
              identity_type: identityType,
              phone_normalized: phoneNorm || existingEmailCustomer.phone_normalized,
            })
            .eq('id', existingEmailCustomer.id);

          return {
            id: existingEmailCustomer.id,
            businessId: existingEmailCustomer.business_id,
            authUserId: updatedAuthUserId,
            displayName: existingEmailCustomer.display_name || displayNameNorm,
            emailNormalized: emailNorm,
            phoneNormalized: phoneNorm || existingEmailCustomer.phone_normalized,
            identityType,
            firstSeenAt: existingEmailCustomer.first_seen_at,
            lastSeenAt: now,
          };
        }
      }
    }

    // 3. Priority 3: Exact Normalized Phone Match
    if (phoneNorm) {
      const { data: existingPhoneCustomer } = await admin
        .from('crm_customers')
        .select('*')
        .eq('business_id', businessId)
        .eq('phone_normalized', phoneNorm)
        .maybeSingle();

      if (existingPhoneCustomer) {
        // Task 2 Protection: Never auto-merge if existing customer is linked to a DIFFERENT auth_user_id!
        const isAuthConflict =
          authUserId &&
          existingPhoneCustomer.auth_user_id &&
          existingPhoneCustomer.auth_user_id !== authUserId;

        if (!isAuthConflict) {
          const updatedAuthUserId = authUserId || existingPhoneCustomer.auth_user_id;
          const identityType: IdentityType = updatedAuthUserId ? 'REGISTERED' : 'KNOWN_GUEST';

          await admin
            .from('crm_customers')
            .update({
              last_seen_at: now,
              auth_user_id: updatedAuthUserId,
              identity_type: identityType,
              email_normalized: emailNorm || existingPhoneCustomer.email_normalized,
            })
            .eq('id', existingPhoneCustomer.id);

          return {
            id: existingPhoneCustomer.id,
            businessId: existingPhoneCustomer.business_id,
            authUserId: updatedAuthUserId,
            displayName: existingPhoneCustomer.display_name || displayNameNorm,
            emailNormalized: emailNorm || existingPhoneCustomer.email_normalized,
            phoneNormalized: phoneNorm,
            identityType,
            firstSeenAt: existingPhoneCustomer.first_seen_at,
            lastSeenAt: now,
          };
        }
      }
    }

    // 4. Priority 4: Create new CRM customer record
    const identityType: IdentityType = authUserId ? 'REGISTERED' : 'KNOWN_GUEST';

    // Attempt initial insertion with normalized contact info
    let { data: newCustomer, error } = await admin
      .from('crm_customers')
      .insert({
        business_id: businessId,
        auth_user_id: authUserId || null,
        display_name: displayNameNorm,
        email_normalized: emailNorm,
        phone_normalized: phoneNorm,
        identity_type: identityType,
        first_seen_at: now,
        last_seen_at: now,
      })
      .select()
      .maybeSingle();

    // Fallback insertion for shared contact collision (prevents unique index failure when another registered user owns the contact)
    if (error && authUserId) {
      const fallbackInsert = await admin
        .from('crm_customers')
        .insert({
          business_id: businessId,
          auth_user_id: authUserId,
          display_name: displayNameNorm,
          email_normalized: null,
          phone_normalized: null,
          identity_type: identityType,
          first_seen_at: now,
          last_seen_at: now,
        })
        .select()
        .maybeSingle();

      newCustomer = fallbackInsert.data;
      error = fallbackInsert.error;
    }

    if (error || !newCustomer) {
      console.error('[CustomerIdentityService] Creation failed safely:', error?.message);
      return null;
    }

    // Insert CRM customer identity records for auditability (Task 3)
    if (authUserId) {
      await admin.from('crm_customer_identities').insert({
        business_id: businessId,
        crm_customer_id: newCustomer.id,
        type: 'AUTH_USER',
        normalized_value: authUserId,
        source: 'AUTH',
      });
    }

    if (emailNorm) {
      await admin.from('crm_customer_identities').insert({
        business_id: businessId,
        crm_customer_id: newCustomer.id,
        type: 'EMAIL',
        normalized_value: emailNorm,
        source: 'ORDER',
      }).select().then(undefined, () => null);
    }

    if (phoneNorm) {
      await admin.from('crm_customer_identities').insert({
        business_id: businessId,
        crm_customer_id: newCustomer.id,
        type: 'PHONE',
        normalized_value: phoneNorm,
        source: 'ORDER',
      }).select().then(undefined, () => null);
    }

    return {
      id: newCustomer.id,
      businessId: newCustomer.business_id,
      authUserId: newCustomer.auth_user_id,
      displayName: newCustomer.display_name || displayNameNorm,
      emailNormalized: newCustomer.email_normalized,
      phoneNormalized: newCustomer.phone_normalized,
      identityType,
      firstSeenAt: newCustomer.first_seen_at,
      lastSeenAt: newCustomer.last_seen_at,
    };
  }
}
