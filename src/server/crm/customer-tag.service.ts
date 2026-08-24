import { createAdminClient } from '@/lib/supabase/server';
import type { CustomerTagAssignmentDTO, CustomerTagDTO } from '@/lib/crm/crm-action.types';

const SENSITIVE_TAG_KEYWORDS = [
  'religion',
  'religious',
  'ethnicity',
  'race',
  'health',
  'medical',
  'political',
  'sexuality',
  'orientation',
  'disability',
];

export class CustomerTagService {
  /**
   * Validates that tag name does not contain sensitive protected attributes.
   */
  public static validateTagName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Tag name cannot be empty.');
    if (trimmed.length > 50) throw new Error('Tag name exceeds maximum length of 50 characters.');

    const lower = trimmed.toLowerCase();
    for (const keyword of SENSITIVE_TAG_KEYWORDS) {
      if (lower.includes(keyword)) {
        throw new Error(`Tag name contains restricted sensitive category keyword: "${keyword}". Operational CRM tags must not track protected sensitive attributes.`);
      }
    }

    return trimmed;
  }

  /**
   * Generates a clean URL/DB slug from a tag name.
   */
  public static generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  /**
   * Lists available operational CRM tags for a business.
   */
  public static async listTags(businessId: string): Promise<CustomerTagDTO[]> {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('crm_tags')
      .select('id, business_id, name, slug, description, color_hex, created_at')
      .eq('business_id', businessId)
      .order('name', { ascending: true });

    if (error) throw new Error(`Failed to list CRM tags: ${error.message}`);

    return (data || []).map((row) => ({
      id: row.id,
      businessId: row.business_id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      colorHex: row.color_hex,
      createdAt: row.created_at,
    }));
  }

  /**
   * Creates a new operational CRM tag.
   */
  public static async createTag(input: {
    businessId: string;
    name: string;
    description?: string | null;
    colorHex?: string | null;
  }): Promise<CustomerTagDTO> {
    const { businessId, name, description, colorHex } = input;
    const cleanName = this.validateTagName(name);
    const slug = this.generateSlug(cleanName);
    const admin = createAdminClient();

    const { data, error } = await admin
      .from('crm_tags')
      .insert({
        business_id: businessId,
        name: cleanName,
        slug,
        description: description || null,
        color_hex: colorHex || '#6B7280',
      })
      .select('id, business_id, name, slug, description, color_hex, created_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error(`Tag "${cleanName}" already exists for this business.`);
      }
      throw new Error(`Failed to create CRM tag: ${error.message}`);
    }

    return {
      id: data.id,
      businessId: data.business_id,
      name: data.name,
      slug: data.slug,
      description: data.description,
      colorHex: data.color_hex,
      createdAt: data.created_at,
    };
  }

  /**
   * Assigns an operational tag to a customer. Prevents duplicate assignments.
   */
  public static async assignTag(input: {
    businessId: string;
    crmCustomerId: string;
    tagId: string;
    actorUserId: string;
  }): Promise<boolean> {
    const { businessId, crmCustomerId, tagId, actorUserId } = input;
    const admin = createAdminClient();

    const { error } = await admin.from('crm_customer_tags').insert({
      business_id: businessId,
      crm_customer_id: crmCustomerId,
      tag_id: tagId,
      assigned_by: actorUserId,
    });

    if (error) {
      if (error.code === '23505') {
        // Tag already assigned - return true gracefully (idempotent)
        return true;
      }
      throw new Error(`Failed to assign CRM tag: ${error.message}`);
    }

    return true;
  }

  /**
   * Removes an operational tag assignment from a customer.
   */
  public static async removeTag(input: {
    businessId: string;
    crmCustomerId: string;
    tagId: string;
  }): Promise<boolean> {
    const { businessId, crmCustomerId, tagId } = input;
    const admin = createAdminClient();

    const { error } = await admin
      .from('crm_customer_tags')
      .delete()
      .eq('business_id', businessId)
      .eq('crm_customer_id', crmCustomerId)
      .eq('tag_id', tagId);

    if (error) throw new Error(`Failed to remove CRM tag: ${error.message}`);
    return true;
  }

  /**
   * Lists active tag assignments for a customer.
   */
  public static async listCustomerTags(input: {
    businessId: string;
    crmCustomerId: string;
  }): Promise<CustomerTagAssignmentDTO[]> {
    const { businessId, crmCustomerId } = input;
    const admin = createAdminClient();

    const { data, error } = await admin
      .from('crm_customer_tags')
      .select('tag_id, assigned_by, assigned_at, crm_tags(name, slug, color_hex)')
      .eq('business_id', businessId)
      .eq('crm_customer_id', crmCustomerId);

    if (error) throw new Error(`Failed to list customer tags: ${error.message}`);

    return (data || []).map((row) => {
      const tag = (row as unknown as {
        tag_id: string;
        assigned_by: string;
        assigned_at: string;
        crm_tags?: { name?: string; slug?: string; color_hex?: string };
      });
      return {
        tagId: tag.tag_id,
        tagName: tag.crm_tags?.name || 'Unknown Tag',
        tagSlug: tag.crm_tags?.slug || 'unknown',
        colorHex: tag.crm_tags?.color_hex || '#6B7280',
        assignedBy: tag.assigned_by,
        assignedAt: tag.assigned_at,
      };
    });
  }
}
