import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { AccountService, MinimalUserProfile, MinimalMembership } from '@/server/services/account.service';

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Smart Authenticated User Redirect: Never show marketing journey to logged-in staff
  if (user) {
    const admin = createAdminClient();
    const [{ data: profile }, { data: memberships }] = await Promise.all([
      admin
        .from('user_profiles')
        .select('id, first_name, last_name, onboarding_intent, preferred_workspace, customer_profile_created_at')
        .eq('id', user.id)
        .maybeSingle(),
      admin
        .from('business_memberships')
        .select('id, business_id, role, membership_status, custom_role_id')
        .eq('user_id', user.id),
    ]);

    const activeMembership = memberships?.find(
      (m) => m.membership_status === 'active' || (m as unknown as { status?: string }).status === 'active'
    );
    const suspendedMembership = memberships?.find(
      (m) => m.membership_status === 'suspended' || (m as unknown as { status?: string }).status === 'suspended'
    );

    // If staff member is suspended, safely route to pending access (preventing access loops)
    if (suspendedMembership && !activeMembership) {
      redirect('/account/pending-access');
    }

    const targetRoute = await AccountService.resolveAccountRoute(
      user,
      profile as MinimalUserProfile | null,
      activeMembership as (MinimalMembership & { custom_role_id?: string | null }) | null
    );

    redirect(targetRoute);
  }

  // Unauthenticated Visitor: Render Redesigned Public SaaS Landing Page
  const features = [
    {
      title: 'Live Orders Queue',
      desc: 'Real-time multi-channel order placement, status tracking, and kitchen routing.',
      code: 'ORD',
    },
    {
      title: 'Digital Menu Catalog',
      desc: 'Instant price updates, item availability toggles, and modifier group management.',
      code: 'MNU',
    },
    {
      title: 'Contactless QR Ordering',
      desc: 'Table-specific QR ordering cards with security PIN validation and anti-fake controls.',
      code: 'QRC',
    },
    {
      title: 'Waiter Workspace',
      desc: 'Area-scoped order entry, table assignments, and guest call request handling.',
      code: 'WTR',
    },
    {
      title: 'Kitchen Display (KDS)',
      desc: 'Real-time ticket routing, preparation timers, and item completion updates.',
      code: 'KDS',
    },
    {
      title: 'Cashier POS & Billing',
      desc: 'Counter order entry, cash/card settlements, and receipt printing.',
      code: 'POS',
    },
    {
      title: 'Tables & Service Areas',
      desc: 'Visual floor layouts, area-scoped table groupings, and capacity management.',
      code: 'TBL',
    },
    {
      title: 'Staff & Permissions V2',
      desc: 'Production-grade RBAC, branch isolation, service area boundaries, and delegation controls.',
      code: 'RBAC',
    },
    {
      title: 'Payments & Settlement',
      desc: 'Integrated counter payments, digital settlements, and audit transaction logs.',
      code: 'PAY',
    },
    {
      title: 'Reports & Analytics',
      desc: 'Financial breakdowns, daily sales summaries, and exportable operational metrics.',
      code: 'RPT',
    },
    {
      title: 'Public Venue Profiles',
      desc: 'Digital storefronts, operating hours, venue media, and location discovery.',
      code: 'VEN',
    },
    {
      title: 'Guest Loyalty & Reviews',
      desc: 'Customer points programs, rewards tiers, and verified dining review management.',
      code: 'LOY',
    },
  ];

  const steps = [
    {
      step: '01',
      title: 'Create your business',
      desc: 'Establish your business account and set up your primary venue profile.',
    },
    {
      step: '02',
      title: 'Configure your branch',
      desc: 'Set up branch locations, default currency, timezones, and operating hours.',
    },
    {
      step: '03',
      title: 'Build your digital menu',
      desc: 'Add categories, items, prices, availability, and modifier option groups.',
    },
    {
      step: '04',
      title: 'Add tables & QR codes',
      desc: 'Organize dining service areas and generate table QR codes for guest ordering.',
    },
    {
      step: '05',
      title: 'Invite your team',
      desc: 'Assign staff roles, branch boundaries, and service area assignments.',
    },
    {
      step: '06',
      title: 'Start serving guests',
      desc: 'Receive live guest orders, process payments, and monitor venue reports.',
    },
  ];

  return (
    <div className="bg-white text-zinc-950 font-sans selection:bg-zinc-950 selection:text-white">
      {/* Hero Section */}
      <section className="mx-auto max-w-7xl px-4 pt-16 pb-20 sm:px-6 sm:pt-24 sm:pb-28 lg:px-8 text-center">
        <div className="mx-auto max-w-4xl space-y-8">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-zinc-700 shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Hospitality Operating System</span>
          </div>

          {/* Headline */}
          <div className="space-y-3">
            <h1 className="text-4xl font-black tracking-tight text-zinc-950 uppercase sm:text-6xl lg:text-7xl leading-none">
              Smart Hospitality.<br />
              <span className="text-zinc-400">Simplified.</span>
            </h1>
            <p className="mx-auto max-w-2xl text-base sm:text-lg text-zinc-600 leading-relaxed font-normal pt-2">
              Run orders, menus, staff, tables, payments, and guest experiences from one connected platform.
            </p>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto pt-4">
            <Link
              href="/register"
              className="w-full sm:w-auto flex-1 min-h-[48px] px-8 py-3.5 bg-zinc-950 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl hover:bg-zinc-800 transition-all flex items-center justify-center shadow-md active:scale-95"
            >
              Get Started →
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto flex-1 min-h-[48px] px-8 py-3.5 bg-white border border-zinc-200 text-zinc-900 font-extrabold text-xs uppercase tracking-widest rounded-xl hover:bg-zinc-100 transition-all flex items-center justify-center shadow-2xs active:scale-95"
            >
              Log In
            </Link>
          </div>

          {/* Tertiary Link */}
          <div className="pt-2">
            <Link
              href="/explore"
              className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-zinc-950 transition-colors"
            >
              <span>Explore public venues & digital menus</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* One Platform Feature Grid */}
      <section id="features" className="border-t border-zinc-200 bg-zinc-50/50 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
            <div className="text-xs font-black uppercase tracking-widest text-zinc-400">
              One Platform
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-zinc-950 uppercase tracking-tight">
              All Your Venue Operations. Connected.
            </h2>
            <p className="text-sm sm:text-base text-zinc-600">
              Engineered for fast-paced hospitality environments — from single cafes to multi-branch hospitality groups.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.code}
                className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-2xs transition-all hover:border-zinc-300 hover:shadow-xs flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-zinc-100 px-2.5 py-1 text-[10px] font-bold text-zinc-600 tracking-wider">
                      {f.code}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-zinc-950 tracking-tight">
                    {f.title}
                  </h3>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="border-t border-zinc-200 bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
            <div className="text-xs font-black uppercase tracking-widest text-zinc-400">
              Simple Setup
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-zinc-950 uppercase tracking-tight">
              How WSNexa Works
            </h2>
            <p className="text-sm sm:text-base text-zinc-600">
              Get your venue up and running in 6 straightforward steps.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {steps.map((s) => (
              <div key={s.step} className="space-y-3 border-l-2 border-zinc-200 pl-4 py-1">
                <div className="text-2xl font-black text-zinc-300 tracking-tight">
                  {s.step}
                </div>
                <h3 className="text-base font-bold text-zinc-950">
                  {s.title}
                </h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="border-t border-zinc-200 bg-zinc-950 py-20 text-white text-center">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-6">
          <h2 className="text-3xl sm:text-5xl font-black uppercase tracking-tight">
            Ready to Simplify Your Venue Operations?
          </h2>
          <p className="mx-auto max-w-xl text-sm sm:text-base text-zinc-400 leading-relaxed">
            Join modern cafes, restaurants, and hospitality venues powered by WSNexa OS.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 max-w-md mx-auto">
            <Link
              href="/register"
              className="w-full sm:w-auto flex-1 min-h-[48px] px-8 py-3.5 bg-white text-zinc-950 font-extrabold text-xs uppercase tracking-widest rounded-xl hover:bg-zinc-100 transition-all flex items-center justify-center shadow-lg active:scale-95"
            >
              Get Started Now →
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto flex-1 min-h-[48px] px-8 py-3.5 bg-zinc-900 border border-zinc-800 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl hover:bg-zinc-800 transition-all flex items-center justify-center shadow-2xs active:scale-95"
            >
              Log In
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
