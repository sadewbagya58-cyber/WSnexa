import React from 'react';
import Link from 'next/link';
import { HelpCategory } from '@/content/help/types';

interface HelpCategoryCardProps {
  category: HelpCategory;
  articleCount: number;
}

export const HelpCategoryCard: React.FC<HelpCategoryCardProps> = ({
  category,
  articleCount,
}) => {
  return (
    <Link
      href={`/dashboard/help/category/${category.id}`}
      className="group block rounded-3xl border border-zinc-200 bg-white p-5 hover:border-zinc-300 hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-2xl">{category.icon}</span>
          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider bg-zinc-100 px-2 py-0.5 rounded-lg group-hover:bg-zinc-950 group-hover:text-white transition-colors">
            {articleCount} Guide{articleCount === 1 ? '' : 's'}
          </span>
        </div>

        <div className="space-y-1">
          <h3 className="text-sm font-black text-zinc-950 group-hover:text-amber-600 transition-colors">
            {category.title}
          </h3>
          <p className="text-[11px] font-medium text-zinc-500 line-clamp-2 leading-relaxed">
            {category.description}
          </p>
        </div>
      </div>
    </Link>
  );
};
