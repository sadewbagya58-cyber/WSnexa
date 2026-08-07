export const CLAIM_INTENT_COOKIE = 'wsnexa_claim_intent';

export interface ClaimIntentData {
  orderId: string;
  accessToken: string;
  returnUrl?: string;
  createdAt: number;
}
