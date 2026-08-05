import crypto from 'crypto';

export interface GeneratedTokenPair {
  rawToken: string;
  tokenHash: string;
  tokenPrefix: string;
}

/**
  * Generates a cryptographically random, URL-safe raw token (256-bit entropy)
  * and returns its SHA-256 hash and safe 8-character prefix.
  */
export function generateSecureQrToken(): GeneratedTokenPair {
  // 32 bytes = 256 bits of entropy
  const buffer = crypto.randomBytes(32);
  const rawToken = buffer.toString('base64url');
  
  const tokenHash = hashQrToken(rawToken);
  const tokenPrefix = rawToken.substring(0, 8);

  return {
    rawToken,
    tokenHash,
    tokenPrefix,
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
  * Anonymizes IP address by SHA-256 hashing it with a salt for privacy compliance.
  */
export function hashClientIp(ip: string | null): string | null {
  if (!ip) return null;
  const salt = process.env.QR_ANALYTICS_SALT || 'wsnexa_qr_salt_default';
  return crypto.createHash('sha256').update(ip + salt).digest('hex');
}
