'use client';

import React from 'react';

export interface MenuBrandHeaderProps {
  businessName: string;
  venueDisplayName?: string | null;
  branchName: string;
  logoUrl?: string | null;
  city?: string | null;
  addressLine1?: string | null;
  address?: string | null;
  staffName?: string | null;
  waiterIdentity?: string | null;
  isWaiterContext?: boolean;
  onTableClick?: () => void;
  tableName?: string | null;
  requireTableSelection?: boolean;
  isTableVerified?: boolean;
  rightActions?: React.ReactNode;
}

export function MenuBrandHeader({
  businessName,
  venueDisplayName,
  branchName,
  logoUrl,
  city,
  addressLine1,
  address,
  staffName,
  waiterIdentity,
  isWaiterContext = false,
  onTableClick,
  tableName,
  requireTableSelection = false,
  isTableVerified = false,
  rightActions,
}: MenuBrandHeaderProps) {
  const displayName = venueDisplayName || businessName;
  const locationText = address || city || addressLine1 || null;

  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() || '')
    .join('') || displayName.slice(0, 2).toUpperCase();

  return (
    <div className="bg-white border-b border-zinc-200/80 px-4 pt-4 pb-3 shadow-2xs">
      <div className="max-w-2xl mx-auto flex flex-col items-center text-center space-y-2">
        {/* Circular Venue Logo */}
        <div className="relative h-14 w-14 sm:h-16 sm:w-16 rounded-full border-2 border-zinc-200 bg-zinc-950 text-white overflow-hidden shadow-xs flex items-center justify-center shrink-0">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={displayName}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-xl sm:text-2xl font-black font-mono tracking-widest text-white">
              {initials}
            </span>
          )}
        </div>

        {/* Venue Title & Branch */}
        <div className="space-y-0.5 max-w-full px-2">
          <h1 className="text-lg sm:text-xl font-black text-zinc-950 tracking-tight leading-snug line-clamp-1">
            {displayName}
          </h1>
          <div className="flex items-center justify-center gap-1.5 flex-wrap text-xs font-bold text-zinc-600">
            <span>{branchName}</span>
            {locationText && (
              <>
                <span className="text-zinc-300">•</span>
                <span className="text-zinc-500 font-semibold flex items-center gap-0.5">
                  📍 {locationText}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Context Badges (Waiter identity or Table Selector) */}
        {(isWaiterContext || waiterIdentity) && (
          <div className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-950">
            <span>👤 {waiterIdentity || `Serving as: ${staffName || 'Staff'}`}</span>
          </div>
        )}

        {rightActions && <div className="mt-1">{rightActions}</div>}

        {!isWaiterContext && requireTableSelection && onTableClick && (
          <div className="mt-1">
            <button
              type="button"
              onClick={onTableClick}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 px-3.5 py-1.5 text-xs font-extrabold text-zinc-900 transition-all min-h-[44px] cursor-pointer"
            >
              <span>📍 Table:</span>
              {isTableVerified && tableName ? (
                <span className="text-emerald-800 font-black">{tableName}</span>
              ) : (
                <span className="text-amber-800 font-bold underline">Select Table</span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
