'use client';

import React, { useState, useTransition } from 'react';
import { usePathname } from 'next/navigation';
import { toggleFavoriteVenueAction, storeFavoriteIntentAction } from '@/server/actions/venue-discovery';

interface FavoriteButtonProps {
  venueProfileId: string;
  initialIsFavorite?: boolean;
  isLoggedIn?: boolean;
  variant?: 'default' | 'card-floating';
  className?: string;
}

export function FavoriteButton({
  venueProfileId,
  initialIsFavorite = false,
  isLoggedIn = false,
  variant = 'default',
  className = '',
}: FavoriteButtonProps) {
  const pathname = usePathname();
  const [isFav, setIsFav] = useState(initialIsFavorite);
  const [isPending, startTransition] = useTransition();

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isLoggedIn) {
      storeFavoriteIntentAction(venueProfileId, pathname).finally(() => {
        window.location.href = `/login?next=${encodeURIComponent(pathname)}`;
      });
      return;
    }

    // Instant optimistic UI transition — zero delay
    const nextState = !isFav;
    setIsFav(nextState);

    startTransition(async () => {
      try {
        const res = await toggleFavoriteVenueAction(venueProfileId);
        if (!res.success) {
          // Rollback on failure
          setIsFav(!nextState);
        } else if (res.data) {
          setIsFav(res.data.isFavorite);
        }
      } catch {
        // Rollback on network error
        setIsFav(!nextState);
      }
    });
  };

  if (variant === 'card-floating') {
    return (
      <button
        type="button"
        onClick={handleToggle}
        aria-label={isFav ? 'Remove from saved favorites' : 'Save this venue to favorites'}
        aria-pressed={isFav}
        className={`h-9 w-9 rounded-full flex items-center justify-center backdrop-blur-md transition-all duration-200 shadow-md touch-manipulation active:scale-90 focus:outline-none focus:ring-2 focus:ring-rose-500 pointer-events-auto ${
          isFav
            ? 'bg-rose-500 text-white border border-rose-400 shadow-rose-500/20'
            : 'bg-white/85 hover:bg-white text-zinc-700 hover:text-rose-600 border border-white/60'
        } ${className}`}
      >
        <span className="text-base select-none leading-none pt-0.5">
          {isFav ? '♥' : '♡'}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={isFav ? 'Remove from saved favorites' : 'Save this venue to favorites'}
      aria-pressed={isFav}
      className={`inline-flex items-center justify-center gap-1.5 rounded-2xl px-4 py-2.5 text-xs font-black transition-all min-h-[44px] touch-manipulation focus:outline-none focus:ring-2 focus:ring-offset-1 active:scale-[0.97] ${
        isFav
          ? 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white border border-rose-600 shadow-xs focus:ring-rose-500'
          : 'bg-white hover:bg-zinc-50 active:bg-zinc-100 text-zinc-900 border border-zinc-300 shadow-xs focus:ring-zinc-300'
      } ${className}`}
    >
      <span className="text-sm select-none leading-none">
        {isFav ? '♥' : '♡'}
      </span>
      <span>{isFav ? 'Saved' : 'Save'}</span>
    </button>
  );
}
