import { QrService } from '@/server/services/qr.service';
import { BranchPaymentService } from '@/server/services/branch-payment.service';
import { OrderSecurityService } from '@/server/services/order-security.service';
import { CheckoutPreview } from '@/components/guest/checkout-preview';
import { CartProvider } from '@/features/cart/cart-context';

interface CheckoutPageProps {
  params: Promise<{ token: string }>;
}

export default async function CheckoutPage({ params }: CheckoutPageProps) {
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

  const payload = menuData as unknown as {
    business: { name: string; currency: string };
    branch: { id: string; name: string; currency?: string };
    qrVisitSessionToken?: string;
  };

  const branchId = payload.branch.id;
  const currency = payload.branch.currency || payload.business.currency || 'USD';
  let qrVisitSessionToken = payload.qrVisitSessionToken || null;

  if (!qrVisitSessionToken) {
    try {
      const { cookies } = await import('next/headers');
      const cookieStore = await cookies();
      const cookieVal = cookieStore.get(`wsnexa_qrs_${branchId}`);
      if (cookieVal) qrVisitSessionToken = cookieVal.value;
    } catch {
      // ignore outside request context
    }
  }

  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isLoggedIn = Boolean(user);

  const [paymentMethods, securitySettings] = await Promise.all([
    BranchPaymentService.getBranchPaymentMethods(branchId),
    OrderSecurityService.getBranchSecuritySettings(branchId),
  ]);

  const enabledPaymentMethods = paymentMethods.filter((m) => m.is_enabled);

  return (
    <CartProvider branchId={branchId} currency={currency} qrVisitSessionToken={qrVisitSessionToken}>
      <CheckoutPreview
        token={token}
        branchName={payload.branch.name}
        businessName={payload.business.name}
        enabledPaymentMethods={enabledPaymentMethods}
        securitySettings={securitySettings}
        isLoggedIn={isLoggedIn}
      />
    </CartProvider>
  );
}
