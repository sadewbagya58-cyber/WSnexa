import React from 'react';
import Link from 'next/link';
import { OFFICIAL_BUSINESS_INFO } from '@/content/legal/registry';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-zinc-200 bg-white text-zinc-600">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Brand & Address Column (2 cols wide on large screens) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-zinc-950 text-white font-black text-base flex items-center justify-center rounded-lg shadow-xs">
                W
              </div>
              <span className="text-lg font-black tracking-wider uppercase text-zinc-950">
                {OFFICIAL_BUSINESS_INFO.brand}
              </span>
              <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-600 border border-zinc-200 uppercase">
                OS
              </span>
            </div>

            <p className="text-xs font-bold text-zinc-900 tracking-tight">
              {OFFICIAL_BUSINESS_INFO.tagline}
            </p>

            <p className="text-xs text-zinc-500 max-w-sm leading-relaxed font-medium">
              Multi-tenant hospitality management software engineered for dining venues, restaurants, cafes, and hotels.
            </p>

            <div className="pt-2 space-y-1 text-xs text-zinc-500 font-medium">
              <div>
                <span className="font-bold text-zinc-700">Official Support:</span>{' '}
                <a
                  href={`mailto:${OFFICIAL_BUSINESS_INFO.supportEmail}`}
                  className="text-zinc-950 font-semibold hover:underline"
                >
                  {OFFICIAL_BUSINESS_INFO.supportEmail}
                </a>
              </div>
              <div>
                <span className="font-bold text-zinc-700">Phone:</span>{' '}
                <span>{OFFICIAL_BUSINESS_INFO.phone}</span>
              </div>
              <div>
                <span className="font-bold text-zinc-700">Location:</span>{' '}
                <span>{OFFICIAL_BUSINESS_INFO.address}</span>
              </div>
            </div>
          </div>

          {/* Column 1: LEGAL (8 links) */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-950">
              Legal
            </h3>
            <ul className="space-y-2 text-xs font-medium">
              <li>
                <Link href="/legal/terms" className="hover:text-zinc-950 transition-colors">
                  Terms & Conditions
                </Link>
              </li>
              <li>
                <Link href="/legal/privacy" className="hover:text-zinc-950 transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/legal/cookies" className="hover:text-zinc-950 transition-colors">
                  Cookie Policy
                </Link>
              </li>
              <li>
                <Link href="/legal/acceptable-use" className="hover:text-zinc-950 transition-colors">
                  Acceptable Use
                </Link>
              </li>
              <li>
                <Link href="/legal/subscription-billing" className="hover:text-zinc-950 transition-colors">
                  Subscription & Billing
                </Link>
              </li>
              <li>
                <Link href="/legal/refund-cancellation" className="hover:text-zinc-950 transition-colors">
                  Refund & Cancellation
                </Link>
              </li>
              <li>
                <Link href="/legal/data-deletion" className="hover:text-zinc-950 transition-colors">
                  Data & Account Deletion
                </Link>
              </li>
              <li>
                <Link href="/legal/security" className="hover:text-zinc-950 transition-colors">
                  Security & Disclosure
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 2: SUPPORT (5 links) */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-950">
              Support
            </h3>
            <ul className="space-y-2 text-xs font-medium">
              <li>
                <Link href="/help" className="hover:text-zinc-950 transition-colors">
                  Help Center
                </Link>
              </li>
              <li>
                <Link href="/support/contact" className="hover:text-zinc-950 transition-colors">
                  Contact Support
                </Link>
              </li>
              <li>
                <Link href="/support/report-problem" className="hover:text-zinc-950 transition-colors">
                  Report a Problem
                </Link>
              </li>
              <li>
                <Link href="/security/report" className="hover:text-zinc-950 transition-colors">
                  Security Report
                </Link>
              </li>
              <li>
                <Link href="/status" className="hover:text-zinc-950 transition-colors flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>System Status</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: COMPANY (3 links) */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-950">
              Company
            </h3>
            <ul className="space-y-2 text-xs font-medium">
              <li>
                <Link href="/about" className="hover:text-zinc-950 transition-colors">
                  About WSNexa
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-zinc-950 transition-colors">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/status" className="hover:text-zinc-950 transition-colors">
                  Service Status
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Copyright and Legal Counsel Review Notice */}
        <div className="mt-12 pt-8 border-t border-zinc-200/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-zinc-500">
          <p>
            &copy; {currentYear} {OFFICIAL_BUSINESS_INFO.brand}. All rights reserved.
          </p>
          <p className="text-center sm:text-right max-w-xl text-[10px] text-zinc-400">
            WSNexa platform policies are prepared to support operational transparency and applicable data protection principles under Sri Lankan law. These documents are pre-commercial drafts subject to formal legal review before commercial rollout.
          </p>
        </div>
      </div>
    </footer>
  );
};
