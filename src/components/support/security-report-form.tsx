'use client';

import React, { useState } from 'react';
import { submitSecurityReportAction } from '@/server/actions/support';
import { OFFICIAL_BUSINESS_INFO } from '@/content/legal/registry';

export function SecurityReportForm() {
  const [formData, setFormData] = useState({
    researcherName: '',
    contactEmail: '',
    summary: '',
    affectedArea: '',
    severity: 'medium' as const,
    reproductionSteps: '',
    proofOfConcept: '',
    adheresToPolicy: false,
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

    const res = await submitSecurityReportAction({
      researcherName: formData.researcherName || undefined,
      contactEmail: formData.contactEmail,
      summary: formData.summary,
      affectedArea: formData.affectedArea,
      severity: formData.severity,
      reproductionSteps: formData.reproductionSteps,
      proofOfConcept: formData.proofOfConcept || undefined,
      adheresToPolicy: formData.adheresToPolicy,
    });

    setIsSubmitting(false);
    if (res.success && res.data) {
      setResult({
        success: true,
        ticketId: res.data.ticketId,
        message: res.message,
      });
      setFormData({
        researcherName: '',
        contactEmail: '',
        summary: '',
        affectedArea: '',
        severity: 'medium',
        reproductionSteps: '',
        proofOfConcept: '',
        adheresToPolicy: false,
      });
    } else {
      setResult({
        success: false,
        error: res.error || 'Failed to submit security disclosure.',
        fieldErrors: res.fieldErrors,
      });
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-zinc-200 p-6 sm:p-10 shadow-xs space-y-6">
      {/* Responsible Testing Rules Callout */}
      <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-2 text-xs text-zinc-600 font-medium">
        <h3 className="font-black text-zinc-950 uppercase tracking-wider flex items-center gap-2">
          <span>🛡️</span>
          <span>Responsible Disclosure Rules</span>
        </h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Do not access, alter, download, or disclose data belonging to other hospitality businesses or customers.</li>
          <li>Avoid denial of service, resource exhaustion, or destructive payloads affecting active operations.</li>
          <li>Provide reasonable time (minimum 30 business days) for WSNexa to investigate and remediate before public discussion.</li>
        </ul>
      </div>

      {result?.success ? (
        <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-4 text-center sm:text-left">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl mx-auto sm:mx-0">
            ✓
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-black text-emerald-950">
              Vulnerability Report Received
            </h3>
            <p className="text-xs font-bold text-emerald-800">
              Tracking Identifier: <span className="font-mono bg-emerald-200/60 px-2 py-0.5 rounded">{result.ticketId}</span>
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
              Submit another report
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
              <label htmlFor="researcherName" className="font-bold text-zinc-700 block">
                Researcher Name / Handle (Optional)
              </label>
              <input
                id="researcherName"
                type="text"
                value={formData.researcherName}
                onChange={(e) => setFormData({ ...formData, researcherName: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:outline-hidden focus:border-zinc-950 transition-colors"
                placeholder="e.g. Alex (Security Researcher)"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="contactEmail" className="font-bold text-zinc-700 block">
                Contact Email for Coordinated Disclosure *
              </label>
              <input
                id="contactEmail"
                type="email"
                required
                value={formData.contactEmail}
                onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:outline-hidden focus:border-zinc-950 transition-colors"
                placeholder="researcher@domain.com"
              />
              {result?.fieldErrors?.contactEmail && (
                <p className="text-[11px] text-red-600">{result.fieldErrors.contactEmail[0]}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="affectedArea" className="font-bold text-zinc-700 block">
                Affected Area / URL / API Endpoint *
              </label>
              <input
                id="affectedArea"
                type="text"
                required
                value={formData.affectedArea}
                onChange={(e) => setFormData({ ...formData, affectedArea: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:outline-hidden focus:border-zinc-950 transition-colors"
                placeholder="e.g. /api/cashier/orders or Table QR session"
              />
              {result?.fieldErrors?.affectedArea && (
                <p className="text-[11px] text-red-600">{result.fieldErrors.affectedArea[0]}</p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="severity" className="font-bold text-zinc-700 block">
                Estimated Severity *
              </label>
              <select
                id="severity"
                value={formData.severity}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    severity: e.target.value as typeof formData.severity,
                  })
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:outline-hidden focus:border-zinc-950 bg-white transition-colors"
              >
                <option value="low">Low (Informational / Minor Header)</option>
                <option value="medium">Medium (Improper Access Control / CSRF)</option>
                <option value="high">High (Privilege Escalation / Sensitive Data Leak)</option>
                <option value="critical">Critical (Remote Code Execution / Tenant RLS Bypass)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="summary" className="font-bold text-zinc-700 block">
              Vulnerability Summary *
            </label>
            <input
              id="summary"
              type="text"
              required
              value={formData.summary}
              onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:outline-hidden focus:border-zinc-950 transition-colors"
              placeholder="Concise overview of the vulnerability"
            />
            {result?.fieldErrors?.summary && (
              <p className="text-[11px] text-red-600">{result.fieldErrors.summary[0]}</p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="reproductionSteps" className="font-bold text-zinc-700 block">
              Reproduction Steps *
            </label>
            <textarea
              id="reproductionSteps"
              required
              rows={4}
              value={formData.reproductionSteps}
              onChange={(e) => setFormData({ ...formData, reproductionSteps: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:outline-hidden focus:border-zinc-950 font-mono text-xs transition-colors"
              placeholder="Provide exact HTTP requests, headers, or UI sequence to reproduce..."
            />
            {result?.fieldErrors?.reproductionSteps && (
              <p className="text-[11px] text-red-600">{result.fieldErrors.reproductionSteps[0]}</p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="proofOfConcept" className="font-bold text-zinc-700 block">
              Proof of Concept / Technical Evidence (Optional)
            </label>
            <textarea
              id="proofOfConcept"
              rows={3}
              value={formData.proofOfConcept}
              onChange={(e) => setFormData({ ...formData, proofOfConcept: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:outline-hidden focus:border-zinc-950 font-mono text-xs transition-colors"
              placeholder="Paste sanitized request/response payloads or diagnostic output..."
            />
          </div>

          <div className="pt-2">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                required
                checked={formData.adheresToPolicy}
                onChange={(e) => setFormData({ ...formData, adheresToPolicy: e.target.checked })}
                className="mt-0.5 rounded border-zinc-300 text-zinc-950 focus:ring-zinc-950"
              />
              <span className="text-zinc-600 font-medium leading-relaxed">
                I confirm that my testing conformed to WSNexa’s Responsible Disclosure rules, did not modify or access data of other tenants, and did not disrupt live operations.
              </span>
            </label>
            {result?.fieldErrors?.adheresToPolicy && (
              <p className="text-[11px] text-red-600 mt-1">{result.fieldErrors.adheresToPolicy[0]}</p>
            )}
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[11px] text-zinc-500 font-medium">
              Direct security inquiries: <a href={`mailto:${OFFICIAL_BUSINESS_INFO.supportEmail}`} className="text-zinc-950 font-bold hover:underline">{OFFICIAL_BUSINESS_INFO.supportEmail}</a>
            </p>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-zinc-950 text-white font-extrabold text-xs uppercase tracking-wider hover:bg-zinc-800 disabled:opacity-50 transition-all shadow-xs active:scale-95"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Vulnerability Report →'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
