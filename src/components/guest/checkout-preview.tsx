'use client';

import React, { useState, useId } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCart } from '@/features/cart/cart-context';
import { formatCurrency, calculateRewardDiscountCents } from '@/features/cart/cart-calculations';
import { isTableAccessVerified } from '@/features/cart/cart-types';
import { saveActiveOrderToStorage } from '@/features/cart/active-order-storage';
import { submitGuestOrderAction, generateLocationProofAction } from '@/server/actions/order';
import { IS_LOYALTY_ENABLED } from '@/lib/config/features';

import { BranchPaymentMethod, BranchOrderSecuritySettings } from '@/types/database.types';
import { TablePickerGrid, TableItem, ServiceAreaItem } from '@/components/qr/table-picker-grid';
import { useGuestLanguage, GuestLanguageToggle } from '@/features/qr/guest-language-context';

interface CheckoutPreviewProps {
  token: string;
  branchName: string;
  businessName: string;
  branchId?: string;
  diningTables?: TableItem[];
  serviceAreas?: ServiceAreaItem[];
  serviceAreaId?: string | null;
  serviceAreaName?: string | null;
  requireTableSelection?: boolean;
  requireTablePin?: boolean;
  tablePinLength?: number;
  enabledPaymentMethods?: BranchPaymentMethod[];
  securitySettings?: BranchOrderSecuritySettings | null;
  isLoggedIn?: boolean;
}

const PAYMENT_METHOD_MAP: Record<string, { icon: string; title: string; description: string; enumValue: 'pay_at_counter' | 'cash' | 'card' | 'qr_pay' | 'online' }> = {
  pay_at_counter: {
    icon: '🏪',
    title: 'Pay at Counter',
    description: 'Pay at the main cashier counter when ready.',
    enumValue: 'pay_at_counter',
  },
  cash: {
    icon: '💵',
    title: 'Cash',
    description: 'Pay cash to cashier or waiter upon delivery.',
    enumValue: 'cash',
  },
  card: {
    icon: '💳',
    title: 'Card at Venue',
    description: 'Pay via venue card terminal.',
    enumValue: 'card',
  },
  qr_payment: {
    icon: '📱',
    title: 'Venue QR Pay',
    description: 'Scan venue mobile banking QR at counter.',
    enumValue: 'qr_pay',
  },
  online_payment: {
    icon: '🌐',
    title: 'Pay Online Now',
    description: 'Pay securely online.',
    enumValue: 'online',
  },
};

export const CheckoutPreview: React.FC<CheckoutPreviewProps> = ({
  token,
  branchName,
  businessName,
  branchId,
  diningTables = [],
  serviceAreas = [],
  serviceAreaId,
  serviceAreaName,
  requireTableSelection = false,
  requireTablePin = false,
  tablePinLength = 4,
  enabledPaymentMethods,
  securitySettings,
  isLoggedIn = false,
}) => {
  const router = useRouter();
  const { t } = useGuestLanguage();
  const { state, clearCart, setConfirmedTable } = useCart();
  const [showCheckoutTablePicker, setShowCheckoutTablePicker] = useState(false);

  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestNotes, setGuestNotes] = useState('');

  const activeMethods = React.useMemo(() => {
    if (enabledPaymentMethods && enabledPaymentMethods.length > 0) {
      return enabledPaymentMethods;
    }
    return [
      { method: 'pay_at_counter', display_name: 'Pay at Counter', instructions: '', is_enabled: true, sort_order: 1 },
      { method: 'cash', display_name: 'Cash', instructions: '', is_enabled: true, sort_order: 2 },
      { method: 'card', display_name: 'Card at Venue', instructions: '', is_enabled: true, sort_order: 3 },
    ] as BranchPaymentMethod[];
  }, [enabledPaymentMethods]);

  const [paymentMethod, setPaymentMethod] = useState<
    'pay_at_counter' | 'cash' | 'card' | 'qr_pay' | 'online'
  >(() => {
    const first = activeMethods[0]?.method;
    return PAYMENT_METHOD_MAP[first]?.enumValue || 'pay_at_counter';
  });

  const [locationState, setLocationState] = useState<{
    status: 'idle' | 'loading' | 'success' | 'error';
    coords?: { latitude: number; longitude: number; accuracy?: number };
    proof?: string;
    errorMessage?: string;
  }>({ status: 'idle' });

  const [inputPin, setInputPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const getLocalizedPaymentMethod = (methodKey: string, customTitle?: string | null, customDesc?: string | null) => {
    const isDefaultTitle = !customTitle || ['Pay at Counter', 'Cash', 'Card at Venue', 'Venue QR Pay', 'Pay Online Now'].includes(customTitle);
    switch (methodKey) {
      case 'pay_at_counter':
        return {
          icon: '🏪',
          title: isDefaultTitle ? t('Pay at Counter', 'Counter එකෙන් ගෙවන්න') : customTitle,
          description: customDesc || t('Pay at the main cashier counter when ready.', 'Order එක ready වූ පසු කැෂියර් වෙත මුදල් ගෙවන්න.'),
          enumValue: 'pay_at_counter' as const,
        };
      case 'cash':
        return {
          icon: '💵',
          title: isDefaultTitle ? t('Cash', 'මුදලින් (Cash)') : customTitle,
          description: customDesc || t('Pay cash to cashier or waiter upon delivery.', 'ආහාර ලැබුණු පසු Waiter හෝ Cashier වෙත මුදල් ගෙවන්න.'),
          enumValue: 'cash' as const,
        };
      case 'card':
        return {
          icon: '💳',
          title: isDefaultTitle ? t('Card at Venue', 'Card මඟින් (Venue)') : customTitle,
          description: customDesc || t('Pay via venue card terminal.', 'ආපනශාලාවේ Card terminal එක මඟින් ගෙවන්න.'),
          enumValue: 'card' as const,
        };
      case 'qr_payment':
        return {
          icon: '📱',
          title: isDefaultTitle ? t('Venue QR Pay', 'Venue QR Pay') : customTitle,
          description: customDesc || t('Scan venue mobile banking QR at counter.', 'කැෂියර් වෙත ඇති Banking QR එක ස්කෑන් කර ගෙවන්න.'),
          enumValue: 'qr_pay' as const,
        };
      case 'online_payment':
        return {
          icon: '🌐',
          title: isDefaultTitle ? t('Pay Online Now', 'Online ගෙවන්න') : customTitle,
          description: customDesc || t('Pay securely online.', 'කාඩ්පත මඟින් ආරක්ෂිතව Online ගෙවන්න.'),
          enumValue: 'online' as const,
        };
      default:
        return {
          icon: '💳',
          title: customTitle || methodKey,
          description: customDesc || t('Pay at venue', 'ආපනශාලාවට ගෙවන්න'),
          enumValue: 'pay_at_counter' as const,
        };
    }
  };

  const handleVerifyLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setLocationState({
        status: 'error',
        errorMessage: t('Geolocation is not supported by your mobile browser.', 'ඔබගේ බ්‍රව්සරය මඟින් Geolocation සඳහා සහය නොදක්වයි.'),
      });
      return;
    }

    setLocationState({ status: 'loading' });

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const accuracy = pos.coords.accuracy;
        if (accuracy > 500) {
          setLocationState({
            status: 'error',
            errorMessage: t('Your location is not accurate enough. Move closer to an open area and try again.', 'ස්ථානයේ නිරවද්‍යතාවය ප්‍රමාණවත් නොවේ. නැවත උත්සාහ කරන්න.'),
          });
          return;
        }

        const proofRes = await generateLocationProofAction(
          state.branchId,
          pos.coords.latitude,
          pos.coords.longitude,
          state.confirmedTable?.tableId
        );

        if (!proofRes.success || !proofRes.data?.proof) {
          setLocationState({
            status: 'error',
            errorMessage: proofRes.message || t('Device location verification failed.', 'ස්ථානය තහවුරු කිරීම අසාර්ථක විය.'),
          });
          return;
        }

        setLocationState({
          status: 'success',
          coords: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          },
          proof: proofRes.data.proof,
        });
      },
      (err) => {
        let msg = t('We could not determine your location.', 'ඔබ සිටින ස්ථානය තීරණය කිරීමට නොහැකි විය.');
        if (err.code === err.PERMISSION_DENIED) {
          msg = t('Location permission is required by this venue to place an order.', 'ඇණවුමක් තැබීමට මෙම ආපනශාලාවට ඔබ සිටින ස්ථානය තහවුරු කිරීම අවශ්‍ය වේ.');
        } else if (err.code === err.TIMEOUT) {
          msg = t('Location check took too long. Try again.', 'ස්ථානය පරීක්ෂා කිරීමට ගතවූ කාලය වැඩිය. නැවත උත්සාහ කරන්න.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = t('Location information is currently unavailable.', 'ස්ථාන තොරතුරු ලබා ගැනීමට නොහැක.');
        }
        setLocationState({ status: 'error', errorMessage: msg });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  const guestNameId = useId();
  const guestPhoneId = useId();
  const guestNotesId = useId();
  const inputPinId = useId();

  const getOrCreateIdempotencyKey = (): string => {
    if (typeof window === 'undefined') return `idemp_${Date.now()}`;
    let key = sessionStorage.getItem(`wsnexa_checkout_key_${state.branchId}`);
    if (!key) {
      key = `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      sessionStorage.setItem(`wsnexa_checkout_key_${state.branchId}`, key);
    }
    return key;
  };

  if (!state.isHydrated) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <div className="text-sm font-bold text-zinc-500">{t('Loading guest checkout...', 'Checkout එක සූදානම් වෙමින් පවතී...')}</div>
      </div>
    );
  }

  // Redirect to menu if cart is empty
  if (state.lines.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4 antialiased">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg border border-zinc-200 space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-3xl">
            🛒
          </div>
          <h1 className="text-xl font-bold text-zinc-950">{t('Your Cart is Empty', 'ඔබගේ Cart එක හිස්ව ඇත')}</h1>
          <p className="text-xs text-zinc-600 leading-relaxed">
            {t(
              'Please add items from the digital menu before proceeding to checkout.',
              'Checkout කිරීමට පෙර මෙනුවෙන් අයිතම එකතු කරන්න.'
            )}
          </p>
          <Link href={`/m/${token}`}>
            <Button className="w-full text-xs font-bold mt-2">{t('← Back to Menu', '← නැවත මෙනුවට')}</Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleOrderSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (requireTableSelection && !isTableAccessVerified(state.confirmedTable)) {
      setErrorMessage(
        t(
          'Please select your table above before submitting your order.',
          'කරුණාකර ඇණවුම තහවුරු කිරීමට පෙර ඔබගේ මේසය තෝරන්න.'
        )
      );
      setIsSubmitting(false);
      setShowCheckoutTablePicker(true);
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const cartItemsPayload = state.lines.map((line) => ({
        menuItemId: line.menuItemId,
        quantity: line.quantity,
        specialInstructions: line.specialInstructions || null,
        selectedModifiers: line.selectedModifiers.map((mod) => ({
          groupId: mod.groupId,
          optionId: mod.optionId,
        })),
      }));

      const res = await submitGuestOrderAction({
        rawQrToken: token,
        qrVisitSessionToken: state.qrVisitSessionToken || null,
        tableId: state.confirmedTable?.tableId || null,
        inputPin: inputPin.trim() || null,
        signedTableAccessProof: state.confirmedTable?.signedTableAccessProof || null,
        guestName: guestName.trim() || null,
        guestPhone: guestPhone.trim() || null,
        guestNotes: guestNotes.trim() || null,
        paymentMethod,
        idempotencyKey: getOrCreateIdempotencyKey(),
        cartItems: cartItemsPayload,
        selectedRewardId: IS_LOYALTY_ENABLED ? (state.selectedReward?.id || null) : null,
        userCoordinates: locationState.coords
          ? {
              latitude: locationState.coords.latitude,
              longitude: locationState.coords.longitude,
              accuracy: locationState.coords.accuracy,
            }
          : null,
        locationProof: locationState.proof || null,
      });

      if (!res.success || !res.data) {
        setErrorMessage(res.message || t('Failed to submit order. Please try again.', 'ඇණවුම ඉදිරිපත් කිරීමට නොහැකි විය. කරුණාකර නැවත උත්සාහ කරන්න.'));
        setIsSubmitting(false);
        return;
      }

      // Clear idempotency key from session storage so subsequent orders use a new key
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(`wsnexa_checkout_key_${state.branchId}`);
      }

      // Save safe active order metadata to sessionStorage for recovery
      saveActiveOrderToStorage({
        orderId: res.data.orderId,
        orderNumberFormatted: res.data.orderNumberFormatted,
        branchId: state.branchId,
        tableId: state.confirmedTable?.tableId || null,
        tableName: state.confirmedTable?.tableName || null,
        createdAt: new Date().toISOString(),
        latestStatus: res.data.status,
        accessToken: res.data.accessToken,
      });

      // Clear local cart state
      clearCart();

      // Redirect to confirmation status page with access_token security parameter
      router.push(`/m/${token}/order/${res.data.orderId}?access_token=${res.data.accessToken}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('An unexpected error occurred.', 'බලාපොරොත්තු නොවූ දෝෂයක් සිදු විය.');
      setErrorMessage(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 font-sans antialiased text-zinc-900 pb-16">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-zinc-200 px-4 py-3 shadow-xs">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/m/${token}`}
              className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
            >
              ←
            </Link>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                {businessName}
              </span>
              <h1 className="text-base font-black tracking-tight text-zinc-950">
                {t('Checkout & Place Order', 'Checkout එක සහ Order එක Place කරන්න')}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <GuestLanguageToggle />
            <Badge variant="neutral">
              {state.totalQuantity} {state.totalQuantity === 1 ? t('item', 'අයිතමය') : t('items', 'අයිතම')}
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-6">
        {/* Error Alert */}
        {errorMessage && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-900 shadow-2xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-red-950">
              <span>⚠️</span>
              <span>{t('Order Submission Failed', 'ඇණවුම ඉදිරිපත් කිරීම අසාර්ථක විය')}</span>
            </div>
            <p className="leading-relaxed text-red-800">{errorMessage}</p>

            {(errorMessage.includes('expired') || errorMessage.includes('tampered') || errorMessage.includes('PIN')) && (
              <div className="pt-2">
                <Link href={`/m/${token}`}>
                  <Button variant="outline" size="sm" className="text-xs font-bold bg-white text-zinc-950 border-red-300">
                    {t('Verify Table Again →', 'නැවත මේසය තහවුරු කරන්න →')}
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Dining Table Context */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              {t('Dining Context', 'ආපනශාලා තොරතුරු')}
            </span>
            {diningTables.length > 0 && (
              <button
                type="button"
                onClick={() => setShowCheckoutTablePicker((prev) => !prev)}
                className="text-xs font-bold text-amber-800 hover:text-amber-900 underline cursor-pointer"
              >
                {isTableAccessVerified(state.confirmedTable)
                  ? (showCheckoutTablePicker ? t('Hide Table Picker', 'Table Picker සඟවන්න') : t('Change Table', 'මේසය මාරු කරන්න'))
                  : t('Select Table', 'මේසය තෝරන්න')}
              </button>
            )}
          </div>
          <div className="flex items-center justify-between text-sm font-bold text-zinc-950">
            <span>{t('Branch Location:', 'ශාඛාව:')}</span>
            <span className="font-semibold">{branchName}</span>
          </div>
          <div className="flex items-center justify-between text-sm font-bold text-zinc-950">
            <span>{t('Table Status:', 'මේසයේ තත්ත්වය:')}</span>
            {isTableAccessVerified(state.confirmedTable) ? (
              <Badge variant="success">
                ✓ {state.confirmedTable?.serviceAreaName ? `${state.confirmedTable.serviceAreaName} · ` : ''}{state.confirmedTable!.tableName}
              </Badge>
            ) : (
              <Badge variant="warning">{t('No Table Selected', 'මේසයක් තෝරා නැත')}</Badge>
            )}
          </div>

          {/* Fail-safe Table Picker directly on checkout */}
          {diningTables.length > 0 && (!isTableAccessVerified(state.confirmedTable) || showCheckoutTablePicker) && (
            <div className="pt-3 border-t border-zinc-100">
              {!isTableAccessVerified(state.confirmedTable) && (
                <div className="mb-3 rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-900 flex items-start gap-2">
                  <span className="text-base leading-none mt-0.5">⚠️</span>
                  <div>
                    <p className="font-bold">
                      {t('Please select your table below before placing your order.', 'ඇණවුම තහවුරු කිරීමට පෙර ඔබේ මේසය තෝරන්න')}
                    </p>
                    <p className="text-[11px] text-amber-800">
                      {t(
                        'Table selection is required for order delivery.',
                        'ඔබේ ඇණවුම නිවැරදි මේසයට ලබා දීමට මේසය තෝරා ගැනීම අවශ්‍යයි.'
                      )}
                    </p>
                  </div>
                </div>
              )}
              <TablePickerGrid
                branchId={branchId || state.branchId}
                serviceAreaId={serviceAreaId || state.confirmedTable?.serviceAreaId || null}
                serviceAreaName={serviceAreaName || state.confirmedTable?.serviceAreaName || null}
                diningTables={diningTables}
                serviceAreas={serviceAreas}
                requireTablePin={requireTablePin}
                tablePinLength={tablePinLength}
                currentTableId={state.confirmedTable?.tableId}
                qrVisitSessionToken={state.qrVisitSessionToken}
                isInline={true}
                compact={true}
                title={t('Select Your Table', 'ඔබගේ මේසය තෝරන්න')}
                subtitle={t('Select the table number printed on your table', 'ඔබේ මේසයේ ඇති අංකය තෝරන්න')}
                onTableConfirmed={(confirmed) => {
                  setConfirmedTable(confirmed);
                  setShowCheckoutTablePicker(false);
                  setErrorMessage(null);
                }}
                onCancel={isTableAccessVerified(state.confirmedTable) ? () => setShowCheckoutTablePicker(false) : undefined}
              />
            </div>
          )}
        </div>

        {/* Guest Details Form */}
        <form onSubmit={handleOrderSubmission} className="space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs space-y-4">
            <div className="border-b border-zinc-100 pb-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-extrabold text-zinc-950">
                  {t('Guest Details', 'ඔබගේ තොරතුරු (Guest Details)')}
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-600 border border-zinc-200">
                  {t('Optional', 'විකල්පයි')}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                {t(
                  'Optional — you can skip this section and place your order directly.',
                  'විකල්පයි — ඔබට මෙය මඟහැර කෙලින්ම ඇණවුම ලබා දිය හැක.'
                )}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor={guestNameId} className="block text-xs font-bold text-zinc-700 mb-1">
                  {t('Your Name', 'ඔබගේ නම')}{' '}
                  <span className="text-[11px] font-normal text-zinc-400">({t('Optional', 'විකල්පයි')})</span>
                </label>
                <input
                  id={guestNameId}
                  type="text"
                  placeholder={t('e.g. John Doe (Optional)', 'උදා: කමල් පෙරේරා (විකල්පයි)')}
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-xs text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-950 focus:outline-none"
                  maxLength={100}
                />
              </div>

              <div>
                <label htmlFor={guestPhoneId} className="block text-xs font-bold text-zinc-700 mb-1">
                  {t('Phone Number', 'දුරකථන අංකය')}{' '}
                  <span className="text-[11px] font-normal text-zinc-400">({t('Optional', 'විකල්පයි')})</span>
                </label>
                <input
                  id={guestPhoneId}
                  type="tel"
                  placeholder={t('e.g. +94 77 123 4567 (Optional)', 'උදා: 077 123 4567 (විකල්පයි)')}
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-xs text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-950 focus:outline-none"
                  maxLength={30}
                />
              </div>

              <div>
                <label htmlFor={guestNotesId} className="block text-xs font-bold text-zinc-700 mb-1">
                  {t('Order / Preparation Notes', 'විශේෂ සටහන්')}{' '}
                  <span className="text-[11px] font-normal text-zinc-400">({t('Optional', 'විකල්පයි')})</span>
                </label>
                <textarea
                  id={guestNotesId}
                  placeholder={t('e.g. Extra spicy, no cutlery needed... (Optional)', 'උදා: සැර අඩුවෙන්, සීනි නැතිව... (විකල්පයි)')}
                  value={guestNotes}
                  onChange={(e) => setGuestNotes(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 px-3.5 py-2 text-xs text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-950 focus:outline-none h-20 resize-none"
                  maxLength={500}
                />
              </div>

              {/* Table PIN input if required but not previously verified */}
              {!state.confirmedTable && (
                <div>
                  <label htmlFor={inputPinId} className="block text-xs font-bold text-zinc-700 mb-1">
                    {t('Table PIN (If required by branch)', 'මේසයේ PIN අංකය (අවශ්‍ය නම්)')}
                  </label>
                  <input
                    id={inputPinId}
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder={t('Enter 4-digit table PIN', 'ඉලක්කම් 4ක PIN අංකය ඇතුළත් කරන්න')}
                    value={inputPin}
                    onChange={(e) => setInputPin(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-xs font-mono text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-950 focus:outline-none tracking-widest"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Customer Account Sign-In Card if required by venue security */}
          {securitySettings?.require_customer_account && !isLoggedIn && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-2xs space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔐</span>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-amber-950">
                    {t('Sign-in Required by Venue', 'ගිණුමකට ඇතුළු වීම අවශ්‍යයි')}
                  </h3>
                  <p className="text-[11px] text-amber-800 mt-0.5 font-medium leading-relaxed">
                    {t(
                      'This venue requires a customer account before placing an order. Sign in to continue.',
                      'මෙම ආපනශාලාවේ ඇණවුමක් තැබීමට පාරිභෝගික ගිණුමක් අවශ්‍ය වේ. ඉදිරියට යාමට Sign in වන්න.'
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Link
                  href={`/login?redirectTo=${encodeURIComponent(`/m/${token}/checkout`)}`}
                  className="w-1/2 text-center text-xs font-extrabold py-3 rounded-xl bg-amber-900 hover:bg-amber-950 text-white shadow-xs"
                >
                  {t('Sign In to Order', 'Sign In වී ඇණවුම් කරන්න')}
                </Link>
                <Link
                  href={`/register?redirectTo=${encodeURIComponent(`/m/${token}/checkout`)}`}
                  className="w-1/2 text-center text-xs font-extrabold py-3 rounded-xl bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 shadow-xs"
                >
                  {t('Create Account', 'නව ගිණුමක් සාදන්න')}
                </Link>
              </div>
            </div>
          )}

          {/* Geolocation Verification Card if required by venue security */}
          {securitySettings?.require_location_verification && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-5 shadow-2xs space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">📍</span>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-blue-950">
                    {t('Location Verification Required', 'ස්ථානය තහවුරු කිරීම අවශ්‍යයි')}
                  </h3>
                  <p className="text-[11px] text-blue-800 mt-0.5">
                    {t(
                      'This venue requires device location verification to ensure you are physically present at the venue.',
                      'ඔබ ආපනශාලාවේ සිටින බව තහවුරු කර ගැනීම සඳහා ඔබගේ ස්ථානය (Location) පරීක්ෂා කිරීම අවශ්‍ය වේ.'
                    )}
                  </p>
                </div>
              </div>

              {locationState.status === 'success' ? (
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-100 p-3 rounded-xl border border-emerald-300">
                  <span>✅</span>
                  <span>{t('Location Verified Successfully', 'ස්ථානය සාර්ථකව තහවුරු විය')}</span>
                </div>
              ) : (
                <Button
                  type="button"
                  onClick={handleVerifyLocation}
                  disabled={locationState.status === 'loading'}
                  className="w-full text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white min-h-[44px]"
                >
                  {locationState.status === 'loading'
                    ? t('Verifying Device Location...', 'ස්ථානය පරීක්ෂා කරමින්...')
                    : t('📍 Verify My Location', '📍 මගේ ස්ථානය තහවුරු කරන්න')}
                </Button>
              )}

              {locationState.errorMessage && (
                <div className="p-3 rounded-xl bg-amber-100 border border-amber-300 text-amber-950 text-xs font-medium space-y-1">
                  <div className="font-bold">{t('⚠️ Location Check Notice', '⚠️ ස්ථාන පරීක්ෂා කිරීමේ දැනුම්දීම')}</div>
                  <p>{locationState.errorMessage}</p>
                </div>
              )}
            </div>
          )}

          {/* Payment Method Selection Card */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs space-y-4">
            <div>
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-zinc-500">
                {t('Payment Method', 'ගෙවීම් ක්‍රමය')}
              </h2>
              <p className="text-xs text-zinc-600 mt-0.5">
                {t(
                  'Select your preferred payment method enabled by this venue',
                  'මෙම ආපනශාලාව විසින් සපයා ඇති ගෙවීම් ක්‍රම වලින් ඔබ කැමති ක්‍රමය තෝරන්න'
                )}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {activeMethods.map((m) => {
                const info = getLocalizedPaymentMethod(m.method, m.display_name, m.instructions);

                const isSelected = paymentMethod === info.enumValue;

                return (
                  <button
                    key={m.method}
                    type="button"
                    onClick={() => setPaymentMethod(info.enumValue)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between touch-manipulation ${
                      isSelected
                        ? 'border-zinc-950 bg-zinc-950 text-white shadow-sm ring-1 ring-zinc-950'
                        : 'border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300 hover:bg-zinc-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl shrink-0">{info.icon}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold">{info.title}</span>
                        </div>
                        <p
                          className={`text-[11px] mt-0.5 ${
                            isSelected ? 'text-zinc-300' : 'text-zinc-500'
                          }`}
                        >
                          {info.description}
                        </p>
                      </div>
                    </div>

                    <div
                      className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'border-white bg-white'
                          : 'border-zinc-300 bg-transparent'
                      }`}
                    >
                      {isSelected && <div className="h-2 w-2 rounded-full bg-zinc-950" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Items Summary List */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs space-y-4">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-zinc-500 border-b border-zinc-100 pb-3">
              {t('Order Summary', 'ඇණවුම් සාරාංශය')}
            </h2>

            <div className="space-y-3 divide-y divide-zinc-100">
              {state.lines.map((line) => (
                <div key={line.lineId} className="pt-3 first:pt-0 flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 text-sm font-bold text-zinc-950">
                      <span className="font-mono text-zinc-500 text-xs">{line.quantity}x</span>
                      <span>{line.itemName}</span>
                    </div>

                    {line.selectedModifiers && line.selectedModifiers.length > 0 && (
                      <div className="pl-6 space-y-0.5 text-xs text-zinc-500">
                        {line.selectedModifiers.map((mod) => (
                          <div key={mod.optionId}>
                            • {mod.groupName}: {mod.optionName}
                          </div>
                        ))}
                      </div>
                    )}

                    {line.specialInstructions && (
                      <div className="pl-6 text-xs text-amber-900 italic">
                        📝 &quot;{line.specialInstructions}&quot;
                      </div>
                    )}
                  </div>

                  <div className="text-sm font-black text-zinc-950">
                    {formatCurrency(line.lineTotalCents, state.currency)}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-zinc-200 space-y-2">
              <div className="flex justify-between text-xs text-zinc-600">
                <span>{t('Subtotal', 'උප එකතුව')}</span>
                <span className="font-mono font-bold">{formatCurrency(state.subtotalCents, state.currency)}</span>
              </div>
              {IS_LOYALTY_ENABLED && state.selectedReward && (
                <>
                  <div className="flex justify-between text-xs text-emerald-600 font-bold">
                    <span>{t('Reward —', 'ප්‍රතිලාභය —')} {state.selectedReward.title}</span>
                    <span className="font-mono">
                      -{formatCurrency(
                        calculateRewardDiscountCents(state.selectedReward, state.subtotalCents, state.lines),
                        state.currency
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-amber-700 italic">
                    <span>{t('Points to redeem', 'භාවිතා කරන Points')}</span>
                    <span className="font-mono font-bold">{state.selectedReward.pointsRequired} pts</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-base font-black text-zinc-950 pt-2 border-t border-zinc-100">
                <span>{t('Total Amount', 'මුළු මුදල')}</span>
                <span>
                  {formatCurrency(
                    Math.max(
                      0,
                      state.subtotalCents -
                        (IS_LOYALTY_ENABLED && state.selectedReward
                          ? calculateRewardDiscountCents(state.selectedReward, state.subtotalCents, state.lines)
                          : 0)
                    ),
                    state.currency
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {(() => {
              const isTableGateBlocked = Boolean(requireTableSelection) && !isTableAccessVerified(state.confirmedTable);
              const isAccountGateBlocked = Boolean(securitySettings?.require_customer_account) && !isLoggedIn;
              const isLocationGateBlocked = Boolean(securitySettings?.require_location_verification) && locationState.status !== 'success';
              const isSubmitDisabled = isSubmitting || isTableGateBlocked || isAccountGateBlocked || isLocationGateBlocked;

              const effectiveDiscount = IS_LOYALTY_ENABLED && state.selectedReward
                ? calculateRewardDiscountCents(state.selectedReward, state.subtotalCents, state.lines)
                : 0;

              const totalFormatted = formatCurrency(
                Math.max(0, state.subtotalCents - effectiveDiscount),
                state.currency
              );

              let buttonText = `${t('Confirm & Submit Order', 'Order එක Place කරන්න')} (${totalFormatted})`;

              if (isSubmitting) buttonText = t('Placing Order...', 'ඇණවුම සකසමින් පවතී...');
              else if (isTableGateBlocked)
                buttonText = t('🪑 Select Table Above to Order', '🪑 මේසය තෝරන්න');
              else if (isAccountGateBlocked)
                buttonText = t('🔐 Sign in Required to Place Order', '🔐 ඇණවුම සඳහා Sign-in විය යුතුය');
              else if (isLocationGateBlocked)
                buttonText = t('📍 Verify Device Location First', '📍 පළමුව ඔබ සිටින ස්ථානය තහවුරු කරන්න');

              return (
                <Button
                  type="submit"
                  className={`w-full text-sm font-extrabold py-3.5 shadow-md ${
                    isSubmitDisabled
                      ? 'bg-zinc-300 text-zinc-600 cursor-not-allowed border-zinc-300 shadow-none'
                      : 'bg-zinc-950 hover:bg-zinc-800 text-white cursor-pointer'
                  }`}
                  disabled={isSubmitDisabled}
                >
                  {buttonText}
                </Button>
              );
            })()}

            <Link href={`/m/${token}`} className="block text-center">
              <span className="text-xs font-bold text-zinc-600 hover:text-zinc-950 underline">
                {t('← Return to Branch Menu', '← නැවත මෙනුවට')}
              </span>
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
};
