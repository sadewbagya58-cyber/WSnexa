import { NextRequest, NextResponse } from 'next/server';
import {
  getSubscriptionPaymentProvider,
  PaymentProviderError,
} from '@/server/payments/subscriptions/provider-registry';
import { SubscriptionPaymentSettlementService } from '@/server/payments/subscriptions/subscription-settlement.service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;
    const url = new URL(req.url);
    const queryParams: Record<string, string> = {};
    url.searchParams.forEach((val, key) => {
      queryParams[key] = val;
    });

    const adapter = getSubscriptionPaymentProvider(provider);
    const verification = await adapter.verifyReturn(queryParams);

    if (verification.verified) {
      await SubscriptionPaymentSettlementService.processVerifiedPaymentSettlement(verification);
      return NextResponse.redirect(new URL('/dashboard/settings/subscription?payment=success', req.url));
    } else {
      return NextResponse.redirect(new URL('/dashboard/settings/subscription?payment=failed', req.url));
    }
  } catch (err: unknown) {
    if (err instanceof PaymentProviderError) {
      return NextResponse.redirect(
        new URL(`/dashboard/settings/subscription?payment=error&reason=${err.code.toLowerCase()}`, req.url)
      );
    }
    return NextResponse.redirect(new URL('/dashboard/settings/subscription?payment=error', req.url));
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  return GET(req, { params });
}
