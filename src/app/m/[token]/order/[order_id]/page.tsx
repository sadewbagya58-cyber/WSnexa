import Link from 'next/link';
import { OrderService } from '@/server/services/order.service';
import { QrService } from '@/server/services/qr.service';
import { Button } from '@/components/ui/button';
import { RealtimeOrderTracker } from '@/components/guest/realtime-order-tracker';

interface OrderConfirmationPageProps {
  params: Promise<{ token: string; order_id: string }>;
  searchParams: Promise<{ access_token?: string }>;
}

export default async function OrderConfirmationPage({ params, searchParams }: OrderConfirmationPageProps) {
  const { token, order_id } = await params;
  const { access_token } = await searchParams;

  const [menuData, order] = await Promise.all([
    QrService.resolvePublicBranchMenuByToken(token),
    OrderService.getOrderById(order_id, access_token),
  ]);

  if (!order) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4 antialiased">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg border border-zinc-200 space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl">
            🔒
          </div>
          <h1 className="text-xl font-bold text-zinc-950">Access Restricted</h1>
          <p className="text-xs text-zinc-600 leading-relaxed">
            Order not found or invalid security access token. Please scan the venue QR code or access your order via the menu active order banner.
          </p>
          <Link href={`/m/${token}`}>
            <Button className="w-full text-xs font-bold mt-2">← Back to Menu</Button>
          </Link>
        </div>
      </div>
    );
  }

  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const businessName =
    menuData && typeof menuData.business === 'object' && menuData.business !== null
      ? (menuData.business as { name: string }).name
      : 'WSNexa Venue';

  return (
    <RealtimeOrderTracker
      initialOrder={order}
      token={token}
      businessName={businessName}
      accessToken={access_token || order.access_token}
      currentUserId={user ? user.id : null}
    />
  );
}
