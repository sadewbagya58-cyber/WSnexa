'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { PrintableReceipt } from './printable-receipt';
import { getOrderReceiptAction } from '@/server/actions/payment';
import { ReceiptData } from '@/server/services/payment.service';

interface ReceiptModalProps {
  orderId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ orderId, isOpen, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  useEffect(() => {
    if (!isOpen || !orderId) return;

    let mounted = true;

    getOrderReceiptAction(orderId).then((res) => {
      if (!mounted) return;
      setLoading(false);
      if (res.success && res.data) {
        setReceiptData(res.data);
      } else {
        setError(res.message || 'Failed to load receipt data');
      }
    });

    return () => {
      mounted = false;
    };
  }, [isOpen, orderId]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200 space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <div>
            <h2 className="text-lg font-bold text-zinc-950">Receipt Preview</h2>
            <p className="text-xs text-zinc-500">Official bill receipt for printing</p>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            ✕
          </Button>
        </div>

        {/* Receipt Content Body */}
        <div className="flex-1 overflow-y-auto border border-zinc-200 rounded-xl p-2 bg-zinc-50">
          {loading && (
            <div className="py-12 text-center text-xs font-bold text-zinc-500">
              Loading receipt data...
            </div>
          )}

          {error && (
            <div className="py-8 text-center text-xs font-semibold text-red-600 space-y-2">
              <p>⚠️ {error}</p>
            </div>
          )}

          {!loading && !error && receiptData && <PrintableReceipt data={receiptData} />}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2 border-t border-zinc-100">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Close
          </Button>
          <Button
            type="button"
            className="flex-1 font-bold bg-zinc-950 hover:bg-zinc-800 text-white"
            onClick={handlePrint}
            disabled={loading || !receiptData}
          >
            🖨️ Print Receipt
          </Button>
        </div>
      </div>
    </div>
  );
};
