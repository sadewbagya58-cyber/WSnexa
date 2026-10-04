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

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) return { title: 'Guide Not Found | WSNexa Help' };

  return {
    title: `${article.title} | WSNexa Help Center`,
    description: article.description,
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

  return (
    <div className="min-h-screen bg-zinc-50 py-10 px-4 sm:px-6 lg:px-8">
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
