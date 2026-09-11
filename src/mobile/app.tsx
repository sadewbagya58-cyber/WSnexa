import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { StorageAdapter } from '../lib/offline/storage-adapter';
import { networkStatus } from '../lib/offline/network-status';
import { syncQueue } from '../lib/offline/sync-queue';
import { realtimeReconciliation } from '../lib/offline/realtime-reconciliation';
import { QueuedMutation, SyncEngineStats, NetworkState } from '../lib/offline/offline-types';

// Injected during build from environment
declare const __ENV__: {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  NEXT_PUBLIC_APP_URL: string;
};

const supabaseUrl = typeof __ENV__ !== 'undefined' ? __ENV__.NEXT_PUBLIC_SUPABASE_URL : '';
const supabaseAnonKey = typeof __ENV__ !== 'undefined' ? __ENV__.NEXT_PUBLIC_SUPABASE_ANON_KEY : '';

let supabase: SupabaseClient | null = null;
if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      storage: {
        getItem: (key) => StorageAdapter.getItem(key),
        setItem: (key, val) => StorageAdapter.setItem(key, val),
        removeItem: (key) => StorageAdapter.removeItem(key),
      },
    },
  });
}

interface TableState {
  id: string;
  name: string;
  table_number: number;
  status: 'available' | 'occupied' | 'cleaning' | 'reserved';
}

interface MenuItemState {
  id: string;
  name: string;
  category: string;
  price_cents: number;
}

const DEFAULT_TABLES: TableState[] = [
  { id: 'tbl-1', name: 'Table 1', table_number: 1, status: 'available' },
  { id: 'tbl-2', name: 'Table 2', table_number: 2, status: 'occupied' },
  { id: 'tbl-3', name: 'Table 3', table_number: 3, status: 'available' },
  { id: 'tbl-4', name: 'Table 4', table_number: 4, status: 'cleaning' },
  { id: 'tbl-5', name: 'Table 5', table_number: 5, status: 'available' },
  { id: 'tbl-6', name: 'Table 6', table_number: 6, status: 'reserved' },
];

const DEFAULT_MENU: MenuItemState[] = [
  { id: 'menu-1', name: 'Artisan Burger', category: 'Mains', price_cents: 1450 },
  { id: 'menu-2', name: 'Wood-fired Margherita', category: 'Pizza', price_cents: 1800 },
  { id: 'menu-3', name: 'Crispy Truffle Fries', category: 'Sides', price_cents: 750 },
  { id: 'menu-4', name: 'Caesar Salad', category: 'Salads', price_cents: 950 },
  { id: 'menu-5', name: 'Signature Iced Latte', category: 'Beverages', price_cents: 550 },
  { id: 'menu-6', name: 'Sparkling Mineral Water', category: 'Beverages', price_cents: 400 },
];

export function WSNexaMobileApp() {
  const [network, setNetwork] = useState<NetworkState>(() => networkStatus.getState());
  const [stats, setStats] = useState<SyncEngineStats>(() => syncQueue.getStats());
  const [session, setSession] = useState<{ user?: { id: string; email: string }; role?: string } | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<'waiter' | 'kitchen' | 'tables' | 'sync'>('waiter');
  const [showSyncSheet, setShowSyncSheet] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Operational State
  const [tables, setTables] = useState<TableState[]>(DEFAULT_TABLES);
  const [menuItems] = useState<MenuItemState[]>(DEFAULT_MENU);
  const [selectedTableId, setSelectedTableId] = useState<string>('tbl-1');
  const [cartItems, setCartItems] = useState<{ menuItemId: string; name: string; quantity: number; price_cents: number }[]>([]);
  const [orderNotice, setOrderNotice] = useState<string | null>(null);

  // Initialize Network & Sync subscriptions
  useEffect(() => {
    const unsubNet = networkStatus.subscribe((s) => setNetwork(s));
    const unsubSync = syncQueue.subscribe((st) => setStats(st));

    // Register table reconciler
    const unregisterReconciler = realtimeReconciliation.registerReconciler(async () => {
      console.log('[MobileApp] Reconciling table and order data on reconnect...');
    });

    // Check cached session
    async function initAuth() {
      try {
        if (supabase) {
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            setSession({
              user: {
                id: data.session.user.id,
                email: data.session.user.email || 'staff@wsnexa.com',
              },
              role: 'waiter',
            });
          }
        }
      } catch (err) {
        console.warn('Session restoration failed:', err);
      } finally {
        setIsLoadingAuth(false);
      }
    }

    initAuth();

    return () => {
      unsubNet();
      unsubSync();
      unregisterReconciler();
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);

    try {
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }

      if (!network.connected) {
        // Offline demo / emergency staff login
        if (loginEmail.trim()) {
          setSession({
            user: { id: 'offline-staff-id', email: loginEmail },
            role: 'waiter',
          });
          return;
        }
        throw new Error('Initial sign-in requires network connectivity.');
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        setSession({
          user: { id: data.user.id, email: data.user.email || loginEmail },
          role: 'waiter',
        });
      }
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setSession(null);
  };

  const addItemToCart = (item: MenuItemState) => {
    setCartItems((prev) => {
      const exists = prev.find((i) => i.menuItemId === item.id);
      if (exists) {
        return prev.map((i) =>
          i.menuItemId === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { menuItemId: item.id, name: item.name, quantity: 1, price_cents: item.price_cents }];
    });
  };

  const removeItemFromCart = (menuItemId: string) => {
    setCartItems((prev) => {
      const item = prev.find((i) => i.menuItemId === menuItemId);
      if (item && item.quantity > 1) {
        return prev.map((i) =>
          i.menuItemId === menuItemId ? { ...i, quantity: i.quantity - 1 } : i
        );
      }
      return prev.filter((i) => i.menuItemId !== menuItemId);
    });
  };

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0) return;

    const selectedTable = tables.find((t) => t.id === selectedTableId);
    const tableName = selectedTable?.name || `Table ${selectedTableId}`;

    const orderPayload = {
      tableId: selectedTableId,
      tableName,
      items: cartItems.map((c) => ({
        menuItemId: c.menuItemId,
        itemName: c.name,
        quantity: c.quantity,
        price_cents: c.price_cents,
      })),
      total_cents: cartItems.reduce((sum, c) => sum + c.quantity * c.price_cents, 0),
      notes: 'Mobile staff order',
    };

    try {
      if (network.connected) {
        // Try online submission via sync API or server action
        console.log('[MobileApp] Submitting order online:', orderPayload);
      }

      // Always enqueue through the idempotent sync queue
      const queued = await syncQueue.enqueue({
        entity_type: 'order',
        entity_id: `draft-${Date.now()}`,
        action: 'submit_waiter_order',
        payload: orderPayload,
        business_id: 'biz-current',
        branch_id: 'branch-current',
        user_id: session?.user?.id || 'staff-user',
      });

      setOrderNotice(
        network.connected
          ? `✓ Order placed & syncing (#${queued.operation_id.substring(0, 8)})`
          : `⚡ Order queued offline (#${queued.operation_id.substring(0, 8)})`
      );

      // Reset cart and update table occupancy
      setCartItems([]);
      setTables((prev) =>
        prev.map((t) => (t.id === selectedTableId ? { ...t, status: 'occupied' } : t))
      );

      setTimeout(() => setOrderNotice(null), 4000);
    } catch (err: unknown) {
      alert(`Order submission error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleToggleTableStatus = async (tableId: string) => {
    const table = tables.find((t) => t.id === tableId);
    if (!table) return;

    const nextStatusMap: Record<TableState['status'], TableState['status']> = {
      available: 'occupied',
      occupied: 'cleaning',
      cleaning: 'available',
      reserved: 'available',
    };
    const nextStatus = nextStatusMap[table.status];

    setTables((prev) =>
      prev.map((t) => (t.id === tableId ? { ...t, status: nextStatus } : t))
    );

    await syncQueue.enqueue({
      entity_type: 'table_status',
      entity_id: tableId,
      action: 'update_table_status',
      payload: { tableId, status: nextStatus },
      business_id: 'biz-current',
      branch_id: 'branch-current',
      user_id: session?.user?.id || 'staff-user',
    });
  };

  if (isLoadingAuth) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-slate-900 text-slate-200">
        <img src="./assets/wsnexa-full-logo.png" alt="WSNexa" className="w-48 mb-6 animate-pulse" />
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <svg className="animate-spin h-4 w-4 text-emerald-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Initializing WSNexa Foundation...
        </div>
      </div>
    );
  }

  // If not authenticated, render Login Screen
  if (!session) {
    return (
      <div className="h-full w-full flex flex-col justify-between p-6 bg-slate-900 text-slate-100 overflow-y-auto">
        <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
          <div className="text-center mb-8">
            <img src="./assets/wsnexa-full-logo.png" alt="WSNexa" className="w-56 mx-auto mb-2" />
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-[11px] text-slate-400">
              <span className={`h-2 w-2 rounded-full ${network.connected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              {network.connected ? 'Cloud Connected' : 'Offline Mode Active'}
            </div>
          </div>

          {loginError && (
            <div className="mb-4 p-3 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-200 text-xs">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Staff Email
              </label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="staff@restaurant.com"
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] font-bold text-white shadow-lg transition flex items-center justify-center gap-2"
            >
              {isLoggingIn ? 'Authenticating...' : 'Sign In to Terminal'}
            </button>
          </form>

          <div className="mt-8 text-center text-xs text-slate-500">
            WSNexa Mobile v1.0 • Pre-Pilot Edition
          </div>
        </div>
      </div>
    );
  }

  // Authenticated Staff Shell
  return (
    <div className="h-full w-full flex flex-col bg-slate-900 text-slate-100 overflow-hidden">
      {/* Top App Header */}
      <header className="px-4 py-3 bg-slate-800/90 border-b border-slate-700/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <img src="./assets/ws-mark.png" alt="WS" className="w-7 h-7 rounded" />
          <div>
            <div className="font-bold text-sm leading-tight text-white flex items-center gap-1.5">
              <span>WSNexa</span>
              <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                Staff
              </span>
            </div>
            <div className="text-[11px] text-slate-400">Nexa Grand • Main Hall</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sync status badge button */}
          <button
            onClick={() => setShowSyncSheet(true)}
            className={`px-2 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5 transition ${
              stats.pending_count > 0
                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                : 'bg-slate-700/80 text-slate-300'
            }`}
          >
            <span>{network.connected ? '●' : '○'}</span>
            <span>{stats.pending_count > 0 ? `${stats.pending_count} Queue` : 'Synced'}</span>
          </button>

          <button
            onClick={handleLogout}
            title="Sign out"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </header>

      {/* Offline Status Bar */}
      {!network.connected && (
        <div className="px-4 py-1.5 bg-amber-500 text-amber-950 text-xs font-bold flex items-center justify-between border-b border-amber-600">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-950 animate-pulse" />
            <span>Offline Mode Active — Orders & updates will sync automatically</span>
          </div>
          <span className="text-[10px] uppercase tracking-wider bg-amber-600 text-amber-950 px-1.5 py-0.5 rounded">
            Local Safe
          </span>
        </div>
      )}

      {/* Order Toast Notice */}
      {orderNotice && (
        <div className="px-4 py-2 bg-emerald-600 text-white text-xs font-semibold text-center animate-in fade-in">
          {orderNotice}
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4">
        {/* Tab 1: Waiter Ordering */}
        {activeTab === 'waiter' && (
          <div className="space-y-4">
            {/* Table Selector */}
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
                Select Table
              </label>
              <div className="grid grid-cols-3 gap-2">
                {tables.map((tbl) => (
                  <button
                    key={tbl.id}
                    onClick={() => setSelectedTableId(tbl.id)}
                    className={`p-2.5 rounded-lg border text-left transition ${
                      selectedTableId === tbl.id
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="font-bold text-sm">{tbl.name}</div>
                    <div className="text-[10px] capitalize opacity-80">{tbl.status}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Menu Items Grid */}
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
                Menu Items
              </label>
              <div className="grid grid-cols-2 gap-2">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => addItemToCart(item)}
                    className="p-3 rounded-lg bg-slate-800 border border-slate-700 hover:border-slate-600 text-left flex flex-col justify-between active:scale-[0.98] transition"
                  >
                    <div>
                      <div className="text-[10px] text-emerald-400 font-medium">{item.category}</div>
                      <div className="text-xs font-bold text-slate-100 line-clamp-1">{item.name}</div>
                    </div>
                    <div className="text-xs font-semibold text-slate-300 mt-2">
                      ${(item.price_cents / 100).toFixed(2)}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Current Order Summary */}
            <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-3.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300 mb-2 border-b border-slate-700 pb-2">
                <span>Current Order (Table {tables.find((t) => t.id === selectedTableId)?.table_number})</span>
                <span>{cartItems.reduce((acc, c) => acc + c.quantity, 0)} items</span>
              </div>

              {cartItems.length === 0 ? (
                <div className="text-center py-4 text-xs text-slate-500">
                  Tap items above to add to draft
                </div>
              ) : (
                <div className="space-y-2 mb-3 max-h-36 overflow-y-auto">
                  {cartItems.map((item) => (
                    <div key={item.menuItemId} className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-200">{item.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">${((item.price_cents * item.quantity) / 100).toFixed(2)}</span>
                        <div className="flex items-center gap-1 bg-slate-700 rounded px-1.5 py-0.5">
                          <button onClick={() => removeItemFromCart(item.menuItemId)} className="text-slate-300 font-bold px-1">−</button>
                          <span className="text-white font-bold">{item.quantity}</span>
                          <button
                            onClick={() => {
                              const found = menuItems.find((m) => m.id === item.menuItemId);
                              if (found) addItemToCart(found);
                            }}
                            className="text-slate-300 font-bold px-1"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-700 text-xs font-bold">
                <span className="text-slate-400">Total:</span>
                <span className="text-emerald-400 text-sm">
                  ${(cartItems.reduce((sum, c) => sum + c.quantity * c.price_cents, 0) / 100).toFixed(2)}
                </span>
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={cartItems.length === 0}
                className="w-full mt-3 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs shadow transition active:scale-[0.99]"
              >
                {network.connected ? 'Send Order to Kitchen' : 'Queue Order Offline (⚡ Resilient)'}
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Kitchen / KDS */}
        {activeTab === 'kitchen' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase text-slate-400">Active Kitchen Tickets</h2>
              <span className="text-[11px] text-slate-500">Live KDS View</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-800 border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold text-sm text-white">#104 • Table 2</div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                  Preparing
                </span>
              </div>
              <div className="text-xs text-slate-300 space-y-1 mb-3">
                <div>2x Artisan Burger</div>
                <div>1x Crispy Truffle Fries</div>
              </div>
              <button
                onClick={() => alert('Item status updated')}
                className="w-full py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-xs font-semibold text-slate-200"
              >
                Mark Ready for Pickup
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-800 border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold text-sm text-white">#105 • Table 1</div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-800">
                  New Ticket
                </span>
              </div>
              <div className="text-xs text-slate-300 space-y-1 mb-3">
                <div>1x Wood-fired Margherita</div>
                <div>2x Signature Iced Latte</div>
              </div>
              <button
                onClick={() => alert('Item status updated')}
                className="w-full py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white"
              >
                Start Preparation
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Tables Floor Management */}
        {activeTab === 'tables' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase text-slate-400">Floor & Table Layout</h2>
              <span className="text-[11px] text-slate-500">Tap to toggle status</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {tables.map((t) => (
                <div
                  key={t.id}
                  onClick={() => handleToggleTableStatus(t.id)}
                  className="p-3.5 rounded-xl bg-slate-800 border border-slate-700 cursor-pointer active:scale-[0.98] transition"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-white">{t.name}</span>
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        t.status === 'available'
                          ? 'bg-emerald-400'
                          : t.status === 'occupied'
                          ? 'bg-rose-400'
                          : t.status === 'cleaning'
                          ? 'bg-amber-400'
                          : 'bg-blue-400'
                      }`}
                    />
                  </div>
                  <div className="text-xs text-slate-400 capitalize">Status: {t.status}</div>
                  <div className="text-[10px] text-slate-500 mt-2">Tap to advance status</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: Sync & Diagnostics */}
        {activeTab === 'sync' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-800 border border-slate-700">
              <h3 className="font-bold text-sm text-white mb-2">Sync Engine Health</h3>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 rounded bg-slate-900/60 border border-slate-700/50">
                  <div className="text-slate-400 text-[10px]">Pending</div>
                  <div className="font-bold text-amber-400 text-sm">{stats.pending_count}</div>
                </div>
                <div className="p-2 rounded bg-slate-900/60 border border-slate-700/50">
                  <div className="text-slate-400 text-[10px]">Synced</div>
                  <div className="font-bold text-emerald-400 text-sm">{stats.synced_count}</div>
                </div>
                <div className="p-2 rounded bg-slate-900/60 border border-slate-700/50">
                  <div className="text-slate-400 text-[10px]">Network</div>
                  <div className="font-bold text-slate-200 text-sm">
                    {network.connected ? 'Online' : 'Offline'}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => syncQueue.processQueue()}
                  disabled={!network.connected || stats.is_syncing}
                  className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs transition"
                >
                  {stats.is_syncing ? 'Syncing...' : 'Sync All Pending'}
                </button>
                <button
                  onClick={() => setShowSyncSheet(true)}
                  className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium"
                >
                  Details
                </button>
              </div>
            </div>

            {/* Offline Simulator */}
            <div className="p-4 rounded-xl bg-slate-800 border border-slate-700">
              <h3 className="font-bold text-sm text-white mb-1">Resilience Simulator</h3>
              <p className="text-xs text-slate-400 mb-3">
                Simulate network drops to validate offline queueing and recovery.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => networkStatus._overrideStateForTesting(!network.connected)}
                  className={`flex-1 py-2 rounded-lg font-semibold text-xs transition ${
                    network.connected
                      ? 'bg-amber-600 hover:bg-amber-500 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {network.connected ? 'Simulate Disconnect' : 'Simulate Reconnect'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="px-2 py-2 bg-slate-800 border-t border-slate-700 grid grid-cols-4 gap-1 text-center shrink-0">
        <button
          onClick={() => setActiveTab('waiter')}
          className={`py-1.5 rounded-lg flex flex-col items-center justify-center transition ${
            activeTab === 'waiter' ? 'text-emerald-400 bg-slate-700/60' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="text-base leading-none">🍽️</span>
          <span className="text-[10px] font-semibold mt-1">Waiter</span>
        </button>

        <button
          onClick={() => setActiveTab('kitchen')}
          className={`py-1.5 rounded-lg flex flex-col items-center justify-center transition ${
            activeTab === 'kitchen' ? 'text-emerald-400 bg-slate-700/60' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="text-base leading-none">👨‍🍳</span>
          <span className="text-[10px] font-semibold mt-1">Kitchen</span>
        </button>

        <button
          onClick={() => setActiveTab('tables')}
          className={`py-1.5 rounded-lg flex flex-col items-center justify-center transition ${
            activeTab === 'tables' ? 'text-emerald-400 bg-slate-700/60' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="text-base leading-none">🪑</span>
          <span className="text-[10px] font-semibold mt-1">Tables</span>
        </button>

        <button
          onClick={() => setActiveTab('sync')}
          className={`py-1.5 rounded-lg flex flex-col items-center justify-center relative transition ${
            activeTab === 'sync' ? 'text-emerald-400 bg-slate-700/60' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="text-base leading-none">🔄</span>
          <span className="text-[10px] font-semibold mt-1">Sync</span>
          {stats.pending_count > 0 && (
            <span className="absolute top-1 right-3 h-2 w-2 rounded-full bg-amber-400" />
          )}
        </button>
      </nav>

      {/* Sync Status Sheet Modal */}
      {showSyncSheet && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm bg-slate-900 border-l border-slate-700 h-full flex flex-col text-slate-100">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/80">
              <h3 className="font-bold text-sm">Sync Queue Details</h3>
              <button
                onClick={() => setShowSyncSheet(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {syncQueue.getQueue().length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  Queue is empty. Operations will appear here when offline.
                </div>
              ) : (
                syncQueue.getQueue().map((item) => (
                  <div key={item.operation_id} className="p-3 rounded-lg bg-slate-800 border border-slate-700 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-200">{item.action}</span>
                      <span className="text-[10px] uppercase px-1.5 py-0.5 rounded font-bold bg-amber-950 text-amber-300">
                        {item.status}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      ID: {item.operation_id.substring(0, 16)}...
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      Attempts: {item.attempt_count}/{item.max_attempts}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t border-slate-800 bg-slate-800/50 flex gap-2">
              <button
                onClick={() => syncQueue.clearSynced()}
                className="flex-1 py-2 rounded bg-slate-700 hover:bg-slate-600 text-xs text-slate-200 font-medium"
              >
                Clear Synced
              </button>
              <button
                onClick={() => syncQueue.processQueue()}
                disabled={!network.connected}
                className="flex-1 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs text-white font-bold"
              >
                Process Queue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Mount React Root
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<WSNexaMobileApp />);
}
