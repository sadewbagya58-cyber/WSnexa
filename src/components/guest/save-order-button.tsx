'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { claimOrderAction, storeClaimIntentAction } from '@/server/actions/customer-order';
import { useGuestLanguage } from '@/features/qr/guest-language-context';

interface SaveOrderButtonProps {
  orderId: string;
  accessToken: string;
  customerUserId?: string | null;
  currentUserId?: string | null;
}

export function SaveOrderButton({
  orderId,
  accessToken,
  customerUserId,
  currentUserId,
}: SaveOrderButtonProps) {
  const { t } = useGuestLanguage();
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ success: boolean; text: string } | null>(null);

  // 1. If already claimed by current logged-in user
  if (customerUserId && currentUserId && customerUserId === currentUserId) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-black text-emerald-900">
            <span>✅</span>
            <span>{t('Saved to My Account', 'ගිණුමේ සුරැකිණි')}</span>
          </div>
          <Link
            href={`/customer/orders/${orderId}`}
            className="px-3 py-1.5 rounded-xl bg-emerald-900 text-white font-extrabold text-xs hover:bg-emerald-800 transition-colors"
          >
            {t('View Receipt →', 'රිසිට්පත බලන්න →')}
          </Link>
        </div>
        <p className="text-[11px] text-emerald-700 font-medium leading-relaxed">
          {t('This order is saved under your customer account history.', 'මෙම ඇණවුම ඔබගේ පාරිභෝගික ගිණුමේ සුරකින ලදී.')}
        </p>
      </div>
    );
  }

  // 2. If claimed by another user, hide claim controls
  if (customerUserId && customerUserId !== currentUserId) {
    return null;
  }

  // 3. Handle save / claim click
  const handleSaveOrder = async () => {
    setLoading(true);
    setStatusMessage(null);

    const res = await claimOrderAction(orderId, accessToken);

    if (res.success) {
      setStatusMessage({
        success: true,
        text: res.message || t('Order saved to your account!', 'ඇණවුම ඔබගේ ගිණුමේ සුරකින ලදී!'),
      });
    } else {
      // User is logged out; store intent cookie and redirect to login
      await storeClaimIntentAction(orderId, accessToken, `/customer/orders/${orderId}`);
      window.location.href = `/login?next=/customer/orders/${orderId}`;
    }
    setLoading(false);
  };

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 shadow-2xs space-y-3">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-xl border border-amber-200">
          ⭐
        </span>
        <div className="space-y-0.5">
          <h4 className="text-xs font-extrabold text-zinc-950">{t('Save your order history', 'ඇණවුම් විස්තර සුරකින්න')}</h4>
          <p className="text-[11px] text-zinc-600 leading-relaxed font-medium">
            {t(
              'Save this order to your WSNexa account to view it later, keep digital receipts, and track your spending.',
              'පසුව බැලීමට සහ ඩිජිටල් රිසිට්පත් ලබා ගැනීමට මෙම ඇණවුම ඔබගේ WSNexa ගිණුමේ සුරකින්න.'
            )}
          </p>
        </div>
      </div>

      {statusMessage ? (
        <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-950 text-xs font-bold">
          <span>{statusMessage.text}</span>
          <Link
            href={`/customer/orders/${orderId}`}
            className="px-2.5 py-1 rounded-lg bg-emerald-950 text-white font-bold hover:bg-emerald-900 transition-colors"
          >
            {t('View in Account →', 'ගිණුමෙන් බලන්න →')}
          </Link>
        </div>
      ) : (
        <Button
          type="button"
          onClick={handleSaveOrder}
          disabled={loading}
          variant="outline"
          className="w-full text-xs font-extrabold border-amber-300 bg-white hover:bg-amber-100 text-amber-950 shadow-2xs py-2.5"
        >
          {loading
            ? t('Saving Order...', 'සුරකිමින්...')
            : currentUserId
            ? t('✨ Save Order', '✨ Order එක සුරකින්න')
            : t('✨ Save to My Account', '✨ ගිණුමේ සුරකින්න')}
        </Button>
      )}
    </div>
  );
}
