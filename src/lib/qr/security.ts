import crypto from 'crypto';

export interface GeneratedTokenPair {
  rawToken: string;
  tokenHash: string;
  tokenPrefix: string;
  encryptedToken: string;
}

/**
 * Generates a cryptographically random, URL-safe raw token (256-bit entropy)
 * and returns its SHA-256 hash, safe 8-character prefix, and encrypted raw token.
 */
export function generateSecureQrToken(): GeneratedTokenPair {
  // 32 bytes = 256 bits of entropy
  const buffer = crypto.randomBytes(32);
  const rawToken = buffer.toString('base64url');
  
  const tokenHash = hashQrToken(rawToken);
  const tokenPrefix = rawToken.substring(0, 8);
  const encryptedToken = encryptRawToken(rawToken);

  return {
    rawToken,
    tokenHash,
    tokenPrefix,
    encryptedToken,
  };
}

/**
 * Hashes a raw QR token using SHA-256 with optional server pepper.
 */
export function hashQrToken(rawToken: string): string {
  const pepper = process.env.QR_TOKEN_PEPPER || '';
  return crypto
    .createHash('sha256')
    .update(rawToken + pepper)
    .digest('hex');
}

/**
 * Encrypts raw token using AES-256-GCM for server-side persistence.
 */
export function encryptRawToken(rawToken: string): string {
  const secretKey = crypto
    .createHash('sha256')
    .update(process.env.QR_ENCRYPTION_KEY || 'wsnexa_qr_encryption_secret_key_32_bytes_default')
    .digest();
  
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', secretKey, iv);
  
  let encrypted = cipher.update(rawToken, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts raw token from encrypted string.
 */
export function decryptRawToken(encryptedToken: string | null): string | null {
  if (!encryptedToken || !encryptedToken.includes(':')) return null;
  try {
    const parts = encryptedToken.split(':');
    if (parts.length !== 3) return null;
    const [ivHex, authTagHex, encryptedHex] = parts;

    const secretKey = crypto
      .createHash('sha256')
      .update(process.env.QR_ENCRYPTION_KEY || 'wsnexa_qr_encryption_secret_key_32_bytes_default')
      .digest();
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', secretKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Failed to decrypt token:', err);
    return null;
  }
}

/**
 * Generates a random numeric Table PIN (length 4, 5, or 6).
 */
export function generateTablePin(length: number = 4): string {
  const targetLength = [4, 5, 6].includes(length) ? length : 4;
  let pin = '';
  for (let i = 0; i < targetLength; i++) {
    pin += Math.floor(Math.random() * 10).toString();
  }
  return pin;
}

/**
 * Hashes Table PIN using HMAC-SHA-256 with a server-only pepper.
 * NEVER stores plain PIN in database!
 */
export function hashTablePin(pin: string): string {
  const pepper = process.env.TABLE_PIN_PEPPER || 'wsnexa_table_pin_secret_pepper_default';
  return crypto
    .createHmac('sha256', pepper)
    .update(pin.trim())
    .digest('hex');
}

/**
 * Verifies customer PIN input against stored table PIN hash using constant-time check.
 */
export function verifyTablePin(inputPin: string, storedPinHash: string | null): boolean {
  if (!storedPinHash) return false;
  const computedHash = hashTablePin(inputPin);
  
  try {
    const a = Buffer.from(computedHash, 'hex');
    const b = Buffer.from(storedPinHash, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Anonymizes IP address by SHA-256 hashing it with a salt for privacy compliance.
 */
export function hashClientIp(ip: string | null): string | null {
  if (!ip) return null;
  const salt = process.env.QR_ANALYTICS_SALT || 'wsnexa_qr_salt_default';
  return crypto.createHash('sha256').update(ip + salt).digest('hex');
}
