import crypto from 'crypto';

export interface AreaQrTokenPayload {
  scope: 'area';
  businessId: string;
  branchId: string;
  areaId: string;
  version: number;
  nonce: string;
  issuedAt: number; // Unix timestamp ms
  expiresAt?: number | null; // Optional Unix timestamp ms
}

export interface AreaQrTokenVerificationResult {
  valid: boolean;
  error?:
    | 'INVALID_FORMAT'
    | 'NOT_AN_AREA_TOKEN'
    | 'SIGNATURE_MISMATCH'
    | 'EXPIRED'
    | 'MALFORMED_PAYLOAD';
  payload?: AreaQrTokenPayload;
}

function getAreaQrSecret(): string {
  return (
    process.env.QR_TOKEN_PEPPER ||
    process.env.QR_ENCRYPTION_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'wsnexa_area_qr_secret_pepper_default_2026'
  );
}

/**
 * Generates a cryptographically signed, URL-safe Area QR token.
 * Token format: WSN-AQ.<base64urlPayload>.<hmacSignature>
 */
export function createSignedAreaQrToken(
  businessId: string,
  branchId: string,
  areaId: string,
  version: number = 1,
  expiresAtMs?: number | null
): { rawToken: string; tokenPrefix: string; issuedAt: string } {
  const issuedAt = Date.now();
  const nonce = crypto.randomBytes(16).toString('hex');

  const payload: AreaQrTokenPayload = {
    scope: 'area',
    businessId,
    branchId,
    areaId,
    version,
    nonce,
    issuedAt,
    expiresAt: expiresAtMs || null,
  };

  const payloadJson = JSON.stringify(payload);
  const payloadBase64 = Buffer.from(payloadJson, 'utf8').toString('base64url');

  const signature = crypto
    .createHmac('sha256', getAreaQrSecret())
    .update(`WSN-AQ.${payloadBase64}`)
    .digest('hex');

  const rawToken = `WSN-AQ.${payloadBase64}.${signature}`;
  const tokenPrefix = `AQ-${areaId.substring(0, 4)}-v${version}`;

  return {
    rawToken,
    tokenPrefix,
    issuedAt: new Date(issuedAt).toISOString(),
  };
}

/**
 * Verifies a raw token to determine if it is a valid, authentic Area QR token.
 * Returns valid: false with NOT_AN_AREA_TOKEN if token is a standard Branch QR or legacy format.
 */
export function verifyAreaQrToken(rawToken: string): AreaQrTokenVerificationResult {
  if (!rawToken || typeof rawToken !== 'string') {
    return { valid: false, error: 'INVALID_FORMAT' };
  }

  if (!rawToken.startsWith('WSN-AQ.')) {
    return { valid: false, error: 'NOT_AN_AREA_TOKEN' };
  }

  const parts = rawToken.split('.');
  if (parts.length !== 3 || parts[0] !== 'WSN-AQ') {
    return { valid: false, error: 'INVALID_FORMAT' };
  }

  const [, payloadBase64, signatureHex] = parts;

  // Recompute expected HMAC signature
  const expectedSignature = crypto
    .createHmac('sha256', getAreaQrSecret())
    .update(`WSN-AQ.${payloadBase64}`)
    .digest('hex');

  // Constant-time signature comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signatureHex, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (
    sigBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    return { valid: false, error: 'SIGNATURE_MISMATCH' };
  }

  // Parse payload
  let payload: AreaQrTokenPayload;
  try {
    const rawJson = Buffer.from(payloadBase64, 'base64url').toString('utf8');
    payload = JSON.parse(rawJson);
  } catch {
    return { valid: false, error: 'MALFORMED_PAYLOAD' };
  }

  // Validate structural fields
  if (
    payload.scope !== 'area' ||
    !payload.businessId ||
    !payload.branchId ||
    !payload.areaId ||
    typeof payload.version !== 'number'
  ) {
    return { valid: false, error: 'MALFORMED_PAYLOAD' };
  }

  // Check expiration if set
  if (payload.expiresAt && payload.expiresAt < Date.now()) {
    return { valid: false, error: 'EXPIRED', payload };
  }

  return { valid: true, payload };
}

/**
 * Extracts metadata prefix from an Area QR token safely without leaking secrets.
 */
export function getAreaQrTokenPrefix(rawToken: string): string | null {
  const res = verifyAreaQrToken(rawToken);
  if (!res.valid || !res.payload) return null;
  return `AQ-${res.payload.areaId.substring(0, 4)}-v${res.payload.version}`;
}
