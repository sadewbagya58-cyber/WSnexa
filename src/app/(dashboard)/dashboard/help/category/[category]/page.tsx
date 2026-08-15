import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getCategoryById,
  getArticlesByCategory,
  getAllCategories,
} from '@/content/help/registry';
import { HelpArticleCard } from '@/components/help/help-article-card';
import { SupportFallbackCard } from '@/components/help/support-fallback-card';

interface CategoryPageProps {
  params: Promise<{ category: string }>;
}

export async function generateStaticParams() {
  const categories = getAllCategories();
  return categories.map((c) => ({
    category: c.id,
  }));
}

export default async function HelpCategoryPage({ params }: CategoryPageProps) {
  const { category: categoryId } = await params;
  const category = getCategoryById(categoryId);

  if (!category) {
    notFound();
  }

  const articles = getArticlesByCategory(categoryId);

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-bold text-zinc-500">
        <Link href="/dashboard/help" className="hover:text-zinc-950 transition-colors">
          Help Center
        </Link>
        <span>/</span>
        <span className="text-zinc-900">{category.title}</span>
      </nav>

      {/* Category Header */}
      <div className="border-b border-zinc-200 pb-5 space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{category.icon}</span>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
              {category.title}
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-zinc-500 mt-1">
              {category.description}
            </p>
          </div>
        </div>
      </div>

      {/* Articles Grid */}
      <div className="space-y-4">
        <h2 className="text-sm font-extrabold text-zinc-400 uppercase tracking-wider">
          {articles.length} Available Guide{articles.length === 1 ? '' : 's'}
        </h2>

        {articles.length === 0 ? (
          <div className="p-8 text-center rounded-3xl border border-zinc-200 bg-white">
            <p className="text-xs text-zinc-500 font-semibold">No guides published in this category yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {articles.map((article) => (
              <HelpArticleCard key={article.slug} article={article} />
            ))}
          </div>
        )}
      </div>

      {/* Support Fallback */}
      <SupportFallbackCard />
    </div>
  );
}
