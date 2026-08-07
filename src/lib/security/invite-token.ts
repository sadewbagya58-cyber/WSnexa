import crypto from 'crypto';

/**
 * Normalizes user input invitation code by converting to uppercase,
 * removing whitespace, hyphens, and any non-alphanumeric characters.
 */
export function normalizeInvitationCode(input: string): string {
  if (!input) return '';
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Computes a cryptographically secure SHA-256 hash of the normalized invitation code.
 * Only this hash is stored in the database.
 */
export function hashInvitationCode(rawCode: string): string {
  const normalized = normalizeInvitationCode(rawCode);
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Generates an unpredictable, cryptographically secure invitation token.
 * Formats: WSN-MGR-XXXX-YYYY-ZZZZ or WSN-STF-XXXX-YYYY-ZZZZ
 */
export function generateInvitationCode(type: 'manager' | 'staff'): {
  rawCode: string;
  tokenHash: string;
  tokenPrefix: string;
} {
  const bytes = crypto.randomBytes(9);
  // Base32 character set avoiding ambiguous characters (0, O, 1, I, L)
  const charset = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  let randomString = '';
  for (let i = 0; i < bytes.length; i++) {
    randomString += charset[bytes[i] % charset.length];
  }

  const block1 = randomString.substring(0, 4);
  const block2 = randomString.substring(4, 8);
  const block3 = randomString.substring(8, 9) + charset[crypto.randomBytes(1)[0] % charset.length] + charset[crypto.randomBytes(1)[0] % charset.length];

  const prefixTag = type === 'manager' ? 'WSN-MGR' : 'WSN-STF';
  const rawCode = `${prefixTag}-${block1}-${block2}-${block3}`;
  const tokenHash = hashInvitationCode(rawCode);
  const tokenPrefix = `${prefixTag}-${block1}...`;

  return {
    rawCode,
    tokenHash,
    tokenPrefix,
  };
}
