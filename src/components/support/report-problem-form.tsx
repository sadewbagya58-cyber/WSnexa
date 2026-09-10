'use client';

import React, { useState } from 'react';
import { submitProblemReportAction } from '@/server/actions/support';
import { OFFICIAL_BUSINESS_INFO } from '@/content/legal/registry';

export function ReportProblemForm() {
  const [formData, setFormData] = useState({
    contactEmail: '',
    category: 'bug' as const,
    description: '',
    stepsToReproduce: '',
    expectedBehavior: '',
    actualBehavior: '',
    deviceBrowser: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    ticketId?: string;
    message?: string;
    error?: string;
    fieldErrors?: Record<string, string[]>;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setResult(null);

    const res = await submitProblemReportAction({
      contactEmail: formData.contactEmail,
      category: formData.category,
      description: formData.description,
      stepsToReproduce: formData.stepsToReproduce,
      expectedBehavior: formData.expectedBehavior,
      actualBehavior: formData.actualBehavior,
      deviceBrowser: formData.deviceBrowser || undefined,
    });

    setIsSubmitting(false);
    if (res.success && res.data) {
      setResult({
        success: true,
        ticketId: res.data.ticketId,
        message: res.message,
      });
      setFormData({
        contactEmail: '',
        category: 'bug',
        description: '',
        stepsToReproduce: '',
        expectedBehavior: '',
        actualBehavior: '',
        deviceBrowser: '',
      });
    } else {
      setResult({
        success: false,
        error: res.error || 'Failed to submit problem report.',
        fieldErrors: res.fieldErrors,
      });
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-zinc-200 p-6 sm:p-10 shadow-xs space-y-6">
      {result?.success ? (
        <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-4 text-center sm:text-left">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl mx-auto sm:mx-0">
            ✓
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-black text-emerald-950">
              Problem Report Logged
            </h3>
            <p className="text-xs font-bold text-emerald-800">
              Diagnostic Reference: <span className="font-mono bg-emerald-200/60 px-2 py-0.5 rounded">{result.ticketId}</span>
            </p>
            <p className="text-xs text-emerald-700 leading-relaxed pt-2">
              {result.message}
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setResult(null)}
              className="text-xs font-extrabold text-emerald-900 underline hover:no-underline"
            >
              Report another issue
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {result?.error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 font-semibold text-xs">
              {result.error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="contactEmail" className="font-bold text-zinc-700 block">
                Contact Email *
              </label>
              <input
                id="contactEmail"
                type="email"
                required
                value={formData.contactEmail}
                onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:outline-hidden focus:border-zinc-950 transition-colors"
                placeholder="name@venue.lk"
              />
              {result?.fieldErrors?.contactEmail && (
                <p className="text-[11px] text-red-600">{result.fieldErrors.contactEmail[0]}</p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="category" className="font-bold text-zinc-700 block">
                Problem Category *
              </label>
              <select
                id="category"
                value={formData.category}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    category: e.target.value as typeof formData.category,
                  })
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:outline-hidden focus:border-zinc-950 bg-white transition-colors"
              >
                <option value="bug">Software Bug / Display Glitch</option>
                <option value="payment">Payment & Settlement Issue</option>
                <option value="ordering">QR Ordering / Table Flow</option>
                <option value="kitchen">Kitchen Display System (KDS)</option>
                <option value="cashier">Cashier POS / Receipting</option>
                <option value="inventory">Inventory / Recipe BOM</option>
                <option value="account">Account / Permissions / RBAC</option>
                <option value="security">Security Concern</option>
                <option value="other">Other Operational Problem</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="description" className="font-bold text-zinc-700 block">
              Problem Description *
            </label>
            <textarea
              id="description"
              required
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:outline-hidden focus:border-zinc-950 transition-colors"
              placeholder="Provide a clear, high-level summary of what went wrong..."
            />
            {result?.fieldErrors?.description && (
              <p className="text-[11px] text-red-600">{result.fieldErrors.description[0]}</p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="stepsToReproduce" className="font-bold text-zinc-700 block">
              Steps to Reproduce *
            </label>
            <textarea
              id="stepsToReproduce"
              required
              rows={3}
              value={formData.stepsToReproduce}
              onChange={(e) => setFormData({ ...formData, stepsToReproduce: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:outline-hidden focus:border-zinc-950 transition-colors"
              placeholder="1. Go to Kitchen Queue&#10;2. Click on ticket #123&#10;3. Notice status does not advance"
            />
            {result?.fieldErrors?.stepsToReproduce && (
              <p className="text-[11px] text-red-600">{result.fieldErrors.stepsToReproduce[0]}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="expectedBehavior" className="font-bold text-zinc-700 block">
                Expected Behavior *
              </label>
              <textarea
                id="expectedBehavior"
                required
                rows={2}
                value={formData.expectedBehavior}
                onChange={(e) => setFormData({ ...formData, expectedBehavior: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:outline-hidden focus:border-zinc-950 transition-colors"
                placeholder="What did you expect to happen?"
              />
              {result?.fieldErrors?.expectedBehavior && (
                <p className="text-[11px] text-red-600">{result.fieldErrors.expectedBehavior[0]}</p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="actualBehavior" className="font-bold text-zinc-700 block">
                Actual Behavior *
              </label>
              <textarea
                id="actualBehavior"
                required
                rows={2}
                value={formData.actualBehavior}
                onChange={(e) => setFormData({ ...formData, actualBehavior: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:outline-hidden focus:border-zinc-950 transition-colors"
                placeholder="What actually occurred instead?"
              />
              {result?.fieldErrors?.actualBehavior && (
                <p className="text-[11px] text-red-600">{result.fieldErrors.actualBehavior[0]}</p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="deviceBrowser" className="font-bold text-zinc-700 block">
              Device / Browser / OS (Optional)
            </label>
            <input
              id="deviceBrowser"
              type="text"
              value={formData.deviceBrowser}
              onChange={(e) => setFormData({ ...formData, deviceBrowser: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:outline-hidden focus:border-zinc-950 transition-colors"
              placeholder="e.g. Android 14 / Chrome 128 / Windows 11 POS"
            />
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[11px] text-zinc-500 font-medium">
              Diagnostic reports are routed to{' '}
              <a
                href={`mailto:${OFFICIAL_BUSINESS_INFO.supportEmail}`}
                className="text-zinc-950 font-bold hover:underline"
              >
                {OFFICIAL_BUSINESS_INFO.supportEmail}
              </a>
            </p>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-zinc-950 text-white font-extrabold text-xs uppercase tracking-wider hover:bg-zinc-800 disabled:opacity-50 transition-all shadow-xs active:scale-95"
            >
              {isSubmitting ? 'Logging...' : 'Submit Problem Report →'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
