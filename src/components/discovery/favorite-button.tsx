'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { toggleFavoriteVenueAction, storeFavoriteIntentAction } from '@/server/actions/venue-discovery';

interface FavoriteButtonProps {
  venueProfileId: string;
  initialIsFavorite?: boolean;
  isLoggedIn?: boolean;
}

export function FavoriteButton({
  venueProfileId,
  initialIsFavorite = false,
  isLoggedIn = false,
}: FavoriteButtonProps) {
  const pathname = usePathname();
  const [isFav, setIsFav] = useState(initialIsFavorite);
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    if (!isLoggedIn) {
      await storeFavoriteIntentAction(venueProfileId, pathname);
      window.location.href = `/login?next=${encodeURIComponent(pathname)}`;
      return;
    }
    setLoading(true);
    const res = await toggleFavoriteVenueAction(venueProfileId);
    setLoading(false);
    if (res.success && res.data) {
      setIsFav(res.data.isFavorite);
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={loading}
      aria-label={isFav ? 'Remove from saved favorites' : 'Save this venue to favorites'}
      aria-pressed={isFav}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black transition-all min-h-[44px] touch-manipulation focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.97] ${
        isFav
          ? 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white border border-rose-600 shadow-xs focus:ring-rose-500'
          : 'bg-white hover:bg-zinc-50 active:bg-zinc-100 text-zinc-900 border border-zinc-300 shadow-xs focus:ring-zinc-300'
      }`}
    >
      {loading ? '...' : isFav ? '♥ Saved' : '♡ Save'}
    </button>
  );
}
