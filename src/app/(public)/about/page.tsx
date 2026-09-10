import React from 'react';
import Link from 'next/link';
import { OFFICIAL_BUSINESS_INFO } from '@/content/legal/registry';

export const metadata = {
  title: 'About WSNexa | Smart Hospitality. Simplified.',
  description:
    'WSNexa is a modern hospitality management platform designed to simplify restaurant, hotel, cafe, and resort operations.',
};

export default function AboutPage() {
  const venues = [
    { title: 'Restaurants & Bistros', icon: '🍽️', desc: 'Dine-in table QR ordering, waiter ordering, and high-speed kitchen display ticketing.' },
    { title: 'Cafés & Bakeries', icon: '☕', desc: 'Quick counter ordering, barista dispatch, modifier groups, and loyalty reward points.' },
    { title: 'Hotels & Resorts', icon: '🏨', desc: 'Multi-outlet service areas, pool/room service QR ordering, and multi-branch oversight.' },
    { title: 'Villas & Boutique Stays', icon: '🏡', desc: 'Personalized guest dining, table allocations, and flexible cashier settlement workflows.' },
    { title: 'Bars & Lounges', icon: '🍸', desc: 'Fast drink ticketing, tab management, table security PINs, and real-time inventory tracking.' },
    { title: 'Food Service Operations', icon: '🥗', desc: 'Recipe Bill of Materials (BOM) costing, ingredient stock deductions, and food waste audit logs.' },
  ];

  const modules = [
    { name: 'Digital Menus & QR Ordering', desc: 'Contactless guest ordering with GPS geofencing and dining table PIN security.' },
    { name: 'Waiter & Mobile Ordering', desc: 'Fast handheld ordering for floor waitstaff with instant kitchen routing.' },
    { name: 'Kitchen Display System (KDS)', desc: 'Real-time kitchen order queue with audible cancellation alerts and stage progression.' },
    { name: 'Cashier POS & Settlement', desc: 'Multi-payment method bill settlement, cash drawer reconciliation, and validated refunds.' },
    { name: 'Inventory & Recipe BOM', desc: 'Ingredient-level stock tracking, automatic deduction on ordering, and kitchen food waste logging.' },
    { name: 'Customer Loyalty & CRM', desc: 'Digital rewards, dining visit frequencies, and customer relationship management.' },
    { name: 'Executive Reports & Analytics', desc: 'Daily/monthly revenue trends, cancellation analytics, and operational insights.' },
    { name: 'Multi-Branch Management', desc: 'Centralized brand control with localized branch outlets, service areas, and staff shifts.' },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-16">
        {/* Hero Section */}
        <section className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-950 text-white text-[11px] font-extrabold uppercase tracking-widest">
            <span>WSNexa Hospitality OS</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-zinc-950">
            {OFFICIAL_BUSINESS_INFO.tagline}
          </h1>
          <p className="text-sm sm:text-base text-zinc-600 font-medium leading-relaxed">
            WSNexa is an integrated software platform engineered to eliminate operational friction, unify dining floor and kitchen workflows, and provide hospitality operators with total clarity over orders, inventory, and revenue.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-3 text-xs font-bold">
            <Link
              href="/register"
              className="px-5 py-3 rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 transition-all shadow-xs"
            >
              Get Started
            </Link>
            <Link
              href="/contact"
              className="px-5 py-3 rounded-xl bg-white border border-zinc-200 text-zinc-950 hover:bg-zinc-100 transition-all shadow-2xs"
            >
              Contact Us
            </Link>
          </div>
        </section>

        {/* Venues We Serve */}
        <section className="space-y-6">
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <h2 className="text-2xl font-black text-zinc-950">
              Engineered for Every Hospitality Format
            </h2>
            <p className="text-xs text-zinc-500 font-medium">
              From boutique cafes to multi-outlet resort properties, WSNexa adapts to your unique dining rhythm.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {venues.map((v) => (
              <div
                key={v.title}
                className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-2xs space-y-3"
              >
                <span className="text-2xl">{v.icon}</span>
                <h3 className="text-sm font-bold text-zinc-950">{v.title}</h3>
                <p className="text-xs text-zinc-500 font-medium leading-relaxed">
                  {v.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Core Capabilities */}
        <section className="bg-white rounded-3xl border border-zinc-200 p-8 sm:p-12 shadow-xs space-y-8">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-700 text-[10px] font-extrabold uppercase tracking-wider">
              <span>⚡</span>
              <span>Platform Capabilities</span>
            </div>
            <h2 className="text-2xl font-black text-zinc-950">
              A Complete Operating System for Your Venue
            </h2>
            <p className="text-xs text-zinc-500 font-medium max-w-xl">
              Every tool is engineered as part of a unified, real-time database architecture, ensuring instantaneous synchronization between dining tables, kitchen screens, and cashier tills.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {modules.map((m) => (
              <div key={m.name} className="p-4 rounded-xl bg-zinc-50 border border-zinc-100 space-y-1">
                <h3 className="text-xs font-bold text-zinc-950">{m.name}</h3>
                <p className="text-xs text-zinc-500 font-medium">{m.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Company & Location Details */}
        <section className="bg-zinc-950 text-white rounded-3xl p-8 sm:p-12 space-y-6">
          <div className="max-w-2xl space-y-3">
            <h2 className="text-2xl font-black">WSNexa</h2>
            <p className="text-xs sm:text-sm text-zinc-400 font-medium leading-relaxed">
              WSNexa was created to solve the real operational challenges hospitality operators face every day: misplaced orders, slow kitchen communication, unaccounted ingredient waste, and complex software.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 border-t border-zinc-800 text-xs text-zinc-400 font-medium">
            <div>
              <span className="font-bold text-white block mb-1">Official Support</span>
              <a href={`mailto:${OFFICIAL_BUSINESS_INFO.supportEmail}`} className="hover:underline text-zinc-200 font-semibold">
                {OFFICIAL_BUSINESS_INFO.supportEmail}
              </a>
            </div>
            <div>
              <span className="font-bold text-white block mb-1">Telephone</span>
              <span className="text-zinc-200 font-semibold">{OFFICIAL_BUSINESS_INFO.phone}</span>
            </div>
            <div>
              <span className="font-bold text-white block mb-1">Operating Location</span>
              <span className="text-zinc-200 font-semibold">{OFFICIAL_BUSINESS_INFO.address}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
