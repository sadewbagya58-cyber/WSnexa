import React from 'react';
import Link from 'next/link';
import { getAllLegalDocuments, OFFICIAL_BUSINESS_INFO } from '@/content/legal/registry';

export const metadata = {
  title: 'Legal & Policy Directory | WSNexa',
  description:
    'Complete directory of legal policies, data protection commitments, acceptable use standards, and terms of service for WSNexa.',
};

export default function LegalHubPage() {
  const documents = getAllLegalDocuments();

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="space-y-3 border-b border-zinc-200 pb-6">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-700 text-[11px] font-extrabold uppercase tracking-wider">
          <span>📜</span>
          <span>Trust & Transparency</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight">
          Legal & Policy Directory
        </h1>
        <p className="text-sm text-zinc-600 font-medium max-w-2xl leading-relaxed">
          Review the authoritative policies, operational guidelines, and privacy commitments governing the WSNexa hospitality platform. These documents reflect our actual technical architecture and data flows.
        </p>
      </div>

      {/* Legal Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="rounded-2xl border border-zinc-200 p-5 bg-white hover:border-zinc-950 transition-all flex flex-col justify-between group shadow-2xs"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold text-zinc-400 uppercase tracking-wider">
                  v{doc.version}
                </span>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                  Pre-Commercial Review
                </span>
              </div>
              <h2 className="text-base font-extrabold text-zinc-950 group-hover:text-zinc-800 transition-colors">
                {doc.title}
              </h2>
              <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                {doc.summary}
              </p>
            </div>

            <div className="pt-4 mt-4 border-t border-zinc-100 flex items-center justify-between text-xs">
              <span className="text-[11px] text-zinc-400 font-semibold">
                Updated: {doc.lastUpdatedDate}
              </span>
              <Link
                href={doc.href}
                className="font-bold text-zinc-950 hover:underline inline-flex items-center gap-1"
              >
                Read Policy →
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Compliance & Regulatory Basis Notice */}
      <div className="rounded-2xl bg-zinc-50 border border-zinc-200 p-6 space-y-4">
        <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950 flex items-center gap-2">
          <span>🇱🇰</span>
          <span>Regulatory & Legal Basis</span>
        </h3>
        <p className="text-xs text-zinc-600 leading-relaxed font-medium">
          WSNexa is designed to support applicable data protection obligations under the{' '}
          <strong>Personal Data Protection Act No. 9 of 2022</strong> and the{' '}
          <strong>Personal Data Protection (Amendment) Act No. 22 of 2025</strong> of Sri Lanka (operational from 18 March 2025). Commercial terms and refund mechanics are aligned with the principles of the{' '}
          <strong>Consumer Affairs Authority Act No. 9 of 2003</strong>.
        </p>
        <div className="text-xs text-zinc-500 pt-2 border-t border-zinc-200/60 flex flex-wrap gap-x-6 gap-y-1 font-semibold">
          <span>Official Contact: {OFFICIAL_BUSINESS_INFO.supportEmail}</span>
          <span>Telephone: {OFFICIAL_BUSINESS_INFO.phone}</span>
          <span>Location: {OFFICIAL_BUSINESS_INFO.address}</span>
        </div>
      </div>
    </div>
  );
}
