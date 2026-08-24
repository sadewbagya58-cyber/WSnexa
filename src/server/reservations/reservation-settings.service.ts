import { createAdminClient } from '@/lib/supabase/server';
import { ReservationSettingsDTO } from '@/lib/reservations/reservation-types';

export class ReservationSettingsService {
  /**
   * Fetches reservation settings for a specific branch. Returns default settings if not configured.
   */
  static async getBranchSettings(businessId: string, branchId: string): Promise<ReservationSettingsDTO> {
    const admin = createAdminClient();
    const { data } = await admin
      .from('reservation_settings')
      .select('*')
      .eq('business_id', businessId)
      .eq('branch_id', branchId)
      .maybeSingle();

    if (data) {
      return {
        id: data.id,
        businessId: data.business_id,
        branchId: data.branch_id,
        reservationsEnabled: data.reservations_enabled,
        defaultDurationMinutes: data.default_duration_minutes,
        minimumPartySize: data.minimum_party_size,
        maximumPartySize: data.maximum_party_size,
        minimumAdvanceMinutes: data.minimum_advance_minutes,
        maximumAdvanceDays: data.maximum_advance_days,
        allowSameDay: data.allow_same_day,
        requireGuestPhone: data.require_guest_phone,
        requireGuestEmail: data.require_guest_email,
        autoConfirm: data.auto_confirm,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    }

    // Default fallback settings if branch record doesn't exist yet
    return {
      id: '',
      businessId,
      branchId,
      reservationsEnabled: true,
      defaultDurationMinutes: 90,
      minimumPartySize: 1,
      maximumPartySize: 20,
      minimumAdvanceMinutes: 30,
      maximumAdvanceDays: 90,
      allowSameDay: true,
      requireGuestPhone: false,
      requireGuestEmail: false,
      autoConfirm: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Upserts reservation settings for a specific branch.
   */
  static async upsertBranchSettings(
    businessId: string,
    branchId: string,
    input: Partial<Omit<ReservationSettingsDTO, 'id' | 'businessId' | 'branchId' | 'createdAt' | 'updatedAt'>>
  ): Promise<ReservationSettingsDTO> {
    const admin = createAdminClient();
    const current = await this.getBranchSettings(businessId, branchId);

    const payload = {
      business_id: businessId,
      branch_id: branchId,
      reservations_enabled: input.reservationsEnabled ?? current.reservationsEnabled,
      default_duration_minutes: input.defaultDurationMinutes ?? current.defaultDurationMinutes,
      minimum_party_size: input.minimumPartySize ?? current.minimumPartySize,
      maximum_party_size: input.maximumPartySize ?? current.maximumPartySize,
      minimum_advance_minutes: input.minimumAdvanceMinutes ?? current.minimumAdvanceMinutes,
      maximum_advance_days: input.maximumAdvanceDays ?? current.maximumAdvanceDays,
      allow_same_day: input.allowSameDay ?? current.allowSameDay,
      require_guest_phone: input.requireGuestPhone ?? current.requireGuestPhone,
      require_guest_email: input.requireGuestEmail ?? current.requireGuestEmail,
      auto_confirm: input.autoConfirm ?? current.autoConfirm,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await admin
      .from('reservation_settings')
      .upsert(payload, { onConflict: 'business_id,branch_id' })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to update reservation settings: ${error?.message}`);
    }

    return {
      id: data.id,
      businessId: data.business_id,
      branchId: data.branch_id,
      reservationsEnabled: data.reservations_enabled,
      defaultDurationMinutes: data.default_duration_minutes,
      minimumPartySize: data.minimum_party_size,
      maximumPartySize: data.maximum_party_size,
      minimumAdvanceMinutes: data.minimum_advance_minutes,
      maximumAdvanceDays: data.maximum_advance_days,
      allowSameDay: data.allow_same_day,
      requireGuestPhone: data.require_guest_phone,
      requireGuestEmail: data.require_guest_email,
      autoConfirm: data.auto_confirm,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}
