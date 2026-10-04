import React from 'react';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import {
  getCategoryById,
  getArticlesByCategory,
  getAllCategories,
} from '@/content/help/registry';
import { HelpCategoryView } from '@/components/help/help-category-view';
import { HelpLanguageProvider } from '@/components/help/help-language-context';

interface CategoryPageProps {
  params: Promise<{ category: string }>;
}

export async function generateStaticParams() {
  const categories = getAllCategories();
  return categories.map((c) => ({
    category: c.id,
  }));
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { category: categoryId } = await params;
  const category = getCategoryById(categoryId);
  if (!category) return { title: 'Category Not Found | WSNexa Help' };

  return {
    title: `${category.title} Guides | WSNexa Help Center`,
    description: category.description,
  };
}

export default async function PublicHelpCategoryPage({ params }: CategoryPageProps) {
  const { category: categoryId } = await params;
  const category = getCategoryById(categoryId);

  if (!category) {
    notFound();
  }

  const articles = getArticlesByCategory(categoryId);

  return (
    <div className="min-h-screen bg-zinc-50 py-10 px-4 sm:px-6 lg:px-8">
      <HelpLanguageProvider>
        <HelpCategoryView
          category={category}
          articles={articles}
          basePath="/help"
        />
      </HelpLanguageProvider>
    </div>
  );
}
