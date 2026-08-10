'use client';

import React, { useState, useEffect } from 'react';

interface OperationalConnectionStatusProps {
  onRetry?: () => void;
  isReconnecting?: boolean;
}

export function OperationalConnectionStatus({
  onRetry,
  isReconnecting = false,
}: OperationalConnectionStatusProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setIsSlow(false);
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Network connection quality awareness if available
    const nav = navigator as Navigator & {
      connection?: {
        rtt: number;
        effectiveType: string;
        addEventListener: (type: string, listener: () => void) => void;
        removeEventListener: (type: string, listener: () => void) => void;
      };
    };
    if (nav.connection) {
      const checkSpeed = () => {
        if (nav.connection && (nav.connection.rtt > 1500 || nav.connection.effectiveType === '2g')) {
          setIsSlow(true);
        } else {
          setIsSlow(false);
        }
      };
      checkSpeed();
      nav.connection.addEventListener('change', checkSpeed);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOnline) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1 bg-rose-500/10 border border-rose-500/30 rounded-full text-rose-400 text-xs font-bold">
        <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
        <span>Offline</span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="ml-1 text-[10px] underline hover:text-white"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (isReconnecting) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-400 text-xs font-bold">
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-spin" />
        <span>Reconnecting...</span>
      </div>
    );
  }

  if (isSlow) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-400 text-xs font-bold">
        <span>⚠️ Connection is slow.</span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-2 py-0.5 bg-amber-500 text-black font-extrabold rounded text-[10px] hover:bg-amber-400"
          >
            Try Again
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400 text-[11px] font-bold">
      <span className="w-2 h-2 rounded-full bg-emerald-500" />
      <span>Live</span>
    </div>
  );
}
