import React from 'react';
import Link from 'next/link';
import { getAllCategories, getPopularArticles, getTroubleshootingArticles } from '@/content/help/registry';
import { OFFICIAL_BUSINESS_INFO } from '@/content/legal/registry';
import { WSNexaLogo } from '@/components/brand/wsnexa-logo';

export const metadata = {
  title: 'Help Center & Documentation | WSNexa',
  description:
    'Comprehensive guides, operational manuals, setup tutorials, and troubleshooting for the WSNexa hospitality platform.',
};

export default function PublicHelpCenterPage() {
  const categories = getAllCategories();
  const popularArticles = getPopularArticles().slice(0, 6);
  const troubleshooting = getTroubleshootingArticles().slice(0, 4);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 pb-16">
      {/* Hero Header */}
      <section className="bg-zinc-950 text-white py-16 px-4 sm:px-6 lg:px-8 border-b border-zinc-800">
        <div className="max-w-5xl mx-auto text-center space-y-4">
          <div className="flex justify-center pb-1">
            <WSNexaLogo variant="full" size="lg" priority />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-800 text-zinc-300 text-xs font-bold uppercase tracking-wider">
            <span>📖</span>
            <span>WSNexa Knowledge Base</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight">
            How can we help you today?
          </h1>
          <p className="text-sm sm:text-base text-zinc-400 font-medium max-w-xl mx-auto leading-relaxed">
            Explore comprehensive guides for configuring your venue, managing digital menus, streamlining kitchen queues, and resolving issues.
          </p>

          <div className="pt-4 flex flex-wrap justify-center gap-3 text-xs font-bold">
            <Link
              href="/support/contact"
              className="px-4 py-2.5 rounded-xl bg-white text-zinc-950 hover:bg-zinc-100 transition-all shadow-xs"
            >
              Contact Support
            </Link>
            <Link
              href="/support/report-problem"
              className="px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-200 hover:bg-zinc-800 transition-all"
            >
              Report a Problem
            </Link>
            <Link
              href="/status"
              className="px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-200 hover:bg-zinc-800 transition-all"
            >
              System Status
            </Link>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 space-y-12">
        {/* Popular Articles */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
            <h2 className="text-lg font-black text-zinc-950 flex items-center gap-2">
              <span>⭐</span>
              <span>Popular Guides & Quick Answers</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {popularArticles.map((art) => (
              <Link
                key={art.slug}
                href={`/dashboard/help/${art.slug}`}
                className="bg-white p-5 rounded-2xl border border-zinc-200 hover:border-zinc-950 transition-all shadow-2xs group flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-extrabold uppercase text-zinc-400">
                    <span>Guide</span>
                    <span>{art.estimatedReadMinutes || 3} min read</span>
                  </div>
                  <h3 className="text-sm font-bold text-zinc-950 group-hover:text-zinc-800">
                    {art.title}
                  </h3>
                  <p className="text-xs text-zinc-500 font-medium line-clamp-2">
                    {art.description}
                  </p>
                </div>
                <div className="pt-3 mt-3 border-t border-zinc-100 text-xs font-bold text-zinc-950 flex items-center justify-between">
                  <span>Read Guide</span>
                  <span>→</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Operational Categories */}
        <section className="space-y-4">
          <div className="border-b border-zinc-200 pb-3">
            <h2 className="text-lg font-black text-zinc-950 flex items-center gap-2">
              <span>🗂️</span>
              <span>Browse by Operational Category</span>
            </h2>
            <p className="text-xs text-zinc-500 font-medium">
              Guides organized by hospitality module, system role, and venue setup.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="bg-white p-5 rounded-2xl border border-zinc-200 hover:border-zinc-950 transition-all shadow-2xs flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-xl">
                    {cat.icon}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-950">{cat.title}</h3>
                    <p className="text-xs text-zinc-500 font-medium mt-1 leading-relaxed">
                      {cat.description}
                    </p>
                  </div>
                </div>
                <div className="pt-4 mt-4 border-t border-zinc-100">
                  <Link
                    href={`/dashboard/help/category/${cat.id}`}
                    className="text-xs font-bold text-zinc-950 hover:underline inline-flex items-center gap-1"
                  >
                    View Category Guides →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Troubleshooting Section */}
        {troubleshooting.length > 0 && (
          <section className="space-y-4">
            <div className="border-b border-zinc-200 pb-3">
              <h2 className="text-lg font-black text-zinc-950 flex items-center gap-2">
                <span>🔧</span>
                <span>Troubleshooting & Common Diagnostic Fixes</span>
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {troubleshooting.map((art) => (
                <Link
                  key={art.slug}
                  href={`/dashboard/help/${art.slug}`}
                  className="bg-white p-5 rounded-2xl border border-zinc-200 hover:border-zinc-950 transition-all shadow-2xs flex flex-col justify-between group"
                >
                  <div className="space-y-2">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200">
                      Troubleshooting
                    </span>
                    <h3 className="text-sm font-bold text-zinc-950 group-hover:text-zinc-800">
                      {art.title}
                    </h3>
                    <p className="text-xs text-zinc-500 font-medium line-clamp-2">
                      {art.description}
                    </p>
                  </div>
                  <div className="pt-3 mt-3 border-t border-zinc-100 text-xs font-bold text-zinc-950 flex items-center justify-between">
                    <span>View Resolution</span>
                    <span>→</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Support Channels Banner */}
        <section className="rounded-3xl bg-white border border-zinc-200 p-8 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center sm:text-left">
            <h3 className="text-lg font-black text-zinc-950">
              Need personalized assistance with your venue?
            </h3>
            <p className="text-xs text-zinc-600 font-medium max-w-xl leading-relaxed">
              Our support desk is available to assist hospitality business owners and staff with account onboarding, menu configuration, hardware connectivity, and billing.
            </p>
            <div className="pt-2 flex flex-wrap gap-4 text-xs text-zinc-500 font-semibold justify-center sm:justify-start">
              <span>Email: <strong>{OFFICIAL_BUSINESS_INFO.supportEmail}</strong></span>
              <span>Phone: <strong>{OFFICIAL_BUSINESS_INFO.phone}</strong></span>
              <span>Location: <strong>{OFFICIAL_BUSINESS_INFO.address}</strong></span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Link
              href="/support/contact"
              className="px-5 py-3 rounded-xl bg-zinc-950 text-white font-bold text-xs hover:bg-zinc-800 transition-all text-center shadow-xs"
            >
              Contact Support
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
