import Link from 'next/link';
import { OrderService } from '@/server/services/order.service';
import { QrService } from '@/server/services/qr.service';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/features/cart/cart-calculations';

interface OrderConfirmationPageProps {
  params: Promise<{ token: string; order_id: string }>;
}

export default async function OrderConfirmationPage({ params }: OrderConfirmationPageProps) {
  const { token, order_id } = await params;

  const [menuData, order] = await Promise.all([
    QrService.resolvePublicBranchMenuByToken(token),
    OrderService.getOrderById(order_id),
  ]);

  if (!order) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4 antialiased">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg border border-zinc-200 space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl">
            ❓
          </div>
          <h1 className="text-xl font-bold text-zinc-950">Order Not Found</h1>
          <p className="text-xs text-zinc-600 leading-relaxed">
            We could not find the requested order. Please verify your order link or scan the QR code again.
          </p>
          <Link href={`/m/${token}`}>
            <Button className="w-full text-xs font-bold mt-2">← Back to Menu</Button>
          </Link>
        </div>
      </div>
    );
  }

  const businessName =
    menuData && typeof menuData.business === 'object' && menuData.business !== null
      ? (menuData.business as { name: string }).name
      : 'WSNexa Venue';

  const statusVariantMap: Record<string, 'neutral' | 'warning' | 'success' | 'destructive'> = {
    pending: 'warning',
    confirmed: 'warning',
    preparing: 'warning',
    ready: 'success',
    completed: 'neutral',
    cancelled: 'destructive',
  };

  const statusEmojiMap: Record<string, string> = {
    pending: '⏳',
    confirmed: '📋',
    preparing: '🍳',
    ready: '🔔',
    completed: '✅',
    cancelled: '❌',
  };

  return (
    <div className="min-h-screen bg-zinc-50 font-sans antialiased text-zinc-900 pb-16">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-zinc-200 px-4 py-3 shadow-xs">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              {businessName}
            </span>
            <h1 className="text-base font-black tracking-tight text-zinc-950">
              Order Confirmation
            </h1>
          </div>
          <Badge variant={statusVariantMap[order.status] || 'neutral'}>
            {statusEmojiMap[order.status] || '📦'} {order.status.toUpperCase()}
          </Badge>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-6">
        {/* Status Card */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm text-center space-y-3">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-4xl border border-emerald-200">
            {statusEmojiMap[order.status] || '🎉'}
          </div>
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-zinc-400">
              Order Number
            </span>
            <h2 className="text-3xl font-black text-zinc-950 tracking-tight">
              {order.order_number_formatted}
            </h2>
          </div>
          <p className="text-xs text-zinc-600 max-w-sm mx-auto leading-relaxed">
            {order.status === 'pending' && 'Your order has been received by the kitchen. Preparation will begin shortly.'}
            {order.status === 'confirmed' && 'Your order has been confirmed by the kitchen.'}
            {order.status === 'preparing' && 'Your meal is actively being prepared in the kitchen!'}
            {order.status === 'ready' && 'Your order is ready! It will be served to your table shortly.'}
            {order.status === 'completed' && 'Order completed. Thank you for dining with us!'}
            {order.status === 'cancelled' && 'This order was cancelled.'}
          </p>
        </div>

        {/* Order Info Details */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Order Metadata
          </span>
          <div className="flex items-center justify-between text-sm font-bold text-zinc-950">
            <span>Dining Table:</span>
            {order.table ? (
              <span className="text-emerald-800 font-extrabold">📍 {order.table.name}</span>
            ) : (
              <span className="text-zinc-500 font-normal">Direct Order</span>
            )}
          </div>
          <div className="flex items-center justify-between text-sm text-zinc-600">
            <span>Placed At:</span>
            <span className="font-mono text-xs">{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          {order.guest_name && (
            <div className="flex items-center justify-between text-sm text-zinc-600">
              <span>Guest Name:</span>
              <span className="font-semibold text-zinc-900">{order.guest_name}</span>
            </div>
          )}
          {order.guest_notes && (
            <div className="pt-2 border-t border-zinc-100 text-xs text-amber-900 italic">
              📝 Special Notes: &quot;{order.guest_notes}&quot;
            </div>
          )}
        </div>

        {/* Itemized Order Breakdown */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs space-y-4">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-500 border-b border-zinc-100 pb-3">
            Itemized Order
          </h3>

          <div className="space-y-3 divide-y divide-zinc-100">
            {order.items?.map((item) => (
              <div key={item.id} className="pt-3 first:pt-0 flex items-start justify-between gap-4">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 text-sm font-bold text-zinc-950">
                    <span className="font-mono text-zinc-500 text-xs">{item.quantity}x</span>
                    <span>{item.item_name_snapshot}</span>
                  </div>

                  {item.order_item_modifiers && item.order_item_modifiers.length > 0 && (
                    <div className="pl-6 space-y-0.5 text-xs text-zinc-500">
                      {item.order_item_modifiers.map((mod) => (
                        <div key={mod.id}>
                          • {mod.group_name_snapshot}: {mod.option_name_snapshot}
                        </div>
                      ))}
                    </div>
                  )}

                  {item.special_instructions && (
                    <div className="pl-6 text-xs text-amber-900 italic">
                      📝 &quot;{item.special_instructions}&quot;
                    </div>
                  )}
                </div>

                <div className="text-sm font-black text-zinc-950">
                  {formatCurrency(item.line_subtotal_cents, order.currency)}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-zinc-200 space-y-2">
            <div className="flex justify-between text-xs text-zinc-600">
              <span>Subtotal</span>
              <span className="font-mono font-bold">{formatCurrency(order.subtotal_cents, order.currency)}</span>
            </div>
            <div className="flex justify-between text-base font-black text-zinc-950 pt-2 border-t border-zinc-100">
              <span>Total Paid / Due at Counter</span>
              <span>{formatCurrency(order.total_cents, order.currency)}</span>
            </div>
          </div>
        </div>

        {/* Return to Menu Button */}
        <div className="space-y-3">
          <Link href={`/m/${token}`}>
            <Button className="w-full text-xs font-bold py-3">← Back to Digital Menu</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
