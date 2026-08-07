'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { claimOrderAction, storeClaimIntentAction } from '@/server/actions/customer-order';

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
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ success: boolean; text: string } | null>(null);

  // 1. If already claimed by current logged-in user
  if (customerUserId && currentUserId && customerUserId === currentUserId) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-black text-emerald-900">
            <span>✅</span>
            <span>Saved to My Account</span>
          </div>
          <Link
            href={`/customer/orders/${orderId}`}
            className="px-3 py-1.5 rounded-xl bg-emerald-900 text-white font-extrabold text-xs hover:bg-emerald-800 transition-colors"
          >
            View Receipt →
          </Link>
        </div>
        <p className="text-[11px] text-emerald-700 font-medium leading-relaxed">
          This order is saved under your customer account history.
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
        text: res.message || 'Order saved to your account!',
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
          <h4 className="text-xs font-extrabold text-zinc-950">Save your order history</h4>
          <p className="text-[11px] text-zinc-600 leading-relaxed font-medium">
            Save this order to your WSNexa account to view it later, keep digital receipts, and track your spending.
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
            View in Account →
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
            ? 'Saving Order...'
            : currentUserId
            ? '✨ Save Order'
            : '✨ Save to My Account'}
        </Button>
      )}
    </div>
  );
}
