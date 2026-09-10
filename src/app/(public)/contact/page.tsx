import React from 'react';
import Link from 'next/link';
import { OFFICIAL_BUSINESS_INFO } from '@/content/legal/registry';
import { WSNexaLogo } from '@/components/brand/wsnexa-logo';

export const metadata = {
  title: 'Contact WSNexa | Corporate & Support Contact',
  description: 'Connect with WSNexa for general business inquiries, customer support desk, or security disclosures.',
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="flex justify-center pb-2">
            <WSNexaLogo variant="full" size="lg" priority />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 text-zinc-700 text-xs font-bold uppercase tracking-wider">
            <span>📞</span>
            <span>Get in Touch</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-zinc-950 tracking-tight">
            Contact WSNexa
          </h1>
          <p className="text-xs sm:text-sm text-zinc-600 font-medium leading-relaxed">
            We are here to assist hospitality business owners, staff members, partners, and diners. Choose the direct channel that best fits your inquiry.
          </p>
        </div>

        {/* 3 Distinct Contact Portals */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 1. General Business Inquiries */}
          <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-xs flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <span className="text-2xl p-3 bg-zinc-100 rounded-2xl inline-block">🏢</span>
              <h2 className="text-base font-extrabold text-zinc-950">General Business</h2>
              <p className="text-xs text-zinc-500 font-medium leading-relaxed">
                For commercial inquiries, pilot venue onboarding, partnership proposals, and corporate questions.
              </p>
            </div>
            <div className="pt-4 border-t border-zinc-100 space-y-1 text-xs">
              <p className="text-zinc-400 font-semibold text-[11px]">Primary Contact</p>
              <a
                href={`mailto:${OFFICIAL_BUSINESS_INFO.supportEmail}`}
                className="font-bold text-zinc-950 hover:underline block truncate"
              >
                {OFFICIAL_BUSINESS_INFO.supportEmail}
              </a>
              <p className="font-semibold text-zinc-700 pt-1">{OFFICIAL_BUSINESS_INFO.phone}</p>
            </div>
          </div>

          {/* 2. Customer & Operational Support */}
          <div className="bg-white rounded-3xl border border-zinc-950 p-6 shadow-xs flex flex-col justify-between space-y-4 relative">
            <div className="absolute -top-3 right-5">
              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-zinc-950 text-white">
                Fastest Response
              </span>
            </div>
            <div className="space-y-3">
              <span className="text-2xl p-3 bg-zinc-100 rounded-2xl inline-block">💬</span>
              <h2 className="text-base font-extrabold text-zinc-950">Support & Help Desk</h2>
              <p className="text-xs text-zinc-500 font-medium leading-relaxed">
                For active venue operators, managers, and cashiers needing help with orders, menu publishing, or billing.
              </p>
            </div>
            <div className="pt-4 border-t border-zinc-100 space-y-2">
              <Link
                href="/support/contact"
                className="w-full py-2.5 rounded-xl bg-zinc-950 text-white text-xs font-bold text-center block hover:bg-zinc-800 transition-all shadow-xs"
              >
                Open Support Ticket →
              </Link>
              <Link
                href="/support/report-problem"
                className="w-full py-2 rounded-xl bg-zinc-100 text-zinc-700 text-xs font-bold text-center block hover:bg-zinc-200 transition-all"
              >
                Report a Bug
              </Link>
            </div>
          </div>

          {/* 3. Security & Responsible Disclosure */}
          <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-xs flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <span className="text-2xl p-3 bg-zinc-100 rounded-2xl inline-block">🛡️</span>
              <h2 className="text-base font-extrabold text-zinc-950">Security Inquiries</h2>
              <p className="text-xs text-zinc-500 font-medium leading-relaxed">
                For security researchers reporting vulnerabilities, privacy inquiries, or data protection matters.
              </p>
            </div>
            <div className="pt-4 border-t border-zinc-100 space-y-2">
              <Link
                href="/security/report"
                className="w-full py-2.5 rounded-xl bg-zinc-900 text-zinc-200 text-xs font-bold text-center block hover:bg-zinc-800 transition-all"
              >
                Submit Disclosure →
              </Link>
              <Link
                href="/legal/security"
                className="text-[11px] text-zinc-500 font-semibold hover:underline block text-center"
              >
                View Security Policy
              </Link>
            </div>
          </div>
        </div>

        {/* Corporate Address & Operating Notice */}
        <div className="bg-white rounded-3xl border border-zinc-200 p-8 shadow-xs space-y-4">
          <h2 className="text-base font-black text-zinc-950">
            WSNexa Business Address
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs font-medium text-zinc-600">
            <div>
              <span className="font-bold text-zinc-950 block mb-1">Business Address</span>
              <p>{OFFICIAL_BUSINESS_INFO.address}</p>
            </div>
            <div>
              <span className="font-bold text-zinc-950 block mb-1">Telephone</span>
              <p>{OFFICIAL_BUSINESS_INFO.phone}</p>
              <p className="text-[11px] text-zinc-400">Monday - Friday (08:30 - 17:30 IST)</p>
            </div>
            <div>
              <span className="font-bold text-zinc-950 block mb-1">Electronic Support</span>
              <a href={`mailto:${OFFICIAL_BUSINESS_INFO.supportEmail}`} className="text-zinc-950 font-bold hover:underline">
                {OFFICIAL_BUSINESS_INFO.supportEmail}
              </a>
              <p className="text-[11px] text-zinc-400">Response within 24 to 48 business hours</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
