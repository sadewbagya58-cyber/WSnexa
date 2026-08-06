import { QrService } from '@/server/services/qr.service';
import { PublicGuestMenu } from '@/components/qr/public-guest-menu';
import { GuestActiveOrderBanner } from '@/components/guest/guest-active-order-banner';
import { CartProvider } from '@/features/cart/cart-context';

interface PublicMenuPageProps {
  params: Promise<{ token: string }>;
}

export default async function PublicMenuPage({ params }: PublicMenuPageProps) {
  const { token } = await params;
  const menuData = await QrService.resolvePublicBranchMenuByToken(token);

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

  const payload = menuData as unknown as React.ComponentProps<typeof PublicGuestMenu>;
  const branchId = payload.branch.id;
  const currency = payload.branch.currency || payload.business.currency || 'USD';

  return (
    <CartProvider branchId={branchId} currency={currency}>
      <PublicGuestMenu
        token={token}
        business={payload.business}
        branch={payload.branch}
        service_areas={payload.service_areas}
        dining_tables={payload.dining_tables}
        categories={payload.categories}
        items={payload.items}
      />
      <GuestActiveOrderBanner branchId={branchId} token={token} />
    </CartProvider>
  );
}
