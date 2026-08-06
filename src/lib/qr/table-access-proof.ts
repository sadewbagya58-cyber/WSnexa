import crypto from 'crypto';

const PROOF_SECRET = process.env.TABLE_PIN_PEPPER || process.env.SUPABASE_SERVICE_ROLE_KEY || 'wsnexa_table_access_proof_secret_key_v1';

export interface TableAccessProofPayload {
  branchId: string;
  tableId: string;
  verifiedAt: number; // Unix timestamp ms
  expiresAt: number;  // Unix timestamp ms
  nonce: string;      // Random hex string
}

export interface TableAccessProofResult {
  valid: boolean;
  error?: 'EXPIRED' | 'SIGNATURE_MISMATCH' | 'BRANCH_MISMATCH' | 'TABLE_MISMATCH' | 'INVALID_FORMAT';
  payload?: TableAccessProofPayload;
}

/**
 * Creates a tamper-proof HMAC-signed table access token.
 */
export function createSignedTableAccessProof(
  branchId: string,
  tableId: string,
  ttlHours: number = 4
): { proof: string; verifiedAt: string; expiresAt: string } {
  const now = Date.now();
  const expiresAtMs = now + ttlHours * 60 * 60 * 1000;
  const nonce = crypto.randomBytes(12).toString('hex');

  const payload: TableAccessProofPayload = {
    branchId,
    tableId,
    verifiedAt: now,
    expiresAt: expiresAtMs,
    nonce,
  };

  const payloadString = JSON.stringify(payload);
  const payloadBase64 = Buffer.from(payloadString, 'utf8').toString('base64url');

  const signature = crypto
    .createHmac('sha256', PROOF_SECRET)
    .update(payloadBase64)
    .digest('hex');

  const proof = `${payloadBase64}.${signature}`;

  return {
    proof,
    verifiedAt: new Date(now).toISOString(),
    expiresAt: new Date(expiresAtMs).toISOString(),
  };
}

/**
 * Verifies a signed table access token against expected branchId and tableId.
 */
export function verifySignedTableAccessProof(
  proof: string,
  expectedBranchId: string,
  expectedTableId: string
): TableAccessProofResult {
  if (!proof || typeof proof !== 'string' || !proof.includes('.')) {
    return { valid: false, error: 'INVALID_FORMAT' };
  }

  const parts = proof.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'INVALID_FORMAT' };
  }

  const [payloadBase64, signatureHex] = parts;

  // Recompute expected HMAC signature
  const expectedSignature = crypto
    .createHmac('sha256', PROOF_SECRET)
    .update(payloadBase64)
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
  let payload: TableAccessProofPayload;
  try {
    const payloadString = Buffer.from(payloadBase64, 'base64url').toString('utf8');
    payload = JSON.parse(payloadString);
  } catch {
    return { valid: false, error: 'INVALID_FORMAT' };
  }

  // Verify branch match
  if (payload.branchId !== expectedBranchId) {
    return { valid: false, error: 'BRANCH_MISMATCH' };
  }

  // Verify table match
  if (payload.tableId !== expectedTableId) {
    return { valid: false, error: 'TABLE_MISMATCH' };
  }

  // Verify expiration
  if (Date.now() > payload.expiresAt) {
    return { valid: false, error: 'EXPIRED', payload };
  }

  return { valid: true, payload };
}
