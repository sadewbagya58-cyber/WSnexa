import React from 'react';
import { OFFICIAL_BUSINESS_INFO } from '@/content/legal/registry';

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        {children}
      </div>
    </div>
  );
}
