import { createAdminClient } from '@/lib/supabase/server';
import type { CustomerNoteDTO } from '@/lib/crm/crm-action.types';

export class CustomerNotesService {
  /**
   * Sanitizes note text to enforce plain text and remove unsafe markup.
   */
  public static sanitizeNoteText(text: string): string {
    const trimmed = text.trim();
    if (!trimmed) throw new Error('Note text cannot be empty.');
    if (trimmed.length > 2000) throw new Error('Note text exceeds maximum length of 2000 characters.');
    // Strip HTML tags for safe rendering
    return trimmed.replace(/<[^>]*>?/gm, '');
  }

  /**
   * Lists internal notes for a customer.
   */
  public static async listNotes(input: {
    businessId: string;
    crmCustomerId: string;
    branchIds?: string[] | null;
    limit?: number;
    offset?: number;
  }): Promise<{ notes: CustomerNoteDTO[]; total: number }> {
    const { businessId, crmCustomerId, branchIds, limit = 50, offset = 0 } = input;
    const admin = createAdminClient();

    let query = admin
      .from('crm_customer_notes')
      .select('id, business_id, crm_customer_id, branch_id, note_text, created_by, created_at, updated_at', { count: 'exact' })
      .eq('business_id', businessId)
      .eq('crm_customer_id', crmCustomerId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (branchIds && branchIds.length > 0) {
      query = query.or(`branch_id.is.null,branch_id.in.(${branchIds.join(',')})`);
    }

    const { data, count, error } = await query;
    if (error) throw new Error(`Failed to list customer notes: ${error.message}`);

    const notes: CustomerNoteDTO[] = (data || []).map((row) => ({
      id: row.id,
      businessId: row.business_id,
      crmCustomerId: row.crm_customer_id,
      branchId: row.branch_id,
      noteText: row.note_text,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return { notes, total: count || 0 };
  }

  /**
   * Adds an internal staff note for a customer.
   */
  public static async addNote(input: {
    businessId: string;
    crmCustomerId: string;
    branchId?: string | null;
    noteText: string;
    actorUserId: string;
  }): Promise<CustomerNoteDTO> {
    const { businessId, crmCustomerId, branchId, noteText, actorUserId } = input;
    const cleanText = this.sanitizeNoteText(noteText);
    const admin = createAdminClient();

    const { data, error } = await admin
      .from('crm_customer_notes')
      .insert({
        business_id: businessId,
        crm_customer_id: crmCustomerId,
        branch_id: branchId || null,
        note_text: cleanText,
        created_by: actorUserId,
      })
      .select('id, business_id, crm_customer_id, branch_id, note_text, created_by, created_at, updated_at')
      .single();

    if (error || !data) throw new Error(`Failed to add customer note: ${error?.message}`);

    return {
      id: data.id,
      businessId: data.business_id,
      crmCustomerId: data.crm_customer_id,
      branchId: data.branch_id,
      noteText: data.note_text,
      createdBy: data.created_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Soft-deletes a note.
   */
  public static async softDeleteNote(input: {
    businessId: string;
    noteId: string;
    actorUserId: string;
  }): Promise<boolean> {
    const { businessId, noteId } = input;
    const admin = createAdminClient();

    const { error } = await admin
      .from('crm_customer_notes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', noteId)
      .eq('business_id', businessId);

    if (error) throw new Error(`Failed to delete customer note: ${error.message}`);
    return true;
  }
}
