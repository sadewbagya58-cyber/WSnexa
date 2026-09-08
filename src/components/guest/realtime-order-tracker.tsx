'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { OrderRecord } from '@/server/services/order.service';
import { useRealtimeOrder } from '@/hooks/use-realtime-order';
import { formatCurrency } from '@/features/cart/cart-calculations';
import { submitCustomerAssistanceAction } from '@/server/actions/waiter';
import { WaiterRequestType } from '@/lib/validation/waiter';
import { SaveOrderButton } from '@/components/guest/save-order-button';
import { useGuestLanguage, GuestLanguageToggle } from '@/features/qr/guest-language-context';

interface RealtimeOrderTrackerProps {
  initialOrder: OrderRecord;
  token: string;
  businessName: string;
  accessToken?: string;
  currentUserId?: string | null;
}

export const RealtimeOrderTracker: React.FC<RealtimeOrderTrackerProps> = ({
  initialOrder,
  token,
  businessName,
  accessToken,
  currentUserId,
}) => {
  const { t } = useGuestLanguage();
  const { order, connectionStatus } = useRealtimeOrder(initialOrder, accessToken);
  const [isPending, startTransition] = useTransition();
  const [assistanceFeedback, setAssistanceFeedback] = useState<{ success: boolean; message: string } | null>(null);

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

  const steps = [
    { key: 'pending', label: t('Order Received', 'Order ලැබුණි') },
    { key: 'confirmed', label: t('Confirmed', 'තහවුරු විය') },
    { key: 'preparing', label: t('Preparing', 'සකසමින්') },
    { key: 'ready', label: t('Ready to Serve', 'ලෑස්තියි') },
    { key: 'completed', label: t('Completed', 'සම්පූර්ණයි') },
  ];

  const getStepStatus = (stepKey: string) => {
    if (order.status === 'cancelled') return 'cancelled';

    const orderIndex = steps.findIndex((s) => s.key === order.status);
    const stepIndex = steps.findIndex((s) => s.key === stepKey);

    if (stepIndex < orderIndex) return 'completed';
    if (stepIndex === orderIndex) return 'current';
    return 'upcoming';
  };

  const handleAssistanceRequest = (type: WaiterRequestType, label: string) => {
    if (!order.table_id) {
      setAssistanceFeedback({
        success: false,
        message: t(
          'Table verification required to request assistance.',
          'සේවකයෙකු කැඳවීමට Table එක තහවුරු කළ යුතුය.'
        ),
      });
      return;
    }

    setAssistanceFeedback(null);
    startTransition(async () => {
      const res = await submitCustomerAssistanceAction({
        rawQrToken: token,
        tableId: order.table_id!,
        requestType: type,
        orderId: order.id,
      });

      if (res.success) {
        setAssistanceFeedback({
          success: true,
          message: `${t('Request sent:', 'ඉල්ලීම යවන ලදී:')} "${label}". ${t('A waiter will attend to your table shortly!', 'කාර්ය මණ්ඩලය සුළු මොහොතකින් පැමිණෙනු ඇත!')}`,
        });
      } else {
        setAssistanceFeedback({
          success: false,
          message: res.message || t('Failed to send assistance request.', 'ඉල්ලීම යැවීමට නොහැකි විය.'),
        });
      }
    });
  };

  const getStatusBadgeLabel = (status: string) => {
    const emoji = statusEmojiMap[status] || '📦';
    switch (status) {
      case 'pending':
        return `${emoji} ${t('ORDER RECEIVED', 'ORDER එක ලැබුණි')}`;
      case 'confirmed':
        return `${emoji} ${t('CONFIRMED', 'තහවුරු විය')}`;
      case 'preparing':
        return `${emoji} ${t('PREPARING', 'පිළියෙල කරමින්')}`;
      case 'ready':
        return `${emoji} ${t('READY TO SERVE', 'ලෑස්තියි')}`;
      case 'completed':
        return `${emoji} ${t('COMPLETED', 'සම්පූර්ණයි')}`;
      case 'cancelled':
        return `${emoji} ${t('CANCELLED', 'අවලංගුයි')}`;
      default:
        return `${emoji} ${status.toUpperCase()}`;
    }
  };

  const getLocalizedPaymentMethodLabel = (pm: string) => {
    switch (pm) {
      case 'pay_at_counter':
        return t('Pay at Counter', 'Counter එකෙන් ගෙවීම');
      case 'cash':
        return t('Cash', 'මුදලින් (Cash)');
      case 'card':
        return t('Card at Venue', 'Card මඟින් (Venue)');
      case 'qr_payment':
      case 'qr_pay':
        return t('Venue QR Pay', 'Venue QR Pay');
      case 'online_payment':
      case 'online':
        return t('Online Payment', 'Online ගෙවීම');
      default:
        return pm.replace('_', ' ');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 font-sans antialiased text-zinc-900 pb-16">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-zinc-200 px-4 py-2.5 shadow-xs">
        <div className="max-w-2xl mx-auto space-y-2">
          {/* Row 1: Venue/Business name on left, Language toggle + Live indicator on right */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 truncate max-w-[170px] sm:max-w-xs">
              {businessName}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <GuestLanguageToggle />
              {connectionStatus === 'connected' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  {t('Live', 'සජීවී')}
                </span>
              )}
              {connectionStatus === 'reconnecting' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping shrink-0" />
                  {t('Reconnecting...', 'නැවත සම්බන්ධ වෙමින්...')}
                </span>
              )}
              {connectionStatus === 'offline' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-600 border border-zinc-200">
                  {t('Offline', 'Offline')}
                </span>
              )}
            </div>
          </div>

          {/* Row 2: Live Order Tracker title + Order Status Badge */}
          <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
            <h1 className="text-sm sm:text-base font-black tracking-tight text-zinc-950 shrink-0">
              {t('Live Order Tracker', 'සජීවී Order Tracker එක')}
            </h1>
            <div className="shrink-0 max-w-full">
              <Badge
                variant={order.approval_status === 'pending_waiter_approval' ? 'warning' : statusVariantMap[order.status] || 'neutral'}
                className="text-[10px] sm:text-xs font-bold py-0.5 sm:py-1 px-2.5 text-center whitespace-normal leading-tight max-w-full"
              >
                {order.approval_status === 'pending_waiter_approval'
                  ? t('⏳ WAITING FOR STAFF APPROVAL', '⏳ කාර්ය මණ්ඩල අනුමැතිය බලාපොරොත්තුවෙන්')
                  : order.approval_status === 'rejected'
                  ? t('❌ NOT APPROVED', '❌ අනුමත නොවීය')
                  : getStatusBadgeLabel(order.status)}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-6">
        {/* Status Card */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm text-center space-y-3">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-50 text-4xl border border-amber-200 shadow-inner">
            {order.approval_status === 'pending_waiter_approval'
              ? '⏳'
              : order.approval_status === 'rejected'
              ? '🛑'
              : statusEmojiMap[order.status] || '🎉'}
          </div>
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-zinc-400">
              {t('Order Number', 'Order අංකය')}
            </span>
            <h2 className="text-3xl font-black text-zinc-950 tracking-tight">
              {order.order_number_formatted}
            </h2>
          </div>
          <p className="text-xs text-zinc-600 max-w-sm mx-auto leading-relaxed font-medium">
            {order.approval_status === 'pending_waiter_approval' && (
              <span className="text-amber-800 font-bold">
                {t(
                  'Your order has been submitted and is waiting for staff approval before being sent to the kitchen.',
                  'ඔබගේ Order එක ලැබී ඇති අතර කුස්සියට යැවීමට පෙර කාර්ය මණ්ඩලයේ අනුමැතිය බලාපොරොත්තුවෙන් සිටී.'
                )}
              </span>
            )}
            {order.approval_status === 'rejected' && (
              <span className="text-rose-700 font-bold">
                {t('Order was not accepted by staff.', 'කාර්ය මණ්ඩලය විසින් Order එක ප්‍රතික්ෂේප කරන ලදී.')}{' '}
                {order.rejection_reason && `${t('Reason:', 'හේතුව:')} ${order.rejection_reason}`}
              </span>
            )}
            {order.approval_status === 'approved' && (
              <>
                {order.status === 'pending' &&
                  t(
                    'Your order has been received by the kitchen. Preparation will begin shortly.',
                    'කුස්සියට Order එක ලැබී ඇත. පිළියෙල කිරීම ඉක්මනින් ආරම්භ වේ.'
                  )}
                {order.status === 'confirmed' &&
                  t('Your order has been confirmed by the kitchen.', 'කුස්සිය විසින් ඔබගේ Order එක තහවුරු කරන ලදී.')}
                {order.status === 'preparing' &&
                  t('Your meal is actively being prepared in the kitchen!', 'ඔබගේ ආහාර පිළියෙල වෙමින් පවතී!')}
                {order.status === 'ready' &&
                  t('Your order is ready! It will be served to your table shortly.', 'ඔබගේ Order එක සූදානම්! සුළු මොහොතකින් මේසයට ගෙනෙනු ඇත.')}
                {order.status === 'completed' &&
                  t('Order completed. Thank you for dining with us!', 'Order එක සම්පූර්ණයි. පැමිණීම ගැන ස්තූතියි!')}
                {order.status === 'cancelled' && t('This order was cancelled.', 'මෙම Order එක අවලංගු කරන ලදී.')}
              </>
            )}
          </p>

          {/* Timeline Progress Tracker */}
          {order.status !== 'cancelled' && order.approval_status === 'approved' && (
            <div className="pt-4 border-t border-zinc-100">
              <div className="relative flex items-center justify-between">
                {steps.map((step, idx) => {
                  const status = getStepStatus(step.key);
                  return (
                    <div key={step.key} className="flex-1 flex flex-col items-center relative z-10">
                      <div
                        className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                          status === 'completed'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : status === 'current'
                            ? 'bg-amber-500 text-white ring-4 ring-amber-100 shadow-sm animate-pulse'
                            : 'bg-zinc-200 text-zinc-500'
                        }`}
                      >
                        {status === 'completed' ? '✓' : idx + 1}
                      </div>
                      <span className="text-[10px] font-bold text-zinc-600 mt-1.5 text-center leading-tight">
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Customer Assistance Quick Action Buttons */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs space-y-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            {t('Need Assistance at Your Table?', 'ඔබගේ මේසයට සේවකයෙකු අවශ්‍යද?')}
          </div>

          {assistanceFeedback && (
            <div
              className={`rounded-xl p-3 text-xs font-bold border ${
                assistanceFeedback.success
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-red-200 bg-red-50 text-red-900'
              }`}
            >
              {assistanceFeedback.message}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="text-xs font-bold py-2.5 flex items-center justify-center gap-1.5 min-h-[44px]"
              onClick={() => handleAssistanceRequest('call_waiter', 'Call Waiter')}
              disabled={isPending}
            >
              <span>🔔</span> {t('Call Waiter', 'Waiter අමතන්න')}
            </Button>

            <Button
              variant="outline"
              className="text-xs font-bold py-2.5 flex items-center justify-center gap-1.5 min-h-[44px]"
              onClick={() => handleAssistanceRequest('need_water', 'Need Water')}
              disabled={isPending}
            >
              <span>💧</span> {t('Need Water', 'වතුර අවශ්‍යයි')}
            </Button>

            <Button
              variant="outline"
              className="text-xs font-bold py-2.5 flex items-center justify-center gap-1.5 min-h-[44px]"
              onClick={() => handleAssistanceRequest('need_bill', 'Need Bill')}
              disabled={isPending}
            >
              <span>🍽️</span> {t('Need Bill', 'බිල අවශ්‍යයි')}
            </Button>

            <Button
              variant="outline"
              className="text-xs font-bold py-2.5 flex items-center justify-center gap-1.5 min-h-[44px]"
              onClick={() => handleAssistanceRequest('need_assistance', 'Need Assistance')}
              disabled={isPending}
            >
              <span>❓</span> {t('Need Assistance', 'උදව් අවශ්‍යයි')}
            </Button>
          </div>
        </div>

        {/* Order Info Details */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            {t('Order Details', 'Order විස්තර')}
          </span>
          <div className="flex items-center justify-between text-sm font-bold text-zinc-950">
            <span>{t('Dining Table:', 'මේසය:')}</span>
            {order.table ? (
              <span className="text-emerald-800 font-extrabold">📍 {order.table.name}</span>
            ) : (
              <span className="text-zinc-500 font-normal">{t('Direct Order', 'සෘජු ඇණවුම')}</span>
            )}
          </div>
          <div className="flex items-center justify-between text-sm text-zinc-600">
            <span>{t('Placed At:', 'වේලාව:')}</span>
            <span className="font-mono text-xs">
              {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          {order.guest_name && (
            <div className="flex items-center justify-between text-sm text-zinc-600">
              <span>{t('Guest Name:', 'නම:')}</span>
              <span className="font-semibold text-zinc-900">{order.guest_name}</span>
            </div>
          )}
          {order.guest_notes && (
            <div className="pt-2 border-t border-zinc-100 text-xs text-amber-900 italic">
              📝 {t('Special Notes:', 'විශේෂ සටහන්:')} &quot;{order.guest_notes}&quot;
            </div>
          )}
        </div>

        {/* Itemized Order Breakdown */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs space-y-4">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-500 border-b border-zinc-100 pb-3">
            {t('Itemized Order', 'ඇණවුම් කළ අයිතම')}
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
              <span>{t('Subtotal', 'උප එකතුව')}</span>
              <span className="font-mono font-bold">
                {formatCurrency(order.subtotal_cents, order.currency)}
              </span>
            </div>
            {(order.reward_title_snapshot || (order.discount_cents || 0) > 0) && (
              <>
                <div className="flex justify-between text-xs text-emerald-800 font-bold bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                  <span>🎁 {t('Reward Used:', 'ලැබුණු ප්‍රතිලාභය:')} {order.reward_title_snapshot || t('Discount Applied', 'වට්ටම යොදන ලදී')}</span>
                  <span className="font-mono">
                    -{formatCurrency(order.discount_cents || 0, order.currency)}
                  </span>
                </div>
                {order.reward_points_redeemed_snapshot ? (
                  <div className="flex justify-between text-[11px] text-amber-800 italic px-1">
                    <span>{t('Points Redeemed', 'භාවිතා කළ Points')}</span>
                    <span className="font-mono font-bold">{order.reward_points_redeemed_snapshot} pts</span>
                  </div>
                ) : null}
              </>
            )}
            <div className="flex justify-between text-base font-black text-zinc-950 pt-2 border-t border-zinc-100">
              <span>{t('Total Amount', 'මුළු මුදල')}</span>
              <span>{formatCurrency(order.total_cents, order.currency)}</span>
            </div>
          </div>
        </div>

        {/* Payment Summary Card */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-500">
              {t('Payment Summary', 'ගෙවීම් සාරාංශය')}
            </span>
            <Badge
              variant={
                order.payment_status === 'paid'
                  ? 'success'
                  : order.payment_status === 'partially_paid'
                  ? 'warning'
                  : 'destructive'
              }
            >
              {order.payment_status === 'paid' && t('💵 Payment Completed', '💵 ගෙවීම සම්පූර්ණයි')}
              {order.payment_status === 'partially_paid' && t('⚖️ Partially Paid', '⚖️ අර්ධ වශයෙන් ගෙවා ඇත')}
              {order.payment_status === 'unpaid' && t('🔴 Unpaid', '🔴 නොගෙවූ')}
              {!['paid', 'partially_paid', 'unpaid'].includes(order.payment_status) &&
                order.payment_status.toUpperCase()}
            </Badge>
          </div>

          <div className="space-y-2 text-xs text-zinc-700 font-bold">
            <div className="flex justify-between">
              <span>{t('Payment Method:', 'ගෙවීම් ක්‍රමය:')}</span>
              <span>{getLocalizedPaymentMethodLabel(order.payment_method)}</span>
            </div>
            {typeof order.amount_paid_cents === 'number' && (
              <div className="flex justify-between text-emerald-700">
                <span>{t('Amount Paid:', 'ගෙවූ මුදල:')}</span>
                <span className="font-mono">{formatCurrency(order.amount_paid_cents, order.currency)}</span>
              </div>
            )}
            {typeof order.balance_due_cents === 'number' && order.balance_due_cents > 0 && (
              <div className="flex justify-between text-rose-700">
                <span>{t('Balance Due:', 'ඉතිරි මුදල:')}</span>
                <span className="font-mono font-extrabold">{formatCurrency(order.balance_due_cents, order.currency)}</span>
              </div>
            )}
            {order.payment_status === 'paid' ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center text-xs font-black text-emerald-800">
                {t('✅ Payment Completed. Thank you!', '✅ ගෙවීම සම්පූර්ණයි. ස්තූතියි!')}
              </div>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-xs font-bold text-amber-900">
                {t('Please settle payment at the cashier counter.', 'කරුණාකර කැෂියර් වෙත ගෙවීම සිදු කරන්න.')}
              </div>
            )}
          </div>
        </div>

        {/* Optional Account Upgrade Banner / Card */}
        <SaveOrderButton
          orderId={order.id}
          accessToken={accessToken || order.access_token}
          customerUserId={order.customer_user_id}
          currentUserId={currentUserId}
        />

        {/* Return to Menu Button */}
        <div className="space-y-3">
          <Link href={`/m/${token}`}>
            <Button className="w-full text-xs font-bold py-3 min-h-[44px]">
              {t('← Back to Digital Menu', '← නැවත මෙනුවට')}
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
};
