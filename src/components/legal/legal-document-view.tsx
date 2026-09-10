import React from 'react';
import Link from 'next/link';
import { LegalDocumentMetadata } from '@/content/legal/types';
import { getAllLegalDocuments, OFFICIAL_BUSINESS_INFO } from '@/content/legal/registry';

interface LegalDocumentViewProps {
  document: LegalDocumentMetadata;
}

export function LegalDocumentView({ document }: LegalDocumentViewProps) {
  const allDocuments = getAllLegalDocuments();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
      {/* Desktop-Only Quick Directory Sidebar: Hidden on mobile so document content is immediately primary */}
      <aside className="hidden lg:block lg:col-span-1 bg-white rounded-2xl border border-zinc-200 p-5 shadow-xs lg:sticky lg:top-24 space-y-4">
        <div>
          <Link
            href="/legal"
            className="text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-950 transition-colors inline-flex items-center gap-1"
          >
            ← Legal Center
          </Link>
          <h2 className="text-base font-extrabold text-zinc-950 mt-1">Policies & Terms</h2>
        </div>

        <nav className="space-y-1">
          {allDocuments.map((doc) => {
            const isActive = doc.slug === document.slug;
            return (
              <Link
                key={doc.id}
                href={doc.href}
                className={`block px-3 py-2 text-xs font-bold rounded-xl transition-all ${
                  isActive
                    ? 'bg-zinc-950 text-white shadow-xs'
                    : 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950'
                }`}
              >
                {doc.shortTitle}
              </Link>
            );
          })}
        </nav>

        <div className="pt-4 border-t border-zinc-100 space-y-2 text-[11px] text-zinc-500 font-medium">
          <div>
            <span className="font-bold text-zinc-700">Official Support:</span>
            <br />
            <a
              href={`mailto:${OFFICIAL_BUSINESS_INFO.supportEmail}`}
              className="text-zinc-950 font-semibold hover:underline"
            >
              {OFFICIAL_BUSINESS_INFO.supportEmail}
            </a>
          </div>
          <div>
            <span className="font-bold text-zinc-700">Phone:</span>
            <br />
            <span>{OFFICIAL_BUSINESS_INFO.phone}</span>
          </div>
          <div>
            <span className="font-bold text-zinc-700">Address:</span>
            <br />
            <span>{OFFICIAL_BUSINESS_INFO.address}</span>
          </div>
        </div>
      </aside>

      {/* Primary Document Content Container */}
      <main className="w-full lg:col-span-3 bg-white rounded-2xl sm:rounded-3xl border border-zinc-200 p-5 sm:p-10 shadow-xs">
        <article className="space-y-8">
          {/* Header & Metadata Bar */}
          <header className="space-y-4 border-b border-zinc-200 pb-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link
                href="/legal"
                className="text-xs font-bold text-zinc-600 hover:text-zinc-950 transition-colors inline-flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-zinc-100 hover:bg-zinc-200"
              >
                <span>←</span>
                <span>Back to Legal Center</span>
              </Link>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-800 border border-zinc-200">
                  Version {document.version}
                </span>
                <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                  Pre-Commercial Draft
                </span>
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
              {document.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 font-semibold">
              <span>Effective Date: <strong>{document.effectiveDate}</strong></span>
              <span>•</span>
              <span>Last Updated: <strong>{document.lastUpdatedDate}</strong></span>
            </div>

            <p className="text-xs sm:text-sm text-zinc-600 font-medium leading-relaxed bg-zinc-50 p-4 rounded-xl border border-zinc-100">
              {document.summary}
            </p>
          </header>

          {/* Table of Contents */}
          <nav aria-label="Table of Contents" className="p-4 rounded-2xl bg-zinc-50/70 border border-zinc-100 space-y-2">
            <h2 className="text-xs font-black uppercase tracking-wider text-zinc-400">
              Table of Contents
            </h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {document.sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="text-zinc-700 hover:text-zinc-950 hover:underline font-semibold"
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Document Sections */}
          <div className="space-y-8 text-xs sm:text-sm text-zinc-700 leading-relaxed">
            {document.sections.map((section) => (
              <section key={section.id} id={section.id} className="space-y-3 pt-4 scroll-mt-24">
                <h2 className="text-base sm:text-lg font-bold text-zinc-950 border-b border-zinc-100 pb-2">
                  {section.title}
                </h2>

                {section.paragraphs && (
                  <div className="space-y-2.5">
                    {section.paragraphs.map((p, idx) => (
                      <p key={idx} className="font-medium">
                        {p}
                      </p>
                    ))}
                  </div>
                )}

                {section.bulletPoints && (
                  <ul className="list-disc pl-5 space-y-1.5 font-medium text-zinc-600">
                    {section.bulletPoints.map((bp, idx) => (
                      <li key={idx}>{bp}</li>
                    ))}
                  </ul>
                )}

                {section.subsections && (
                  <div className="space-y-4 pt-2">
                    {section.subsections.map((sub) => (
                      <div key={sub.id} id={sub.id} className="space-y-2 pl-3 border-l-2 border-zinc-200">
                        <h3 className="text-sm font-bold text-zinc-900">{sub.title}</h3>
                        {sub.paragraphs.map((p, idx) => (
                          <p key={idx} className="font-medium">
                            {p}
                          </p>
                        ))}
                        {sub.bulletPoints && (
                          <ul className="list-disc pl-5 space-y-1 text-zinc-600 font-medium">
                            {sub.bulletPoints.map((bp, idx) => (
                              <li key={idx}>{bp}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>

          {/* Footer Legal & Counsel Notice */}
          <footer className="pt-8 border-t border-zinc-200 space-y-3">
            <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/80 text-xs text-amber-900 font-medium leading-relaxed">
              <strong>Notice of Legal Qualification:</strong> This document represents WSNexa’s actual product architecture and operational terms for testing and pilot deployments. Prior to formal commercial rollout in Sri Lanka, these terms must be formally evaluated and certified by qualified legal counsel.
            </div>
            <div className="text-xs text-zinc-500 font-medium flex flex-wrap justify-between gap-2">
              <span>Questions or Notices: <a href={`mailto:${OFFICIAL_BUSINESS_INFO.supportEmail}`} className="text-zinc-950 font-bold hover:underline">{OFFICIAL_BUSINESS_INFO.supportEmail}</a></span>
              <span>{OFFICIAL_BUSINESS_INFO.address}</span>
            </div>
          </footer>
        </article>
      </main>
    </div>
  );
}
