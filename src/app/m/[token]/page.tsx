import { createClient } from '@/lib/supabase/server';
import { QrService } from '@/server/services/qr.service';
import { LoyaltyService } from '@/server/services/loyalty.service';
import { PublicGuestMenu } from '@/components/qr/public-guest-menu';
import { CartProvider } from '@/features/cart/cart-context';

interface PublicMenuPageProps {
  params: Promise<{ token: string }>;
}

export default async function PublicMenuPage({ params }: PublicMenuPageProps) {
  const { token } = await params;

  const [menuData, userRes] = await Promise.all([
    QrService.resolvePublicBranchMenuByToken(token),
    (async () => {
      try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        return user;
      } catch {
        return null;
      }
    })(),
  ]);

  if (!menuData || !menuData.success || typeof menuData.business !== 'object') {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4 antialiased">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg border border-zinc-200 space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl">
            📱
          </div>
          <h1 className="text-xl font-bold text-zinc-950">Menu Unavailable</h1>
          <p className="text-xs text-zinc-600 leading-relaxed">
            This QR code is invalid, expired, or has been revoked. Please ask your server for assistance.
          </p>
        </div>
      </div>
    );
  }

  const payload = menuData as unknown as React.ComponentProps<typeof PublicGuestMenu> & { qrVisitSessionToken?: string };
  const branchId = payload.branch.id;
  const businessId = payload.business.id;
  const currency = payload.branch.currency || payload.business.currency || 'USD';
  const qrVisitSessionToken = payload.qrVisitSessionToken || null;
  const user = userRes;

  if (qrVisitSessionToken) {
    try {
      const { cookies } = await import('next/headers');
      const cookieStore = await cookies();
      cookieStore.set(`wsnexa_qrs_${branchId}`, qrVisitSessionToken, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 7200, // 2 hours
      });
    } catch {
      // ignore outside request context
    }
  }

  const { SubscriptionService } = await import('@/server/services/subscription.service');
  const [availableRewards, loyaltyAccount, subContext] = await Promise.all([
    LoyaltyService.getAvailableRewards(businessId),
    user ? LoyaltyService.getCustomerAccount(user.id, businessId) : Promise.resolve(null),
    SubscriptionService.resolveSubscriptionContext(businessId),
  ]);

  const isOrderingUnavailable = subContext.effectiveStatus === 'SUSPENDED' || subContext.effectiveStatus === 'CANCELLED';

  return (
    <CartProvider branchId={branchId} currency={currency} qrVisitSessionToken={qrVisitSessionToken}>
      <PublicGuestMenu
        token={token}
        business={payload.business}
        branch={payload.branch}
        service_areas={payload.service_areas}
        dining_tables={payload.dining_tables}
        categories={payload.categories}
        items={payload.items}
        isAuthenticated={!!user}
        loyaltyAccount={loyaltyAccount}
        availableRewards={availableRewards}
        isOrderingUnavailable={isOrderingUnavailable}
      />
    </CartProvider>
  );
}
