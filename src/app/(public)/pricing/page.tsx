import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { SUBSCRIPTION_PRICING_CONFIG } from '@/lib/config/subscription-plans';
import { OFFICIAL_BUSINESS_INFO } from '@/content/legal/registry';

export const metadata: Metadata = {
  title: 'Subscription Pricing & Plans | WSNexa',
  description:
    'Transparent, honest subscription pricing in Sri Lankan Rupees (LKR) for hotels, restaurants, cafes, and hospitality venues. Includes a 14-day free evaluation trial.',
};

export default function PricingPage() {
  const plans = [
    {
      code: 'starter',
      name: 'Starter',
      tagline: 'Ideal for independent cafes, bistros, and single-outlet restaurants.',
      price: SUBSCRIPTION_PRICING_CONFIG.starterMonthlyLkr,
      priceFormatted: `LKR ${SUBSCRIPTION_PRICING_CONFIG.starterMonthlyLkr.toLocaleString()}`,
      period: '/ month',
      badge: 'Evaluation Ready',
      isPopular: false,
      features: [
        '1 Branch Outlet location',
        'Up to 10 active staff accounts',
        'Up to 50 dining tables with QR codes',
        'Up to 250 digital menu items & modifiers',
        'Up to 3 custom operational roles',
        'Real-time Live Orders Queue',
        'Waiter ordering interface',
        'Kitchen Display System (KDS)',
        'Cashier POS & settlement receipt printing',
        'Standard email & ticketing support',
      ],
      ctaText: 'Start 14-Day Free Trial',
      ctaHref: '/register',
    },
    {
      code: 'growth',
      name: 'Growth',
      tagline: 'Designed for busy restaurants, hotel dining outlets, and expanding multi-area venues.',
      price: SUBSCRIPTION_PRICING_CONFIG.growthMonthlyLkr,
      priceFormatted: `LKR ${SUBSCRIPTION_PRICING_CONFIG.growthMonthlyLkr.toLocaleString()}`,
      period: '/ month',
      badge: 'Most Popular',
      isPopular: true,
      features: [
        'Up to 3 Branch Outlet locations',
        'Up to 40 active staff accounts',
        'Up to 200 dining tables with QR codes',
        'Up to 1,000 digital menu items & modifiers',
        'Up to 15 custom operational roles',
        'Service Area floor boundaries & zone routing',
        'Kitchen Display System with cancellation alerts',
        'Recipe Bill of Materials (BOM) inventory',
        'Customer loyalty points & rewards program',
        'Priority email & telephone support',
      ],
      ctaText: 'Start 14-Day Free Trial',
      ctaHref: '/register',
    },
    {
      code: 'enterprise',
      name: 'Enterprise',
      tagline: 'Tailored for hotel chains, resort groups, and large-scale food service operations.',
      price: SUBSCRIPTION_PRICING_CONFIG.enterpriseBaseMonthlyLkr,
      priceFormatted: `LKR ${SUBSCRIPTION_PRICING_CONFIG.enterpriseBaseMonthlyLkr.toLocaleString()}`,
      period: '/ month base',
      badge: 'Custom Scale',
      isPopular: false,
      features: [
        'Base includes 5 branches & 75 staff accounts',
        'Additional branches at LKR 3,000 / month each',
        'Additional staff blocks (25 accounts) at LKR 2,000 / month',
        'Unlimited dining tables & QR codes',
        'Unlimited menu items & modifier groups',
        'Unlimited custom operational roles & granular RBAC',
        'Multi-department organizational hierarchy',
        'Advanced financial, audit & cancellation analytics',
        'Dedicated onboarding & technical account manager',
        'Custom SLA & direct phone assistance',
      ],
      ctaText: 'Contact Sales / Custom Setup',
      ctaHref: '/contact',
    },
  ];

  const faqs = [
    {
      question: 'How does the 14-day free evaluation trial work?',
      answer:
        'When you register a new business account on WSNexa, you automatically receive 14 days of full access to explore the platform. No credit card or upfront payment is required to start your trial. You can configure your branch, create your menu, generate QR codes, and test the kitchen and cashier workflows with your team.',
    },
    {
      question: 'What happens when my free trial expires?',
      answer:
        'When your 14-day trial concludes, your account enters a 7-day grace period during which operational access continues uninterrupted. After the grace period, if a subscription payment has not been settled, administrative access to your workspace is paused, while your public digital menu remains viewable in read-only mode so dining guests are not disrupted. You can reactivate anytime from your Subscription Settings.',
    },
    {
      question: 'In what currency are subscription fees billed?',
      answer:
        'All subscription fees are denominated and billed in Sri Lankan Rupees (LKR). Indicative rates reflect pre-commercial configurations and are exclusive of applicable government levies or statutory taxes unless explicitly stated.',
    },
    {
      question: 'How do I pay for my subscription?',
      answer:
        'WSNexa is currently in a pre-commercial evaluation phase. Subscription billing is coordinated directly between WSNexa and the Business Owner via direct settlement or official bank invoicing. Technical integrations for automated online payment gateways licensed in Sri Lanka are under active development and will be activated upon formal commercial release.',
    },
    {
      question: 'Can I upgrade, downgrade, or cancel my subscription at any time?',
      answer:
        'Yes. You can upgrade your plan at any time through Dashboard Settings → Subscription & Billing; upgraded limits take effect immediately. Downgrades take effect at the conclusion of your prepaid monthly billing period, provided your resource usage (branches, staff, tables) fits within the destination tier. You may cancel your subscription at any time without penalty.',
    },
    {
      question: 'What is your refund policy?',
      answer:
        'WSNexa operates an explicit dual-tier policy. For SaaS subscriptions (Tier A), initial evaluation subscriptions include a 7-calendar-day satisfaction refund window from first activation. Prepaid monthly subscription renewals are non-refundable once the billing cycle begins. Dining guest food orders (Tier B) are governed by the individual hospitality venue’s cancellation policy and the Sri Lanka Consumer Affairs Authority Act No. 9 of 2003.',
    },
  ];

  return (
    <div className="bg-zinc-50 min-h-screen text-zinc-950 font-sans pb-20">
      {/* Hero Header */}
      <section className="bg-white border-b border-zinc-200 py-16 px-4 sm:px-6 lg:px-8 text-center">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-zinc-700 shadow-2xs">
            <span>🇱🇰</span>
            <span>Simple, Transparent Pricing in LKR</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-zinc-950">
            Predictable Plans for Every Venue
          </h1>

          <p className="max-w-2xl mx-auto text-sm sm:text-base text-zinc-600 font-medium leading-relaxed">
            All plans include core table ordering, KDS, cashier POS, and team management. Start with a 14-day free trial — no credit card required.
          </p>

          <div className="pt-2 flex flex-wrap justify-center gap-3 text-xs font-semibold text-zinc-500">
            <span>✓ 14-day free trial</span>
            <span>•</span>
            <span>✓ No setup fees</span>
            <span>•</span>
            <span>✓ Cancel anytime</span>
            <span>•</span>
            <span>✓ 7-day grace period</span>
          </div>
        </div>
      </section>

      {/* Pricing Cards Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 pt-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {plans.map((p) => (
            <div
              key={p.code}
              className={`rounded-3xl p-8 flex flex-col justify-between transition-all relative ${
                p.isPopular
                  ? 'bg-zinc-950 text-white shadow-xl ring-2 ring-zinc-950'
                  : 'bg-white text-zinc-950 border border-zinc-200 shadow-sm hover:shadow-md'
              }`}
            >
              {p.isPopular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="bg-amber-500 text-zinc-950 text-[10px] font-black uppercase tracking-wider px-3.5 py-1 rounded-full shadow-sm">
                    {p.badge}
                  </span>
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black uppercase tracking-tight">{p.name}</h2>
                    {!p.isPopular && (
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-700">
                        {p.badge}
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-xs mt-2 leading-relaxed font-medium ${
                      p.isPopular ? 'text-zinc-400' : 'text-zinc-500'
                    }`}
                  >
                    {p.tagline}
                  </p>
                </div>

                <div className="border-t border-b py-4 my-2 divide-y divide-zinc-200/20">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight">
                      {p.priceFormatted}
                    </span>
                    <span
                      className={`text-xs font-semibold ${
                        p.isPopular ? 'text-zinc-400' : 'text-zinc-500'
                      }`}
                    >
                      {p.period}
                    </span>
                  </div>
                  <p
                    className={`text-[11px] pt-1 font-medium ${
                      p.isPopular ? 'text-zinc-400' : 'text-zinc-500'
                    }`}
                  >
                    Billed monthly in Sri Lankan Rupees • Exclusive of local taxes
                  </p>
                </div>

                {/* Feature Checklist */}
                <div className="space-y-3">
                  <div
                    className={`text-[11px] font-black uppercase tracking-wider ${
                      p.isPopular ? 'text-zinc-300' : 'text-zinc-900'
                    }`}
                  >
                    What&apos;s Included:
                  </div>
                  <ul className="space-y-2.5 text-xs font-medium">
                    {p.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <span
                          className={`font-bold ${
                            p.isPopular ? 'text-emerald-400' : 'text-emerald-600'
                          }`}
                        >
                          ✓
                        </span>
                        <span className={p.isPopular ? 'text-zinc-200' : 'text-zinc-700'}>
                          {feat}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-8 mt-6 border-t border-zinc-200/20">
                <Link
                  href={p.ctaHref}
                  className={`w-full py-3.5 px-4 rounded-xl text-xs font-extrabold uppercase tracking-widest text-center block transition-all shadow-xs active:scale-95 ${
                    p.isPopular
                      ? 'bg-white text-zinc-950 hover:bg-zinc-100 shadow-md'
                      : 'bg-zinc-950 text-white hover:bg-zinc-800'
                  }`}
                >
                  {p.ctaText} →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Free Trial Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16">
        <div className="bg-white rounded-3xl border border-zinc-200 p-8 sm:p-10 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left max-w-2xl">
            <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 inline-block">
              Risk-Free Evaluation
            </span>
            <h2 className="text-2xl font-black text-zinc-950">
              Try WSNexa with your team for 14 days
            </h2>
            <p className="text-xs sm:text-sm text-zinc-600 font-medium leading-relaxed">
              Explore table QR menus, waiter workflows, KDS queues, and cashier settlement with zero upfront financial commitment. If you need more time, a 7-day grace period is provided automatically.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <Link
              href="/register"
              className="px-6 py-3.5 rounded-xl bg-zinc-950 text-white text-xs font-extrabold uppercase tracking-widest text-center hover:bg-zinc-800 transition-all shadow-md active:scale-95"
            >
              Get Started Free →
            </Link>
            <Link
              href="/help"
              className="px-5 py-3.5 rounded-xl bg-zinc-100 text-zinc-800 text-xs font-bold text-center hover:bg-zinc-200 transition-all"
            >
              Explore Guides
            </Link>
          </div>
        </div>
      </section>

      {/* Frequently Asked Questions */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-zinc-950">
            Frequently Asked Questions
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500 font-medium">
            Everything you need to know about WSNexa subscription billing, currency, and cancellations.
          </p>
        </div>

        <div className="divide-y divide-zinc-200 bg-white rounded-3xl border border-zinc-200 p-6 sm:p-8 shadow-xs">
          {faqs.map((faq, idx) => (
            <div key={idx} className="py-5 first:pt-0 last:pb-0 space-y-2">
              <h3 className="text-sm font-bold text-zinc-950 flex items-start gap-2">
                <span className="text-zinc-400 font-mono text-xs">0{idx + 1}.</span>
                <span>{faq.question}</span>
              </h3>
              <p className="text-xs text-zinc-600 font-medium leading-relaxed pl-6">
                {faq.answer}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Policy Disclosures & Support Contact */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        <div className="rounded-2xl bg-zinc-100/70 border border-zinc-200 p-6 space-y-3 text-xs text-zinc-600 font-medium leading-relaxed">
          <div className="font-bold text-zinc-950 flex items-center justify-between">
            <span>Authoritative Commercial Policies & Support</span>
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-zinc-200 text-zinc-800">
              Sri Lankan Operations
            </span>
          </div>
          <p>
            Subscriptions are governed by our{' '}
            <Link href="/legal/subscription-billing" className="font-bold text-zinc-950 underline hover:no-underline">
              Subscription & Billing Policy
            </Link>{' '}
            and{' '}
            <Link href="/legal/refund-cancellation" className="font-bold text-zinc-950 underline hover:no-underline">
              Refund & Cancellation Policy
            </Link>
            . Personal data is safeguarded in accordance with our{' '}
            <Link href="/legal/privacy" className="font-bold text-zinc-950 underline hover:no-underline">
              Privacy Policy
            </Link>{' '}
            under the Personal Data Protection Act No. 9 of 2022 of Sri Lanka.
          </p>
          <div className="pt-2 border-t border-zinc-200 flex flex-wrap gap-x-6 gap-y-1 text-zinc-500 font-semibold text-[11px]">
            <span>Official Email: {OFFICIAL_BUSINESS_INFO.supportEmail}</span>
            <span>Telephone: {OFFICIAL_BUSINESS_INFO.phone}</span>
            <span>Operating Location: {OFFICIAL_BUSINESS_INFO.address}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
