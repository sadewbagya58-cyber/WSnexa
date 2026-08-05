'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ModifierGroupSelector } from './modifier-group-selector';
import { QuantityStepper } from './quantity-stepper';
import { validateItemModifiers, CatalogModifierGroup } from '@/features/cart/cart-validation';
import { calculateLineUnitPriceCents, calculateLineTotalCents, formatCurrency } from '@/features/cart/cart-calculations';
import { SelectedModifierSnapshot } from '@/features/cart/cart-types';

export interface ItemDetailSheetProps {
  item: {
    id: string;
    category_id: string;
    name: string;
    slug: string;
    description: string | null;
    price_cents: number;
    currency: string;
    availability_status: string;
    is_featured: boolean;
    primary_image_url: string | null;
    modifier_groups?: CatalogModifierGroup[];
  };
  currency: string;
  editingLine?: {
    lineId: string;
    quantity: number;
    selectedModifiers: SelectedModifierSnapshot[];
    specialInstructions?: string;
  } | null;
  onClose: () => void;
  onAddToCart: (configuredItem: {
    menuItemId: string;
    itemName: string;
    imageUrl?: string | null;
    quantity: number;
    basePriceCents: number;
    selectedModifiers: SelectedModifierSnapshot[];
    specialInstructions?: string;
    editingLineId?: string;
  }) => void;
}

export const ItemDetailSheet: React.FC<ItemDetailSheetProps> = ({
  item,
  currency,
  editingLine,
  onClose,
  onAddToCart,
}) => {
  const [quantity, setQuantity] = useState<number>(editingLine?.quantity || 1);
  const [notes, setNotes] = useState<string>(editingLine?.specialInstructions || '');
  const [selectedOptionsMap, setSelectedOptionsMap] = useState<Record<string, string[]>>(() => {
    const initialMap: Record<string, string[]> = {};
    if (editingLine?.selectedModifiers) {
      for (const mod of editingLine.selectedModifiers) {
        if (!initialMap[mod.groupId]) {
          initialMap[mod.groupId] = [];
        }
        initialMap[mod.groupId].push(mod.optionId);
      }
    } else if (item.modifier_groups) {
      for (const group of item.modifier_groups) {
        if (group.is_required && group.selection_type === 'single' && group.options.length > 0) {
          const firstAvailable = group.options.find((o) => o.is_available);
          if (firstAvailable) {
            initialMap[group.id] = [firstAvailable.id];
          }
        }
      }
    }
    return initialMap;
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const modalRef = useRef<HTMLDivElement>(null);

  // Lock body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleGroupSelectionChange = (groupId: string, optionIds: string[]) => {
    setSelectedOptionsMap((prev) => ({
      ...prev,
      [groupId]: optionIds,
    }));

    if (validationErrors[groupId]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[groupId];
        return next;
      });
    }
  };

  // Revalidate modifier selections against current catalog
  const validation = validateItemModifiers(item.modifier_groups, selectedOptionsMap);

  // Calculate live unit price and line total
  let lineUnitPriceCents = item.price_cents;
  let lineTotalCents = item.price_cents * quantity;

  try {
    lineUnitPriceCents = calculateLineUnitPriceCents(item.price_cents, validation.selectedSnapshots);
    lineTotalCents = calculateLineTotalCents(lineUnitPriceCents, quantity);
  } catch (err) {
    console.error('Calculation error:', err);
  }

  const isOutOfStock = item.availability_status === 'out_of_stock';

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isOutOfStock) return;

    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      return;
    }

    onAddToCart({
      menuItemId: item.id,
      itemName: item.name,
      imageUrl: item.primary_image_url,
      quantity,
      basePriceCents: item.price_cents,
      selectedModifiers: validation.selectedSnapshots,
      specialInstructions: notes.trim() || undefined,
      editingLineId: editingLine?.lineId,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="item-sheet-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={modalRef}
        className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200 space-y-6 max-h-[90vh] overflow-y-auto flex flex-col justify-between"
      >
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 id="item-sheet-title" className="text-xl font-extrabold text-zinc-950">
                  {item.name}
                </h2>
                {item.is_featured && <Badge variant="warning">Featured</Badge>}
                {isOutOfStock && <Badge variant="destructive">Out of Stock</Badge>}
              </div>
              <div className="text-base font-black text-zinc-950">
                {formatCurrency(item.price_cents, currency)}
              </div>
            </div>

            <button
              type="button"
              aria-label="Close sheet"
              onClick={onClose}
              className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Item Image */}
          {item.primary_image_url && (
            <div className="h-44 w-full overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.primary_image_url}
                alt={item.name}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
          )}

          {item.description && (
            <p className="text-xs text-zinc-600 leading-relaxed">{item.description}</p>
          )}

          {/* Modifier Groups */}
          {item.modifier_groups && item.modifier_groups.length > 0 && (
            <div className="space-y-4 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                Customize Your Order
              </h3>

              {item.modifier_groups.map((group) => (
                <ModifierGroupSelector
                  key={group.id}
                  group={group}
                  selectedOptionIds={selectedOptionsMap[group.id] || []}
                  currency={currency}
                  errorMessage={validationErrors[group.id]}
                  onChange={handleGroupSelectionChange}
                />
              ))}
            </div>
          )}

          {/* Special Instructions Notes */}
          <div className="space-y-1.5 pt-2">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="special-notes" className="font-bold text-zinc-700">
                Special Instructions
              </label>
              <span className="text-[11px] text-zinc-400">{250 - notes.length} left</span>
            </div>
            <textarea
              id="special-notes"
              maxLength={250}
              placeholder="e.g. Extra crispy, sauce on the side, no onions..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 p-3 text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none resize-none h-20"
            />
          </div>
        </div>

        {/* Footer Actions & Quantity Stepper */}
        <div className="sticky bottom-0 bg-white pt-4 border-t border-zinc-100 flex items-center justify-between gap-4">
          <QuantityStepper
            quantity={quantity}
            min={1}
            max={99}
            disabled={isOutOfStock}
            onChange={(q) => setQuantity(q)}
          />

          <Button
            type="button"
            disabled={isOutOfStock}
            onClick={handleFormSubmit}
            className="flex-1 py-3.5 text-sm font-bold shadow-md"
          >
            {isOutOfStock
              ? 'Out of Stock'
              : editingLine
              ? `Update Item • ${formatCurrency(lineTotalCents, currency)}`
              : `Add to Cart • ${formatCurrency(lineTotalCents, currency)}`}
          </Button>
        </div>
      </div>
    </div>
  );
};
