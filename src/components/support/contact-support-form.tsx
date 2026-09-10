'use client';

import React, { useState } from 'react';
import { submitSupportRequestAction } from '@/server/actions/support';
import { OFFICIAL_BUSINESS_INFO } from '@/content/legal/registry';

export function ContactSupportForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    category: 'general' as const,
    subject: '',
    message: '',
    referenceId: '',
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

    const res = await submitSupportRequestAction({
      name: formData.name,
      email: formData.email,
      category: formData.category,
      subject: formData.subject,
      message: formData.message,
      referenceId: formData.referenceId || undefined,
    });

    setIsSubmitting(false);
    if (res.success && res.data) {
      setResult({
        success: true,
        ticketId: res.data.ticketId,
        message: res.message,
      });
      setFormData({
        name: '',
        email: '',
        category: 'general',
        subject: '',
        message: '',
        referenceId: '',
      });
    } else {
      setResult({
        success: false,
        error: res.error || 'Failed to submit support request.',
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
              Support Request Received
            </h3>
            <p className="text-xs font-bold text-emerald-800">
              Reference ID: <span className="font-mono bg-emerald-200/60 px-2 py-0.5 rounded">{result.ticketId}</span>
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
              Submit another inquiry
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
              <label htmlFor="name" className="font-bold text-zinc-700 block">
                Your Name *
              </label>
              <input
                id="name"
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:outline-hidden focus:border-zinc-950 transition-colors"
                placeholder="Kamal Perera"
              />
              {result?.fieldErrors?.name && (
                <p className="text-[11px] text-red-600">{result.fieldErrors.name[0]}</p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="email" className="font-bold text-zinc-700 block">
                Work / Contact Email *
              </label>
              <input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:outline-hidden focus:border-zinc-950 transition-colors"
                placeholder="name@restaurant.lk"
              />
              {result?.fieldErrors?.email && (
                <p className="text-[11px] text-red-600">{result.fieldErrors.email[0]}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="category" className="font-bold text-zinc-700 block">
                Inquiry Category *
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
                <option value="general">General Platform Inquiry</option>
                <option value="technical">Technical Support / Bug</option>
                <option value="billing">Subscription & Billing</option>
                <option value="account">Account Access / Roles</option>
                <option value="menu_setup">Menu & Venue Setup</option>
                <option value="hardware">Printer / Display Hardware</option>
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="referenceId" className="font-bold text-zinc-700 block">
                Venue / Order ID (Optional)
              </label>
              <input
                id="referenceId"
                type="text"
                value={formData.referenceId}
                onChange={(e) => setFormData({ ...formData, referenceId: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:outline-hidden focus:border-zinc-950 transition-colors"
                placeholder="e.g. VENUE-123 or ORD-456"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="subject" className="font-bold text-zinc-700 block">
              Subject *
            </label>
            <input
              id="subject"
              type="text"
              required
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:outline-hidden focus:border-zinc-950 transition-colors"
              placeholder="Summary of your question or issue"
            />
            {result?.fieldErrors?.subject && (
              <p className="text-[11px] text-red-600">{result.fieldErrors.subject[0]}</p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="message" className="font-bold text-zinc-700 block">
              Message Details *
            </label>
            <textarea
              id="message"
              required
              rows={5}
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:outline-hidden focus:border-zinc-950 transition-colors"
              placeholder="Describe your inquiry or question with relevant context..."
            />
            {result?.fieldErrors?.message && (
              <p className="text-[11px] text-red-600">{result.fieldErrors.message[0]}</p>
            )}
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[11px] text-zinc-500 font-medium">
              You can also email us directly at{' '}
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
              {isSubmitting ? 'Submitting...' : 'Send Inquiry →'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
