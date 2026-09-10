import React from 'react';
import Link from 'next/link';
import { ContactSupportForm } from '@/components/support/contact-support-form';
import { OFFICIAL_BUSINESS_INFO } from '@/content/legal/registry';

export const metadata = {
  title: 'Contact Support | WSNexa',
  description: 'Reach WSNexa support desk for operational assistance, menu setup, billing, and technical guidance.',
};

export default function ContactSupportPage() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-3 text-center sm:text-left border-b border-zinc-200 pb-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link
              href="/help"
              className="text-xs font-bold text-zinc-500 hover:text-zinc-950 transition-colors inline-flex items-center gap-1"
            >
              ← Back to Help Center
            </Link>
            <span className="text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-700">
              Support Desk
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight">
            Contact WSNexa Support
          </h1>
          <p className="text-xs sm:text-sm text-zinc-600 font-medium max-w-2xl leading-relaxed">
            Have a question about configuring dining tables, managing live kitchen tickets, or managing your SaaS subscription? Submit your inquiry below and our team will get back to you.
          </p>
        </div>

        {/* Quick Contact Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-2xs space-y-1">
            <span className="text-xl">📧</span>
            <h2 className="text-xs font-bold text-zinc-950">Official Email</h2>
            <p className="text-xs text-zinc-500 font-medium">
              <a
                href={`mailto:${OFFICIAL_BUSINESS_INFO.supportEmail}`}
                className="hover:underline text-zinc-900 font-semibold"
              >
                {OFFICIAL_BUSINESS_INFO.supportEmail}
              </a>
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-2xs space-y-1">
            <span className="text-xl">📞</span>
            <h2 className="text-xs font-bold text-zinc-950">Telephone</h2>
            <p className="text-xs text-zinc-900 font-semibold">
              {OFFICIAL_BUSINESS_INFO.phone}
            </p>
            <p className="text-[10px] text-zinc-400 font-medium">Standard Sri Lankan business hours</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-2xs space-y-1">
            <span className="text-xl">📍</span>
            <h2 className="text-xs font-bold text-zinc-950">Location</h2>
            <p className="text-xs text-zinc-900 font-semibold">
              {OFFICIAL_BUSINESS_INFO.address}
            </p>
          </div>
        </div>

        {/* Support Form */}
        <ContactSupportForm />
      </div>
    </div>
  );
}
