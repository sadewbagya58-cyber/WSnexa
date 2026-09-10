import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { resolveAuthorizationContext } from '@/server/auth';
import { SettingsSubNav } from '@/components/settings/settings-subnav';
import { resolveSettingsSubNavPermissions } from '@/server/navigation/settings-nav-permissions';
import { getAllLegalDocuments, OFFICIAL_BUSINESS_INFO } from '@/content/legal/registry';
import { SystemStatusService } from '@/server/services/system-status.service';

export const metadata: Metadata = {
  title: 'Legal, Support & Trust Center | WSNexa',
  description: 'Access WSNexa legal documents, terms of service, support ticketing, system status, and security reporting.',
};

export default async function BusinessLegalSettingsPage() {
  const { allowed, context: tenantContext } = await requireRoutePermission('/dashboard/settings');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(tenantContext?.membership?.role)} />;
  }

  if (!tenantContext || !tenantContext.business) {
    redirect('/login');
  }

  let authContext: Awaited<ReturnType<typeof resolveAuthorizationContext>>;
  try {
    authContext = await resolveAuthorizationContext();
  } catch {
    redirect('/login');
  }

  const navPermissions = await resolveSettingsSubNavPermissions(
    authContext,
    tenantContext.activeBranch?.id,
    tenantContext.business.id
  );

  const legalDocs = getAllLegalDocuments();
  const statusReport = await SystemStatusService.getAuthoritativeStatus();

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        title="Legal, Support & Trust"
        description="Access authoritative terms of service, customer support desk, system status, and security disclosure guidelines."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Settings Hub', href: '/dashboard/settings' },
          { label: 'Legal & Support' },
        ]}
      />

      <SettingsSubNav {...navPermissions} />

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
        {/* 1. Support & Help Desk Card */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-2xl p-2.5 rounded-xl bg-zinc-50 border border-zinc-100">
                💬
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-md">
                Support
              </span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-950">Help & Support Desk</h2>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                Browse our knowledge base or get in touch with our team for operational assistance.
              </p>
            </div>
          </div>
          <div className="pt-4 border-t border-zinc-100 space-y-2 text-xs">
            <Link
              href="/help"
              target="_blank"
              className="font-bold text-zinc-950 hover:underline block flex items-center justify-between"
            >
              <span>Knowledge Base & Guides</span>
              <span>↗</span>
            </Link>
            <Link
              href="/support/contact"
              target="_blank"
              className="font-bold text-zinc-950 hover:underline block flex items-center justify-between"
            >
              <span>Contact Support Desk</span>
              <span>↗</span>
            </Link>
            <Link
              href="/support/report-problem"
              target="_blank"
              className="font-bold text-zinc-700 hover:underline block flex items-center justify-between"
            >
              <span>Report a Problem / Bug</span>
              <span>↗</span>
            </Link>
          </div>
        </div>

        {/* 2. Authoritative System Status Card */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-2xl p-2.5 rounded-xl bg-zinc-50 border border-zinc-100">
                🚦
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Live
              </span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-950">System & Service Status</h2>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                Live operational health of WSNexa database, auth, KDS, and cashier engines.
              </p>
              <div className="mt-2 text-xs font-semibold text-zinc-700">
                Current State: <strong className="text-zinc-950">{statusReport.overallMessage}</strong>
              </div>
            </div>
          </div>
          <div className="pt-4 border-t border-zinc-100 text-xs">
            <Link
              href="/status"
              target="_blank"
              className="font-bold text-zinc-950 hover:underline inline-flex items-center gap-1"
            >
              View Authoritative Status Page ↗
            </Link>
          </div>
        </div>

        {/* 3. Security & Responsible Disclosure */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-2xl p-2.5 rounded-xl bg-zinc-50 border border-zinc-100">
                🛡️
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-md">
                Security
              </span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-950">Security & Disclosure</h2>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                Understand our Row-Level Security tenant isolation and report vulnerabilities safely.
              </p>
            </div>
          </div>
          <div className="pt-4 border-t border-zinc-100 space-y-2 text-xs">
            <Link
              href="/legal/security"
              target="_blank"
              className="font-bold text-zinc-950 hover:underline block flex items-center justify-between"
            >
              <span>Security Architecture Policy</span>
              <span>↗</span>
            </Link>
            <Link
              href="/security/report"
              target="_blank"
              className="font-bold text-zinc-950 hover:underline block flex items-center justify-between"
            >
              <span>Submit Security Disclosure</span>
              <span>↗</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Legal Documents Section */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-zinc-950">Authoritative Legal Policies</h2>
            <p className="text-xs text-zinc-500">
              Policies governing your SaaS subscription, acceptable use, and data protection under Sri Lankan law.
            </p>
          </div>
          <Link
            href="/legal"
            target="_blank"
            className="text-xs font-bold text-zinc-950 hover:underline"
          >
            Open Legal Hub ↗
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {legalDocs.map((doc) => (
            <Link
              key={doc.id}
              href={doc.href}
              target="_blank"
              className="p-3.5 rounded-xl border border-zinc-100 hover:border-zinc-950 bg-zinc-50/50 hover:bg-white transition-all space-y-1 block"
            >
              <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400">
                <span>v{doc.version}</span>
                <span>Pre-Commercial</span>
              </div>
              <h3 className="text-xs font-bold text-zinc-950">{doc.shortTitle}</h3>
              <p className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed">
                {doc.summary}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* Corporate Information Card */}
      <div className="bg-zinc-50 rounded-2xl border border-zinc-200 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
        <div className="space-y-1 text-center sm:text-left">
          <h2 className="font-bold text-zinc-950">Official Business Information</h2>
          <p className="text-zinc-600">
            {OFFICIAL_BUSINESS_INFO.brand} • {OFFICIAL_BUSINESS_INFO.address}
          </p>
          <p className="text-zinc-500 text-[11px]">
            Support: {OFFICIAL_BUSINESS_INFO.supportEmail} • Tel: {OFFICIAL_BUSINESS_INFO.phone}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/about"
            target="_blank"
            className="px-3.5 py-2 rounded-xl bg-white border border-zinc-200 text-zinc-800 font-bold hover:border-zinc-950 transition-all text-center"
          >
            About WSNexa
          </Link>
          <Link
            href="/contact"
            target="_blank"
            className="px-3.5 py-2 rounded-xl bg-zinc-950 text-white font-bold hover:bg-zinc-800 transition-all text-center"
          >
            Company Contact
          </Link>
        </div>
      </div>
    </div>
  );
}
