import React from 'react';
import Link from 'next/link';
import { LegalDocumentMetadata } from '@/content/legal/types';
import { OFFICIAL_BUSINESS_INFO } from '@/content/legal/registry';

interface LegalDocumentViewProps {
  document: LegalDocumentMetadata;
}

export function LegalDocumentView({ document }: LegalDocumentViewProps) {
  return (
    <article className="space-y-8">
      {/* Header & Metadata Bar */}
      <header className="space-y-4 border-b border-zinc-200 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href="/legal"
            className="text-xs font-bold text-zinc-500 hover:text-zinc-950 transition-colors inline-flex items-center gap-1"
          >
            ← Back to Legal Directory
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
  );
}
