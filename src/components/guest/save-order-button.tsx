'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { claimOrderAction, storeClaimIntentAction } from '@/server/actions/customer-order';

interface SaveOrderButtonProps {
  orderId: string;
  accessToken: string;
}

export function SaveOrderButton({ orderId, accessToken }: SaveOrderButtonProps) {
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ success: boolean; text: string } | null>(null);

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
      // User is likely logged out; store intent and redirect to login
      await storeClaimIntentAction(orderId, accessToken, `/customer/orders/${orderId}`);
      window.location.href = `/login?next=/customer/orders/${orderId}`;
    }
    setLoading(false);
  };

  return (
    <div className="space-y-2">
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
          className="w-full text-xs font-bold border-amber-300 bg-white hover:bg-amber-50 text-amber-950 shadow-2xs"
        >
          {loading ? 'Saving Order...' : '✨ Save Order to My Account'}
        </Button>
      )}
    </div>
  );
}
