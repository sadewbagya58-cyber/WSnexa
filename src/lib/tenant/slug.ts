/**
 * Generates a clean URL-safe slug from a business name.
 * Example: "Aura Grand Hotel" -> "aura-grand-hotel"
 */
export function generateSlug(name: string): string {
  const baseSlug = name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[^a-z0-9\s-]/g, '') // remove special characters
    .replace(/\s+/g, '-') // convert spaces to hyphens
    .replace(/-+/g, '-') // remove consecutive hyphens
    .replace(/^-+|-+$/g, ''); // trim leading/trailing hyphens

  return baseSlug || 'business';
}

/**
 * Appends a safe random alphanumeric suffix for slug collision resolution.
 */
export function appendSlugSuffix(slug: string): string {
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  return `${slug}-${randomSuffix}`;
}
