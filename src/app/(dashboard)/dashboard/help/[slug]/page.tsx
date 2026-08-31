import React from 'react';
import { notFound } from 'next/navigation';
import {
  getArticleBySlug,
  getCategoryById,
  getAllArticles,
} from '@/content/help/registry';
import { HelpArticleView } from '@/components/help/help-article-view';

interface ArticlePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const articles = getAllArticles();
  return articles.map((a) => ({
    slug: a.slug,
  }));
}

export default async function HelpArticlePage({ params }: ArticlePageProps) {
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
    <HelpArticleView
      article={article}
      category={category}
      relatedArticles={relatedArticles}
    />
  );
}

