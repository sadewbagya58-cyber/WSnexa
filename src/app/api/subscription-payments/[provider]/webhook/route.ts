import { NextRequest, NextResponse } from 'next/server';
import {
  getSubscriptionPaymentProvider,
  PaymentProviderError,
} from '@/server/payments/subscriptions/provider-registry';
import { SubscriptionPaymentSettlementService } from '@/server/payments/subscriptions/subscription-settlement.service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;
    const rawBody = await req.text();
    const headers: Record<string, string> = {};
    req.headers.forEach((val, key) => {
      headers[key.toLowerCase()] = val;
    });

    const adapter = getSubscriptionPaymentProvider(provider);
    const verification = await adapter.verifyWebhook(rawBody, headers);

    if (!verification.verified) {
      return NextResponse.json({ error: 'SIGNATURE_VERIFICATION_FAILED' }, { status: 400 });
    }

    const settlement = await SubscriptionPaymentSettlementService.processVerifiedPaymentSettlement(verification);

    return NextResponse.json({
      received: true,
      alreadySettled: settlement.alreadySettled,
      intentId: settlement.paymentIntent?.id,
    });
  } catch (err: unknown) {
    if (err instanceof PaymentProviderError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'WEBHOOK_PROCESSING_ERROR' }, { status: 500 });
  }
}
