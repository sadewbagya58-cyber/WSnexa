'use client';

import React, { useMemo } from 'react';

export interface CategoryOption {
  id: string;
  name: string;
  count?: number;
}

export interface CategoryTabsProps {
  categories: Array<{
    id: string;
    name: string;
    count?: number;
  }>;
  items?: Array<{ category_id: string }>;
  selectedCategoryId?: string;
  selectedCategory?: string;
  onSelectCategory: (id: string) => void;
  totalItemsCount?: number;
}

export const CategoryTabs = React.memo(function CategoryTabs({
  categories,
  items,
  selectedCategoryId,
  selectedCategory,
  onSelectCategory,
  totalItemsCount,
}: CategoryTabsProps) {
  const activeCategoryId = selectedCategoryId || selectedCategory || 'all';

  const countsMap = useMemo(() => {
    if (!items) return null;
    const map = new Map<string, number>();
    for (const item of items) {
      map.set(item.category_id, (map.get(item.category_id) || 0) + 1);
    }
    return map;
  }, [items]);

  const totalCount = useMemo(() => {
    if (totalItemsCount != null) return totalItemsCount;
    if (items) return items.length;
    return categories.reduce((sum, c) => sum + (c.count || 0), 0);
  }, [totalItemsCount, items, categories]);

  return (
    <div className="sticky top-0 z-30 bg-zinc-50/95 backdrop-blur-md pt-2 pb-2 -mx-4 px-4 border-b border-zinc-200/60 shadow-2xs">
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5 touch-pan-x">
        <button
          type="button"
          onClick={() => onSelectCategory('all')}
          className={`shrink-0 rounded-full px-4 py-2 text-xs font-black transition-all cursor-pointer min-h-[44px] flex items-center justify-center ${
            activeCategoryId === 'all'
              ? 'bg-zinc-950 text-white shadow-xs'
              : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950'
          }`}
        >
          All Items ({totalCount})
        </button>

        {categories.map((cat) => {
          const itemCount =
            cat.count != null ? cat.count : countsMap ? countsMap.get(cat.id) || 0 : null;
          if (itemCount === 0) return null;
          const isSelected = activeCategoryId === cat.id;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-black transition-all cursor-pointer min-h-[44px] flex items-center justify-center ${
                isSelected
                  ? 'bg-zinc-950 text-white shadow-xs'
                  : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950'
              }`}
            >
              {cat.name} {cat.count != null ? `(${cat.count})` : itemCount != null ? `(${itemCount})` : ''}
            </button>
          );
        })}
      </div>
    </div>
  );
});
