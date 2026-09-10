import React from 'react';
import Link from 'next/link';
import { SecurityReportForm } from '@/components/support/security-report-form';
import { OFFICIAL_BUSINESS_INFO } from '@/content/legal/registry';

export const metadata = {
  title: 'Security Vulnerability Report | WSNexa',
  description: 'Submit coordinated vulnerability reports and responsible security disclosures to the WSNexa security team.',
};

export default function SecurityReportPage() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-3 text-center sm:text-left border-b border-zinc-200 pb-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link
              href="/legal/security"
              className="text-xs font-bold text-zinc-500 hover:text-zinc-950 transition-colors inline-flex items-center gap-1"
            >
              ← Security & Disclosure Policy
            </Link>
            <span className="text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-800">
              Coordinated Disclosure
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight">
            Responsible Security Disclosure
          </h1>
          <p className="text-xs sm:text-sm text-zinc-600 font-medium max-w-2xl leading-relaxed">
            WSNexa values the contributions of ethical security researchers. If you have identified a vulnerability or potential security risk in our platform, please submit your findings below.
          </p>
          <p className="text-xs text-zinc-500 font-medium">
            Direct security contact: <strong>{OFFICIAL_BUSINESS_INFO.supportEmail}</strong>
          </p>
        </div>

        <SecurityReportForm />
      </div>
    </div>
  );
}
