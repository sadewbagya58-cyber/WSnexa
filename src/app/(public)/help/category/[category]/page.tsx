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

import { JsonLd } from '@/components/seo/json-ld';
import { createBreadcrumbSchema } from '@/lib/seo/structured-data';

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { category: categoryId } = await params;
  const category = getCategoryById(categoryId);
  if (!category) {
    return {
      title: 'Category Not Found',
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const title = `${category.title} Guides`;
  const canonicalUrl = `/help/category/${category.id}`;

  return {
    title,
    description: category.description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${category.title} Guides | WSNexa`,
      description: category.description,
      url: canonicalUrl,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${category.title} Guides | WSNexa`,
      description: category.description,
    },
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
      <JsonLd
        data={createBreadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Help Center', url: '/help' },
          { name: category.title, url: `/help/category/${category.id}` },
        ])}
      />
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
