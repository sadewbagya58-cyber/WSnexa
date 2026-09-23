'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[SW] Service Worker registered with scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('[SW] Service Worker registration failed:', err);
        });
    }
  }, []);

  return null;
}
