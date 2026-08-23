'use client';

import React, { useState, useCallback, useId } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { OrderPaymentCard } from './order-payment-card';
import { PaymentSettlementModal } from './payment-settlement-modal';
import { ReceiptModal } from './receipt-modal';
import { CashierOrderRecord } from '@/server/services/payment.service';
import { acknowledgeBillRequestAction } from '@/server/actions/payment';
import { useCashierRealtime } from '@/hooks/use-cashier-realtime';
import { ContextualHelpButton } from '@/components/help/contextual-help-button';

interface CashierDashboardProps {
  branchId: string;
  branchName: string;
  businessName: string;
  initialOrders: CashierOrderRecord[];
  canRecordPayments?: boolean;
}

type TabFilter = 'all' | 'unpaid' | 'partially_paid' | 'paid' | 'completed' | 'cancelled';

export const CashierDashboard: React.FC<CashierDashboardProps> = ({
  branchId,
  branchName,
  businessName,
  initialOrders,
  canRecordPayments = true,
}) => {
  const [orders, setOrders] = useState<CashierOrderRecord[]>(initialOrders);
  const [activeTab, setActiveTab] = useState<TabFilter>('unpaid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('wsnexa_cashier_sound') === 'enabled';
  });

  // Settlement & Receipt Modal state
  const [selectedSettlementOrder, setSelectedSettlementOrder] = useState<CashierOrderRecord | null>(null);
  const [receiptOrderId, setReceiptOrderId] = useState<string | null>(null);

  const searchInputId = useId();
  const sortSelectId = useId();

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('wsnexa_cashier_sound', next ? 'enabled' : 'disabled');
    }
  };

  const playChime = useCallback(() => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      osc.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.15); // E6 note
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch {
      // Audio playback blocked
    }
  }, [soundEnabled]);

  const refreshCashierData = useCallback(async () => {
    try {
      const res = await fetch(`/api/cashier/orders?branchId=${branchId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.orders) {
          setOrders(data.orders);
        }
      }
    } catch {
      // Background fetch error ignored
    }
  }, [branchId]);

  const handleNewBillRequest = useCallback(
    () => {
      playChime();
      refreshCashierData();
    },
    [playChime, refreshCashierData]
  );

  // Subscribe to Realtime Cashier Updates
  useCashierRealtime(branchId, refreshCashierData, handleNewBillRequest);

  const handleAcknowledgeBill = async (requestId: string) => {
    await acknowledgeBillRequestAction(requestId);
    refreshCashierData();
  };

  // Filter & Search Logic
  const filteredOrders = orders
    .filter((order) => {
      // Tab Filter
      if (activeTab === 'unpaid' && order.payment_status !== 'unpaid') return false;
      if (activeTab === 'partially_paid' && order.payment_status !== 'partially_paid') return false;
      if (activeTab === 'paid' && order.payment_status !== 'paid') return false;
      if (activeTab === 'completed' && order.status !== 'completed') return false;
      if (activeTab === 'cancelled' && order.status !== 'cancelled') return false;

      // Search Query
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        const matchesNum = order.order_number_formatted.toLowerCase().includes(q);
        const matchesTable = order.table?.name.toLowerCase().includes(q) || order.table?.code.toLowerCase().includes(q);
        const matchesGuest = order.guest_name?.toLowerCase().includes(q);
        return Boolean(matchesNum || matchesTable || matchesGuest);
      }

      return true;
    })
    .sort((a, b) => {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });

  // Tab Counters
  const countUnpaid = orders.filter((o) => o.payment_status === 'unpaid').length;
  const countPartial = orders.filter((o) => o.payment_status === 'partially_paid').length;
  const countPaid = orders.filter((o) => o.payment_status === 'paid').length;
  const countBillReq = orders.filter((o) => o.bill_requested).length;

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            {businessName} • Cashier POS Terminal
          </span>
          <h1 className="text-2xl font-black text-zinc-950 flex items-center gap-3">
            {branchName}
            {countBillReq > 0 && (
              <Badge variant="warning" className="animate-pulse font-bold">
                🔔 {countBillReq} Bill Request(s)
              </Badge>
            )}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Contextual Help */}
          <ContextualHelpButton explicitSlug="cashier-pos-dashboard-overview" />

          {/* Sound Toggle */}
          <Button
            variant="outline"
            size="sm"
            className="text-xs font-bold"
            onClick={toggleSound}
          >
            {soundEnabled ? '🔔 Sound ON' : '🔕 Sound Muted'}
          </Button>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            className="text-xs font-bold"
            onClick={refreshCashierData}
          >
            🔄 Refresh
          </Button>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-zinc-100">
        {[
          { id: 'unpaid', label: `🔴 Unpaid (${countUnpaid})` },
          { id: 'partially_paid', label: `⚖️ Partially Paid (${countPartial})` },
          { id: 'paid', label: `💵 Paid (${countPaid})` },
          { id: 'completed', label: '✅ Completed' },
          { id: 'cancelled', label: '❌ Cancelled' },
          { id: 'all', label: `All Orders (${orders.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as TabFilter)}
            className={`shrink-0 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === tab.id
                ? 'bg-zinc-950 text-white shadow-xs'
                : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search & Sorting Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-50 p-3 rounded-2xl border border-zinc-200">
        <div className="w-full sm:w-72">
          <label htmlFor={searchInputId} className="sr-only">Search Orders</label>
          <input
            id={searchInputId}
            type="text"
            placeholder="Search Order #, Table, or Guest..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-xs text-zinc-950 bg-white focus:border-zinc-950 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label htmlFor={sortSelectId} className="text-xs font-bold text-zinc-600 shrink-0">Sort:</label>
          <select
            id={sortSelectId}
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
            className="rounded-xl border border-zinc-300 px-3 py-2 text-xs font-bold text-zinc-950 bg-white focus:border-zinc-950 focus:outline-none"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
      </div>

      {/* Orders Grid */}
      {filteredOrders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-2xl">
            💳
          </div>
          <h3 className="text-base font-bold text-zinc-950">No Orders Found</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            There are no orders matching your current status filter or search query.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.map((order) => (
            <OrderPaymentCard
              key={order.id}
              order={order}
              canRecordPayments={canRecordPayments}
              onSettlePayment={(o) => setSelectedSettlementOrder(o)}
              onPrintReceipt={(id) => setReceiptOrderId(id)}
              onAcknowledgeBill={handleAcknowledgeBill}
            />
          ))}
        </div>
      )}

      {/* Payment Settlement Dialog Modal */}
      {selectedSettlementOrder && (
        <PaymentSettlementModal
          order={selectedSettlementOrder}
          isOpen={Boolean(selectedSettlementOrder)}
          onClose={() => setSelectedSettlementOrder(null)}
          onSuccess={refreshCashierData}
        />
      )}

      {/* Receipt Preview Modal */}
      {receiptOrderId && (
        <ReceiptModal
          orderId={receiptOrderId}
          isOpen={Boolean(receiptOrderId)}
          onClose={() => setReceiptOrderId(null)}
        />
      )}
    </div>
  );
};
