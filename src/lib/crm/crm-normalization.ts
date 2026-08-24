/**
 * Normalizes email address for identity resolution:
 * - Trims whitespace
 * - Converts to lowercase
 * - Returns null if string is empty or invalid
 */
export function normalizeEmail(email?: string | null): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !trimmed.includes('@')) return null;
  return trimmed;
}

/**
 * Normalizes phone number for identity resolution:
 * - Strips all formatting spaces, dashes, parentheses
 * - Retains leading '+' if present
 * - Returns null if digit count is too short (< 6 digits)
 */
export function normalizePhone(phone?: string | null): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;

  const hasLeadingPlus = trimmed.startsWith('+');
  const digitsOnly = trimmed.replace(/\D/g, '');

  if (digitsOnly.length < 6) return null;

  return hasLeadingPlus ? `+${digitsOnly}` : digitsOnly;
}

/**
 * Normalizes customer display name:
 * - Trims whitespace and collapses multiple spaces into single space
 * - Capitalizes appropriately for presentation
 */
export function normalizeDisplayName(name?: string | null): string | null {
  if (!name) return null;
  const collapsed = name.trim().replace(/\s+/g, ' ');
  if (!collapsed) return null;
  return collapsed;
}

/**
 * Masks email address for privacy-safe display:
 * Example: john.doe@example.com -> j***e@example.com
 */
export function maskEmail(email?: string | null): string | null {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  const parts = normalized.split('@');
  if (parts.length !== 2) return normalized;

  const [local, domain] = parts;
  if (local.length <= 2) {
    return `${local[0] || '*'}***@${domain}`;
  }

  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

/**
 * Masks phone number for privacy-safe display:
 * Example: +94771234567 -> +94 ******4567
 */
export function maskPhone(phone?: string | null): string | null {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;

  if (normalized.length <= 4) {
    return '****';
  }

  const visibleDigits = normalized.slice(-4);
  const prefix = normalized.startsWith('+') ? normalized.slice(0, 3) : '';
  return `${prefix} ******${visibleDigits}`;
}
