'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/features/cart/cart-calculations';
import { useItemCartQuantity } from '@/features/cart/cart-context';
import { getMenuThumbnailUrl } from '@/lib/image-optimizer';

export interface MenuItemCardProps {
  item: {
    id: string;
    name: string;
    description?: string | null;
    price_cents: number;
    currency?: string;
    availability_status?: string;
    is_available?: boolean;
    is_featured?: boolean;
    primary_image_url?: string | null;
    modifier_groups?: Array<{ id: string }>;
  };
  currency?: string;
  onClick?: (item: MenuItemCardProps['item']) => void;
  onSelect?: (item: MenuItemCardProps['item']) => void;
  onQuickAdd?: (item: MenuItemCardProps['item'], e: React.MouseEvent) => void;
  addedQuantity?: number;
}

function arePropsEqual(prev: MenuItemCardProps, next: MenuItemCardProps): boolean {
  if (prev.item.id !== next.item.id) return false;
  if (prev.item.name !== next.item.name) return false;
  if (prev.item.price_cents !== next.item.price_cents) return false;
  if (prev.item.availability_status !== next.item.availability_status) return false;
  if (prev.item.is_available !== next.item.is_available) return false;
  if (prev.item.is_featured !== next.item.is_featured) return false;
  if (prev.item.primary_image_url !== next.item.primary_image_url) return false;
  if (prev.addedQuantity !== next.addedQuantity) return false;
  if (prev.currency !== next.currency) return false;
  return true;
}

export const MenuItemCard = React.memo(function MenuItemCard({
  item,
  currency,
  onClick,
  onSelect,
  onQuickAdd,
  addedQuantity: propAddedQuantity,
}: MenuItemCardProps) {
  const storeQuantity = useItemCartQuantity(item.id);
  const addedQuantity = propAddedQuantity !== undefined ? propAddedQuantity : storeQuantity;

  const itemCurrency = currency || item.currency || 'USD';
  const isAvailable = item.is_available ?? (item.availability_status === 'available');
  const isSoldOut = !isAvailable || item.availability_status === 'out_of_stock';
  const hasModifiers = item.modifier_groups && item.modifier_groups.length > 0;
  const thumbUrl = getMenuThumbnailUrl(item.primary_image_url, 160);

  const handleItemClick = () => {
    if (onClick) onClick(item);
    else if (onSelect) onSelect(item);
  };

  return (
    <div
      onClick={handleItemClick}
      style={{ contentVisibility: 'auto', containIntrinsicSize: '88px' }}
      className={`group cursor-pointer rounded-2xl border bg-white p-3.5 sm:p-4 shadow-2xs flex items-start justify-between gap-3 sm:gap-4 relative overflow-hidden select-none touch-manipulation active:scale-[0.98] ${
        isSoldOut
          ? 'border-zinc-200 bg-zinc-50/70 opacity-75'
          : 'border-zinc-200 hover:border-zinc-300'
      }`}
    >
      {/* Left Content Column */}
      <div className="space-y-1.5 flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <h3 className="text-sm font-black text-zinc-950 tracking-tight leading-snug line-clamp-1">
            {item.name}
          </h3>

          {item.is_featured && !isSoldOut && (
            <Badge variant="warning" className="text-[10px] py-0 px-1.5 font-bold">
              Featured
            </Badge>
          )}

          {isSoldOut && (
            <Badge variant="destructive" className="text-[10px] py-0 px-1.5 font-black uppercase bg-red-100 text-red-900 border border-red-200">
              SOLD OUT
            </Badge>
          )}
        </div>

        {item.description && (
          <p className="text-xs font-semibold text-zinc-500 line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        )}

        <div className="pt-1 flex items-center gap-2">
          <span className="text-sm font-black text-zinc-950 font-mono">
            {formatCurrency(item.price_cents, itemCurrency)}
          </span>

          {hasModifiers && !isSoldOut && (
            <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider">
              • Customizable
            </span>
          )}
        </div>
      </div>

      {/* Right Column: Image & Add CTA */}
      <div className="flex flex-col items-end gap-2 shrink-0">
        {/* Image / Fallback Container */}
        <div className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-100 relative shadow-2xs">
          {thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbUrl}
              alt={item.name}
              loading="lazy"
              decoding="async"
              width={80}
              height={80}
              className={`h-full w-full object-cover ${
                isSoldOut ? 'grayscale brightness-90' : ''
              }`}
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-xl sm:text-2xl text-zinc-400 bg-zinc-50">
              🍽️
            </div>
          )}

          {/* Added Quantity Pill Badge */}
          {addedQuantity > 0 && (
            <div className="absolute top-1 right-1 rounded-full bg-zinc-950 text-white font-mono font-black text-[10px] h-5 w-5 flex items-center justify-center shadow-xs border border-white">
              {addedQuantity}
            </div>
          )}
        </div>

        {/* Add / Sold Out Button */}
        <div>
          {isSoldOut ? (
            <span className="text-[11px] font-extrabold text-zinc-400 uppercase px-2.5 py-1 bg-zinc-100 rounded-lg">
              Unavailable
            </span>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onQuickAdd) onQuickAdd(item, e);
                else handleItemClick();
              }}
              className="inline-flex items-center justify-center gap-1 rounded-lg bg-zinc-950 px-3 py-1.5 text-xs font-extrabold text-white shadow-xs hover:bg-zinc-800 active:scale-95 transition-transform cursor-pointer touch-manipulation"
            >
              <span>{hasModifiers ? 'Customize' : 'Add'}</span>
              <span>{hasModifiers ? '⚙️' : '+'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}, arePropsEqual);
