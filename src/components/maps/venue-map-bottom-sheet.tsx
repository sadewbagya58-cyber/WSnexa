'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { VenuePublicProfileRecord } from '@/server/services/venue-discovery.service';
import { getGoogleMapsDirectionsUrl } from '@/lib/maps/google-maps-config';

interface VenueMapBottomSheetProps {
  venue: VenuePublicProfileRecord | null;
  userLocation?: { lat: number; lng: number } | null;
  onClose: () => void;
  onGetDirections: (travelMode: 'DRIVING' | 'WALKING') => void;
  routeInfo?: {
    distanceText: string;
    durationText: string;
    steps: string[];
    travelMode: 'DRIVING' | 'WALKING';
  } | null;
  isRouting?: boolean;
  routingError?: string | null;
  onClearRoute?: () => void;
  onTravelModeChange?: (mode: 'DRIVING' | 'WALKING') => void;
}

export function VenueMapBottomSheet({
  venue,
  userLocation,
  onClose,
  onGetDirections,
  routeInfo,
  isRouting = false,
  routingError = null,
  onClearRoute,
  onTravelModeChange,
}: VenueMapBottomSheetProps) {
  // Collapsed by default so 70–80% of the map remains visible on mobile
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  if (!venue) return null;

  const priceDisplay = '$'.repeat(venue.price_level || 2);
  const typeFormatted = venue.venue_type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());

  const hasOrdering = venue.has_wsnexa_ordering ?? venue.is_accepting_orders;
  const externalMapsUrl = getGoogleMapsDirectionsUrl(
    venue.latitude,
    venue.longitude,
    venue.address_public || venue.city
  );

  const initials = venue.display_name
    .split(' ')
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');

  return (
    <div
      className={`absolute bottom-0 left-0 right-0 sm:bottom-4 sm:left-4 sm:right-auto sm:w-[390px] z-30 bg-white/95 backdrop-blur-md rounded-t-3xl sm:rounded-3xl border-t sm:border border-zinc-200/90 shadow-2xl transition-all duration-300 ease-out select-none ${
        isExpanded ? 'max-h-[70vh] flex flex-col' : 'max-h-[145px] overflow-hidden'
      }`}
    >
      {/* ── Drag Handle / Top Toggle Area ───────────────────────────── */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full pt-2 pb-1 flex flex-col items-center justify-center gap-0.5 focus:outline-none touch-manipulation group"
        aria-label={isExpanded ? 'Collapse sheet' : 'Expand route details'}
      >
        <span className="h-1.5 w-10 bg-zinc-300 group-hover:bg-zinc-400 rounded-full transition-colors" />
      </button>

      {/* ── COLLAPSED / COMPACT DEFAULT VIEW (75–80% Map Visible) ───── */}
      {!isExpanded && (
        <div className="px-3.5 pb-3.5 pt-0.5 space-y-2">
          {/* Row 1: Venue Title, Address, Route Summary Badge & Expand Button */}
          <div className="flex items-center justify-between gap-2">
            <div
              className="flex-1 min-w-0 cursor-pointer"
              onClick={() => setIsExpanded(true)}
            >
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs sm:text-sm font-black text-zinc-950 truncate leading-tight">
                  {venue.display_name}
                </h4>
                <span className="text-[10px] font-mono font-extrabold text-zinc-400 shrink-0">
                  {priceDisplay}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] font-semibold text-zinc-500 truncate leading-tight mt-0.5">
                📍 {venue.address_public || venue.city || 'Destination'}
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {routeInfo ? (
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-100/90 text-amber-950 text-[11px] font-black shrink-0">
                  <span>🧭</span>
                  <span>{routeInfo.durationText}</span>
                  <span className="text-zinc-500 text-[10px] hidden min-[380px]:inline">
                    ({routeInfo.distanceText})
                  </span>
                </div>
              ) : isRouting ? (
                <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-900 text-[10px] font-extrabold animate-pulse">
                  Routing...
                </span>
              ) : null}

              <button
                type="button"
                onClick={() => setIsExpanded(true)}
                className="px-2 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 active:bg-zinc-300 text-zinc-700 font-extrabold text-[11px] flex items-center gap-0.5 transition-colors touch-manipulation"
                title="View full details and step-by-step turns"
              >
                <span>▲ Details</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="h-7 w-7 rounded-full bg-zinc-100 hover:bg-zinc-200 active:bg-zinc-300 text-zinc-600 flex items-center justify-center font-bold text-xs transition-colors touch-manipulation"
                aria-label="Close directions"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Row 2: Compact Action Controls */}
          <div className="flex items-center gap-1.5 flex-wrap min-[360px]:flex-nowrap">
            {routeInfo ? (
              <>
                {/* Driving / Walking Mode Switch */}
                <div className="flex items-center gap-0.5 bg-zinc-100 p-0.5 rounded-xl shrink-0">
                  <button
                    type="button"
                    onClick={() => onTravelModeChange?.('DRIVING')}
                    className={`px-2 py-1 rounded-lg text-[11px] font-black transition-all touch-manipulation flex items-center gap-1 ${
                      routeInfo.travelMode === 'DRIVING'
                        ? 'bg-zinc-950 text-white shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-950'
                    }`}
                  >
                    🚗 <span className="hidden min-[380px]:inline">Drive</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onTravelModeChange?.('WALKING')}
                    className={`px-2 py-1 rounded-lg text-[11px] font-black transition-all touch-manipulation flex items-center gap-1 ${
                      routeInfo.travelMode === 'WALKING'
                        ? 'bg-zinc-950 text-white shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-950'
                    }`}
                  >
                    🚶 <span className="hidden min-[380px]:inline">Walk</span>
                  </button>
                </div>

                {/* Explore Venue Link */}
                <Link
                  href={`/venues/${venue.slug}`}
                  className="flex-1 min-w-0 h-8 px-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 active:bg-zinc-900 text-white font-extrabold text-[11px] transition-all flex items-center justify-center truncate text-center touch-manipulation"
                >
                  <span className="truncate">Explore Venue →</span>
                </Link>

                {/* Google Maps External Link */}
                <a
                  href={externalMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="h-8 px-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 active:bg-zinc-300 text-zinc-900 font-bold text-[11px] transition-all flex items-center justify-center shrink-0 touch-manipulation"
                  title="Open in Google Maps"
                >
                  <span>Google Maps ↗</span>
                </a>
              </>
            ) : isRouting ? (
              <div className="w-full text-center py-1 text-xs font-bold text-amber-900 animate-pulse">
                🧭 Calculating route from your location...
              </div>
            ) : routingError ? (
              <div className="flex items-center justify-between gap-1 w-full text-[11px] text-rose-800 bg-rose-50 px-2 py-1 rounded-xl">
                <span className="truncate">⚠️ Route unavailable</span>
                <a
                  href={externalMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-extrabold underline shrink-0"
                >
                  Open Google Maps ↗
                </a>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onGetDirections('DRIVING')}
                  className="flex-1 h-8 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-black text-[11px] transition-all flex items-center justify-center gap-1 shadow-xs touch-manipulation"
                >
                  <span>🧭</span>
                  <span>Get Directions</span>
                </button>
                <a
                  href={externalMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="h-8 px-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-bold text-[11px] transition-all flex items-center justify-center shrink-0 touch-manipulation"
                >
                  Google Maps ↗
                </a>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── EXPANDED FULL VIEW (Details, Turn-by-Turn Steps & Actions) ── */}
      {isExpanded && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Expanded Header Bar */}
          <div className="px-4 pb-2 pt-0.5 flex items-center justify-between border-b border-zinc-100">
            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400">
              Route &amp; Venue Details
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 active:bg-zinc-300 text-zinc-700 font-extrabold text-xs flex items-center gap-1 transition-colors touch-manipulation"
              >
                <span>▼ Minimize Map</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="h-7 w-7 rounded-full bg-zinc-100 hover:bg-zinc-200 active:bg-zinc-300 text-zinc-600 flex items-center justify-center font-bold text-xs transition-colors touch-manipulation"
                aria-label="Close details"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Scrollable Details Container - with overscroll-contain & touch-pan-y to prevent map drag conflicts */}
          <div className="p-4 space-y-3 overflow-y-auto overscroll-contain touch-pan-y max-h-[calc(70vh-60px)] scrollbar-thin">
            {/* ── Venue Identity Row ─────────────────────────────────── */}
            <div className="flex items-start gap-3">
              {/* Thumbnail / Initials */}
              <div className="relative h-14 w-14 rounded-2xl bg-zinc-100 border border-zinc-200 overflow-hidden shrink-0">
                {venue.cover_image_url || venue.logo_url ? (
                  <Image
                    src={venue.cover_image_url || venue.logo_url!}
                    alt={venue.display_name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full bg-zinc-950 text-white font-black text-base flex items-center justify-center">
                    {initials}
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center justify-between gap-1">
                  <h4 className="text-sm font-black text-zinc-950 truncate leading-tight">
                    {venue.display_name}
                  </h4>
                  <span className="text-xs font-mono font-extrabold text-zinc-400 shrink-0">
                    {priceDisplay}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="font-extrabold text-amber-500">
                    ★ {venue.average_rating ? venue.average_rating.toFixed(1) : 'New'}
                  </span>
                  {venue.review_count ? (
                    <span className="text-zinc-400 font-medium">({venue.review_count})</span>
                  ) : null}
                  <span className="text-zinc-300">•</span>
                  <span className="font-bold text-zinc-600">{typeFormatted}</span>
                </div>

                <p className="text-[11px] font-semibold text-zinc-500 truncate">
                  📍 {venue.address_public || venue.city}
                </p>
              </div>
            </div>

            {/* ── Badges Row ─────────────────────────────────────────── */}
            <div className="flex items-center gap-2 flex-wrap">
              {hasOrdering ? (
                <span className="bg-emerald-50 text-emerald-900 border border-emerald-200 font-bold text-[10px] px-2 py-0.5 rounded-lg">
                  ✓ WSNexa Ordering
                </span>
              ) : (
                <span className="bg-zinc-100 text-zinc-700 font-bold text-[10px] px-2 py-0.5 rounded-lg">
                  View Venue Only
                </span>
              )}

              {venue.distance_text && (
                <span className="bg-emerald-100/70 text-emerald-950 border border-emerald-300 font-black text-[10px] px-2 py-0.5 rounded-lg">
                  📍 {venue.distance_text} away
                </span>
              )}
            </div>

            {/* ── Route Preview / Directions Active ───────────────────── */}
            {routeInfo ? (
              <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200/90 space-y-2.5 animate-in fade-in-50">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                      <span>🧭</span>
                      <span className="text-sm font-extrabold">{routeInfo.durationText}</span>
                      <span className="text-zinc-500 font-bold">({routeInfo.distanceText})</span>
                    </div>
                    <div className="text-[10px] font-bold text-amber-900">
                      Live route calculated from your location
                    </div>
                  </div>

                  {onClearRoute && (
                    <button
                      type="button"
                      onClick={onClearRoute}
                      className="text-[11px] font-extrabold text-zinc-500 hover:text-zinc-900 px-2 py-1 rounded-lg hover:bg-amber-100/60"
                    >
                      Clear Route
                    </button>
                  )}
                </div>

                {/* Travel Mode Toggle */}
                <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-amber-200/60">
                  <button
                    type="button"
                    onClick={() => onTravelModeChange?.('DRIVING')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1 min-h-[36px] touch-manipulation ${
                      routeInfo.travelMode === 'DRIVING'
                        ? 'bg-zinc-950 text-white shadow-xs'
                        : 'text-zinc-600 hover:bg-zinc-100'
                    }`}
                  >
                    🚗 Driving
                  </button>
                  <button
                    type="button"
                    onClick={() => onTravelModeChange?.('WALKING')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1 min-h-[36px] touch-manipulation ${
                      routeInfo.travelMode === 'WALKING'
                        ? 'bg-zinc-950 text-white shadow-xs'
                        : 'text-zinc-600 hover:bg-zinc-100'
                    }`}
                  >
                    🚶 Walking
                  </button>
                </div>

                {/* Step-by-step turns toggle */}
                {routeInfo.steps && routeInfo.steps.length > 0 && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowSteps(!showSteps)}
                      className="w-full text-[11px] font-extrabold text-amber-900 hover:text-amber-950 flex items-center justify-between py-1"
                    >
                      <span>
                        📋 {showSteps ? 'Hide Step-by-Step Directions' : `View Step-by-Step (${routeInfo.steps.length} turns)`}
                      </span>
                      <span>{showSteps ? '▲' : '▼'}</span>
                    </button>

                    {showSteps && (
                      <div className="space-y-1.5 mt-2 max-h-40 overflow-y-auto overscroll-contain touch-pan-y pr-1 text-[11px] font-medium text-zinc-800 divide-y divide-amber-100 scrollbar-thin">
                        {routeInfo.steps.map((stepHtml, idx) => (
                          <div
                            key={idx}
                            className="pt-1.5 first:pt-0 leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: `${idx + 1}. ${stepHtml}` }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : routingError ? (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 font-semibold space-y-1">
                <div className="font-bold flex items-center gap-1">⚠️ Route calculation unavailable</div>
                <div className="text-[11px] text-rose-700 leading-relaxed">{routingError}</div>
              </div>
            ) : null}

            {/* ── Action Buttons ──────────────────────────────────────── */}
            <div className="space-y-2 pt-1">
              {!routeInfo && (
                <button
                  type="button"
                  onClick={() => onGetDirections('DRIVING')}
                  disabled={isRouting}
                  className="w-full flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-black text-xs shadow-xs transition-all active:scale-[0.98] disabled:opacity-50 touch-manipulation focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <span>🧭</span>
                  <span>{isRouting ? 'Calculating in-app route...' : 'Get In-App Directions'}</span>
                </button>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Link
                  href={`/venues/${venue.slug}`}
                  className="flex items-center justify-center gap-1 min-h-[44px] px-3 py-2 rounded-2xl bg-zinc-950 hover:bg-zinc-800 active:bg-zinc-900 text-white font-extrabold text-xs shadow-xs transition-all active:scale-[0.98] touch-manipulation text-center"
                >
                  <span>Explore Venue →</span>
                </Link>

                <a
                  href={externalMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-1 min-h-[44px] px-3 py-2 rounded-2xl bg-zinc-100 hover:bg-zinc-200 active:bg-zinc-300 text-zinc-900 font-bold text-xs transition-all active:scale-[0.98] touch-manipulation text-center"
                >
                  <span>Google Maps ↗</span>
                </a>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full min-h-[40px] px-4 py-2 rounded-2xl bg-zinc-200 hover:bg-zinc-300 active:bg-zinc-400 text-zinc-800 font-extrabold text-xs transition-colors touch-manipulation text-center"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
