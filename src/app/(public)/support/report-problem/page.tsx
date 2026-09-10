import React from 'react';
import Link from 'next/link';
import { ReportProblemForm } from '@/components/support/report-problem-form';

export const metadata = {
  title: 'Report a Problem | WSNexa Support',
  description: 'Report software bugs, display glitches, hardware issues, or ordering workflow problems to the WSNexa team.',
};

export default function ReportProblemPage() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-3 text-center sm:text-left border-b border-zinc-200 pb-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link
              href="/help"
              className="text-xs font-bold text-zinc-500 hover:text-zinc-950 transition-colors inline-flex items-center gap-1"
            >
              ← Back to Help Center
            </Link>
            <span className="text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
              Bug & Issue Tracking
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight">
            Report a Problem
          </h1>
          <p className="text-xs sm:text-sm text-zinc-600 font-medium max-w-2xl leading-relaxed">
            Spotted an issue with kitchen order queues, cashier payment settlement, or table QR codes? Submit the details below to help our engineering team investigate and resolve it promptly.
          </p>
        </div>

        <ReportProblemForm />
      </div>
    </div>
  );
}
