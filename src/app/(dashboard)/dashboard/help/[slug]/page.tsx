import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getArticleBySlug,
  getCategoryById,
  getAllArticles,
} from '@/content/help/registry';
import { Badge } from '@/components/ui/badge';
import { SupportFallbackCard } from '@/components/help/support-fallback-card';

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
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-bold text-zinc-500">
        <Link href="/dashboard/help" className="hover:text-zinc-950 transition-colors">
          Help Center
        </Link>
        <span>/</span>
        {category && (
          <>
            <Link
              href={`/dashboard/help/category/${category.id}`}
              className="hover:text-zinc-950 transition-colors"
            >
              {category.title}
            </Link>
            <span>/</span>
          </>
        )}
        <span className="text-zinc-900 truncate max-w-[200px] sm:max-w-none">
          {article.title}
        </span>
      </nav>

      {/* Article Header */}
      <div className="space-y-4 border-b border-zinc-200 pb-6">
        <div className="flex flex-wrap items-center gap-2">
          {category && (
            <Badge variant="neutral" className="text-[10px] font-extrabold uppercase tracking-wider">
              {category.icon} {category.title}
            </Badge>
          )}
          {article.troubleshooting && (
            <Badge variant="warning" className="text-[10px] font-extrabold">
              🔧 Troubleshooting
            </Badge>
          )}
          {article.comingSoon && (
            <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] font-extrabold">
              ✨ Coming Soon
            </Badge>
          )}
          <span className="text-xs text-zinc-400 font-semibold">
            • {article.estimatedReadMinutes || 3} min read
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight leading-tight">
          {article.title}
        </h1>

        <p className="text-sm sm:text-base font-semibold text-zinc-600 leading-relaxed">
          {article.description}
        </p>

        {article.directAction && (
          <div className="pt-2">
            <Link
              href={article.directAction.href}
              className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-zinc-950 px-5 py-2.5 text-xs font-extrabold text-white shadow-2xs hover:bg-zinc-800 active:scale-[0.97] transition-all cursor-pointer"
            >
              {article.directAction.label} →
            </Link>
          </div>
        )}
      </div>

      {/* Before You Start (Permissions & Roles) */}
      {(article.allowedRoles || article.requiredPermissions) && (
        <div className="rounded-2xl bg-zinc-50 border border-zinc-200 p-4 space-y-2 text-xs">
          <div className="font-extrabold text-zinc-950 flex items-center gap-1.5">
            <span>🛡️</span>
            <span>Before You Start: Permissions & Roles</span>
          </div>
          <p className="text-zinc-600 font-medium leading-relaxed">
            {article.allowedRoles && (
              <span>
                Applicable roles: <strong>{article.allowedRoles.join(', ')}</strong>.{' '}
              </span>
            )}
            {article.requiredPermissions && (
              <span>
                Required permissions: <code>{article.requiredPermissions.join(', ')}</code>.
              </span>
            )}
          </p>
        </div>
      )}

      {/* Step-by-Step Instructions */}
      <div className="space-y-4">
        <h2 className="text-lg font-black text-zinc-950 flex items-center gap-2">
          <span>📋</span>
          <span>Step-by-Step Guide</span>
        </h2>

        <div className="space-y-4">
          {article.steps.map((step) => (
            <div
              key={step.number}
              className="rounded-3xl border border-zinc-200 bg-white p-5 sm:p-6 space-y-2 shadow-2xs"
            >
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-zinc-950 text-white text-xs font-black flex items-center justify-center shrink-0">
                  {step.number}
                </span>
                <h3 className="text-sm sm:text-base font-extrabold text-zinc-950">
                  {step.title}
                </h3>
              </div>

              <div className="pl-9 space-y-2 text-xs sm:text-sm font-medium text-zinc-600 leading-relaxed">
                <p>{step.instruction}</p>
                {step.tip && (
                  <div className="rounded-2xl bg-amber-50/80 border border-amber-200/60 p-3 text-xs font-semibold text-amber-900 flex items-start gap-2">
                    <span className="text-sm shrink-0">💡</span>
                    <span>{step.tip}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Important Notes */}
      {article.notes && article.notes.length > 0 && (
        <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-6 space-y-3">
          <h3 className="text-sm font-extrabold text-zinc-950 flex items-center gap-2">
            <span>📌</span>
            <span>Important Notes</span>
          </h3>
          <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm font-medium text-zinc-600 leading-relaxed">
            {article.notes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Related Articles */}
      {relatedArticles.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-zinc-200">
          <h3 className="text-base font-extrabold text-zinc-950 flex items-center gap-2">
            <span>🔗</span>
            <span>Related Guides</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {relatedArticles.map((rel) => (
              <Link
                key={rel.slug}
                href={`/dashboard/help/${rel.slug}`}
                className="group block rounded-2xl border border-zinc-200 bg-white p-4 hover:border-zinc-300 hover:shadow-xs transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">📖</span>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-extrabold text-zinc-950 group-hover:text-amber-600 transition-colors truncate">
                      {rel.title}
                    </h4>
                    <p className="text-[11px] font-medium text-zinc-500 truncate mt-0.5">
                      {rel.description}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Support Fallback */}
      <SupportFallbackCard />
    </div>
  );
}
