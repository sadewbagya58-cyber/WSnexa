import React from 'react';
import { notFound } from 'next/navigation';
import {
  getCategoryById,
  getArticlesByCategory,
  getAllCategories,
} from '@/content/help/registry';
import { HelpCategoryView } from '@/components/help/help-category-view';

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

  return <HelpCategoryView category={category} articles={articles} />;
}

