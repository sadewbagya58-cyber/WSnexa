'use client';

import React, { useState, useEffect } from 'react';
import { syncQueue } from '@/lib/offline/sync-queue';
import { networkStatus } from '@/lib/offline/network-status';
import { QueuedMutation, SyncEngineStats, NetworkState } from '@/lib/offline/offline-types';

interface SyncStatusSheetProps {
  isOpen: boolean;
  onClose: () => void;
  branchId?: string;
}

export const SyncStatusSheet: React.FC<SyncStatusSheetProps> = ({
  isOpen,
  onClose,
  branchId,
}) => {
  const [queue, setQueue] = useState<QueuedMutation[]>(() => syncQueue.getQueue(branchId));
  const [stats, setStats] = useState<SyncEngineStats>(() => syncQueue.getStats());
  const [network, setNetwork] = useState<NetworkState>(() => networkStatus.getState());
  const [isRetrying, setIsRetrying] = useState<string | null>(null);

  useEffect(() => {
    const unsubNet = networkStatus.subscribe((st) => setNetwork(st));
    const unsubQueue = syncQueue.subscribe((st) => {
      setStats(st);
      setQueue(syncQueue.getQueue(branchId));
    });

    return () => {
      unsubNet();
      unsubQueue();
    };
  }, [branchId]);

  if (!isOpen) return null;

  const handleRetry = async (opId: string) => {
    setIsRetrying(opId);
    try {
      await syncQueue.retryMutation(opId);
    } finally {
      setIsRetrying(null);
    }
  };

  const handleDiscard = async (opId: string) => {
    await syncQueue.discardMutation(opId);
  };

  const handleClearSynced = async () => {
    await syncQueue.clearSynced();
  };

  const handleSyncAll = async () => {
    await syncQueue.processQueue();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col overflow-hidden text-gray-900 animate-in slide-in-from-right">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <span>Sync & Offline Status</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                  network.connected ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {network.connected ? '● Online' : '○ Offline'}
              </span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {stats.last_synced_at
                ? `Last synced: ${new Date(stats.last_synced_at).toLocaleTimeString()}`
                : 'No sync completed this session'}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-md hover:bg-gray-200 text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {/* Stats Pill Row */}
        <div className="grid grid-cols-4 gap-2 p-3 bg-gray-100/70 border-b border-gray-200 text-center">
          <div className="bg-white p-2 rounded border border-gray-200">
            <div className="text-xs text-gray-500 font-medium">Pending</div>
            <div className="text-base font-bold text-amber-600">{stats.pending_count}</div>
          </div>
          <div className="bg-white p-2 rounded border border-gray-200">
            <div className="text-xs text-gray-500 font-medium">Syncing</div>
            <div className="text-base font-bold text-blue-600">{stats.syncing_count}</div>
          </div>
          <div className="bg-white p-2 rounded border border-gray-200">
            <div className="text-xs text-gray-500 font-medium">Synced</div>
            <div className="text-base font-bold text-emerald-600">{stats.synced_count}</div>
          </div>
          <div className="bg-white p-2 rounded border border-gray-200">
            <div className="text-xs text-gray-500 font-medium">Attention</div>
            <div className="text-base font-bold text-rose-600">
              {stats.failed_count + stats.conflict_count}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between text-xs bg-white">
          <button
            onClick={handleSyncAll}
            disabled={!network.connected || stats.is_syncing || stats.pending_count === 0}
            className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium transition flex items-center gap-1.5"
          >
            {stats.is_syncing ? 'Syncing...' : 'Sync All Pending'}
          </button>
          {stats.synced_count > 0 && (
            <button
              onClick={handleClearSynced}
              className="text-gray-500 hover:text-gray-700 underline"
            >
              Clear Synced ({stats.synced_count})
            </button>
          )}
        </div>

        {/* Mutation Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {queue.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-3xl mb-2">📋</div>
              <p className="text-sm font-medium text-gray-600">Sync Queue is Empty</p>
              <p className="text-xs text-gray-400 mt-1">
                Any actions taken while offline will appear here and sync automatically when connected.
              </p>
            </div>
          ) : (
            queue.map((item) => (
              <div
                key={item.operation_id}
                className={`p-3 rounded-lg border text-xs ${
                  item.status === 'pending'
                    ? 'border-amber-200 bg-amber-50/50'
                    : item.status === 'syncing'
                    ? 'border-blue-200 bg-blue-50/50'
                    : item.status === 'synced'
                    ? 'border-emerald-200 bg-emerald-50/30'
                    : 'border-rose-200 bg-rose-50/50'
                }`}
              >
                <div className="flex items-center justify-between font-semibold mb-1">
                  <span className="capitalize text-gray-900 flex items-center gap-1.5">
                    <span>
                      {item.status === 'pending' && '⏳'}
                      {item.status === 'syncing' && '🔄'}
                      {item.status === 'synced' && '✅'}
                      {item.status === 'failed' && '❌'}
                      {item.status === 'conflict' && '⚠️'}
                    </span>
                    {item.action.replace(/_/g, ' ')}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                      item.status === 'pending'
                        ? 'bg-amber-100 text-amber-800'
                        : item.status === 'syncing'
                        ? 'bg-blue-100 text-blue-800'
                        : item.status === 'synced'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>

                <div className="text-gray-500 font-mono text-[11px] mb-1">
                  ID: {item.operation_id.substring(0, 12)}...
                </div>

                <div className="text-gray-600 text-[11px]">
                  Entity: <span className="font-medium text-gray-800">{item.entity_type}</span> ({item.entity_id.substring(0, 8)}...)
                </div>

                {item.last_error && (
                  <div className="mt-2 p-2 rounded bg-rose-100 text-rose-900 text-[11px] font-mono">
                    {item.last_error}
                  </div>
                )}

                <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between text-[11px] text-gray-500">
                  <span>
                    Attempts: {item.attempt_count}/{item.max_attempts}
                  </span>
                  <div className="flex items-center gap-2">
                    {(item.status === 'failed' || item.status === 'conflict') && (
                      <button
                        onClick={() => handleRetry(item.operation_id)}
                        disabled={isRetrying === item.operation_id || !network.connected}
                        className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium disabled:opacity-50"
                      >
                        {isRetrying === item.operation_id ? 'Retrying...' : 'Retry'}
                      </button>
                    )}
                    {item.status !== 'syncing' && (
                      <button
                        onClick={() => handleDiscard(item.operation_id)}
                        className="px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded font-medium"
                      >
                        Discard
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-200 bg-gray-50 text-[11px] text-gray-500 text-center">
          WSNexa Mobile Sync Engine v1.0 • Idempotent & Server-Authoritative
        </div>
      </div>
    </div>
  );
};
