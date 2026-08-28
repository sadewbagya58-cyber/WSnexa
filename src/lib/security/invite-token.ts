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
 * Derives a 32-byte encryption key for invitation tokens.
 */
function getEncryptionKey(): Buffer {
  const secret =
    process.env.INVITATION_ENCRYPTION_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXTAUTH_SECRET ||
    'wsnexa-invitation-secure-key-32-byte-default';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts an invitation code using authenticated AES-256-GCM encryption.
 * Output format: iv_hex:auth_tag_hex:ciphertext_hex
 */
export function encryptInvitationCode(rawCode: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(rawCode, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an invitation code using authenticated AES-256-GCM decryption.
 * Returns null if the payload is invalid, corrupted, or tampered with.
 */
export function decryptInvitationCode(encryptedPayload: string): string | null {
  if (!encryptedPayload) return null;
  try {
    const parts = encryptedPayload.split(':');
    if (parts.length !== 3) return null;
    const [ivHex, authTagHex, ciphertextHex] = parts;
    if (!ivHex || !authTagHex || !ciphertextHex) return null;

    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return null;
  }
}

/**
 * Generates an unpredictable, cryptographically secure invitation token.
 * Formats: WSN-MGR-XXXX-YYYY-ZZZZ or WSN-STF-XXXX-YYYY-ZZZZ
 */
export function generateInvitationCode(type: 'manager' | 'staff'): {
  rawCode: string;
  tokenHash: string;
  tokenPrefix: string;
  encryptedCode: string;
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
  const encryptedCode = encryptInvitationCode(rawCode);

  return {
    rawCode,
    tokenHash,
    tokenPrefix,
    encryptedCode,
  };
}
