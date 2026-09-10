import React from 'react';
import Link from 'next/link';
import { getAllLegalDocuments, OFFICIAL_BUSINESS_INFO } from '@/content/legal/registry';

export const metadata = {
  title: 'Legal & Policy Center | WSNexa',
  description:
    'Authoritative terms, privacy policies, acceptable use standards, and compliance information for WSNexa hospitality platform.',
};

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const documents = getAllLegalDocuments();

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      {/* Top Banner: Pre-Commercial Legal Notice */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 py-2.5 px-4 text-center">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-xs font-semibold text-amber-900">
          <span>⚖️</span>
          <span>
            <strong>Notice:</strong> {OFFICIAL_BUSINESS_INFO.legalNotice}
          </span>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
          {/* Sidebar Navigation */}
          <aside className="lg:col-span-1 bg-white rounded-2xl border border-zinc-200 p-5 shadow-xs sticky top-24">
            <div className="space-y-4">
              <div>
                <Link
                  href="/legal"
                  className="text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-950 transition-colors"
                >
                  Legal Center
                </Link>
                <h2 className="text-base font-extrabold text-zinc-950 mt-1">Policies & Terms</h2>
              </div>

              <nav className="space-y-1">
                {documents.map((doc) => (
                  <Link
                    key={doc.id}
                    href={doc.href}
                    className="block px-3 py-2 text-xs font-bold rounded-xl text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 transition-all"
                  >
                    {doc.shortTitle}
                  </Link>
                ))}
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
            </div>
          </aside>

          {/* Document Content Area */}
          <main className="lg:col-span-3 bg-white rounded-3xl border border-zinc-200 p-6 sm:p-10 shadow-xs">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
