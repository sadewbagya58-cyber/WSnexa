import React from 'react';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import {
  getArticleBySlug,
  getCategoryById,
  getAllArticles,
} from '@/content/help/registry';
import { HelpArticleView } from '@/components/help/help-article-view';
import { HelpLanguageProvider } from '@/components/help/help-language-context';

interface ArticlePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const articles = getAllArticles();
  return articles.map((a) => ({
    slug: a.slug,
  }));
}

import { JsonLd } from '@/components/seo/json-ld';
import { createBreadcrumbSchema } from '@/lib/seo/structured-data';

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) {
    return {
      title: 'Guide Not Found',
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const title = article.title;
  const canonicalUrl = `/help/${article.slug}`;

  return {
    title,
    description: article.description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${article.title} | WSNexa`,
      description: article.description,
      url: canonicalUrl,
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${article.title} | WSNexa`,
      description: article.description,
    },
  };
}

export default async function PublicHelpArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  const category = getCategoryById(article.category);
  const relatedArticles = (article.relatedArticles || [])
    .map((s) => getArticleBySlug(s))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  const breadcrumbs = [
    { name: 'Home', url: '/' },
    { name: 'Help Center', url: '/help' },
    ...(category ? [{ name: category.title, url: `/help/category/${category.id}` }] : []),
    { name: article.title, url: `/help/${article.slug}` },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 py-10 px-4 sm:px-6 lg:px-8">
      <JsonLd data={createBreadcrumbSchema(breadcrumbs)} />
      <HelpLanguageProvider>
        <HelpArticleView
          article={article}
          category={category}
          relatedArticles={relatedArticles}
          basePath="/help"
        />
      </HelpLanguageProvider>
    </div>
  );
}
