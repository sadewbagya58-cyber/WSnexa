'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toggleFavoriteVenueAction, storeFavoriteIntentAction } from '@/server/actions/venue-discovery';

interface FavoriteButtonProps {
  venueProfileId: string;
  initialIsFavorite?: boolean;
  isLoggedIn?: boolean;
}

export function FavoriteButton({ venueProfileId, initialIsFavorite = false, isLoggedIn = false }: FavoriteButtonProps) {
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
    <Button
      type="button"
      onClick={handleToggle}
      disabled={loading}
      variant={isFav ? 'primary' : 'outline'}
      className={`text-xs font-black transition-all ${
        isFav
          ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600 shadow-xs'
          : 'bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800'
      }`}
    >
      {loading ? '...' : isFav ? '♥ Saved Favorite' : '♡ Save Venue'}
    </Button>
  );
}
