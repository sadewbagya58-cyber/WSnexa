'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  generateAreaQrAction,
  regenerateAreaQrAction,
  disableAreaQrAction,
} from '@/server/actions/qr';
import { generateQrSvgString, generateQrPngDataUrl } from '@/lib/qr/qr-generator';

export interface AreaQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  area: {
    id: string;
    name: string;
    code: string;
    tableCount?: number;
  };
  businessName: string;
  branchName: string;
  branchCode: string;
  initialRawToken?: string | null;
  initialVersion?: number;
  canManage?: boolean;
}

export function AreaQrModal({
  isOpen,
  onClose,
  area,
  businessName,
  branchName,
  branchCode,
  initialRawToken = null,
  initialVersion = 1,
  canManage = true,
}: AreaQrModalProps) {
  const [rawToken, setRawToken] = useState<string | null>(initialRawToken);
  const [version, setVersion] = useState<number>(initialVersion);
  const [isActive, setIsActive] = useState<boolean>(Boolean(initialRawToken));
  const [svgHtml, setSvgHtml] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const baseUrl =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  const publicUrl = rawToken ? `${baseUrl}/m/${rawToken}` : '';

  // Synchronize state when modal opens or initial token props change
  useEffect(() => {
    if (isOpen) {
      setRawToken(initialRawToken);
      setVersion(initialVersion || 1);
      setIsActive(Boolean(initialRawToken));
      setErrorMsg(null);
    }
  }, [isOpen, initialRawToken, initialVersion]);

  // Generate SVG only when a genuine cryptographic rawToken is active
  useEffect(() => {
    let isMounted = true;
    if (rawToken && publicUrl) {
      generateQrSvgString(publicUrl, 216).then((svg) => {
        if (isMounted) setSvgHtml(svg);
      });
    } else {
      setSvgHtml('');
    }
    return () => {
      isMounted = false;
    };
  }, [publicUrl, rawToken]);

  if (!isOpen) return null;

  const handleGenerate = () => {
    setErrorMsg(null);
    startTransition(async () => {
      const res = await generateAreaQrAction(area.id);
      if (res.success && res.rawToken) {
        setRawToken(res.rawToken);
        setIsActive(true);
        setVersion(1);
      } else {
        setErrorMsg(res.message || 'Failed to generate Area QR code.');
      }
    });
  };

  const handleRegenerate = () => {
    if (
      !confirm(
        `WARNING: Regenerating the Area QR for "${area.name}" will invalidate previously printed QR codes for this area. Continue?`
      )
    ) {
      return;
    }

    setErrorMsg(null);
    startTransition(async () => {
      const res = await regenerateAreaQrAction(area.id, version);
      if (res.success && res.rawToken) {
        setRawToken(res.rawToken);
        setVersion(res.version || version + 1);
        setIsActive(true);
      } else {
        setErrorMsg(res.message || 'Failed to regenerate Area QR code.');
      }
    });
  };

  const handleDisable = () => {
    if (!confirm(`Are you sure you want to disable the Area QR for "${area.name}"?`)) return;

    setErrorMsg(null);
    startTransition(async () => {
      const res = await disableAreaQrAction(area.id);
      if (res.success) {
        setIsActive(false);
        setRawToken(null);
      } else {
        setErrorMsg(res.message || 'Failed to revoke Area QR code.');
      }
    });
  };

  const handleCopyLink = () => {
    if (!rawToken || !publicUrl) return;
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadPng = async () => {
    if (!rawToken || !publicUrl) return;
    try {
      const pngUrl = await generateQrPngDataUrl(publicUrl, 1024);
      const downloadLink = document.createElement('a');
      const safeAreaName = area.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      downloadLink.href = pngUrl;
      downloadLink.download = `area-qr-${safeAreaName}-v${version}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } catch (err) {
      setErrorMsg('Failed to generate PNG download: ' + String(err));
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-4 animate-in fade-in duration-150 overflow-y-auto">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-4 sm:p-6 shadow-2xl border border-zinc-200 space-y-5 sm:space-y-6 my-auto print:p-0 print:border-none print:shadow-none print:m-0 print:max-h-none print:overflow-visible">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-zinc-100 pb-3 sm:pb-4 print:hidden">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-xl font-bold text-zinc-950 truncate">Area QR — {area.name}</h2>
              {isActive ? (
                <Badge variant="success">Active (v{version})</Badge>
              ) : (
                <Badge variant="neutral">Not Generated</Badge>
              )}
            </div>
            <p className="text-xs text-zinc-500">
              Dine-in QR code for {area.name}. Guests who scan this QR can only select tables in this area.
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors cursor-pointer touch-manipulation"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-800 print:hidden">
            ⚠️ {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 items-start">
          {/* Printable Area QR Card Preview */}
          <div className="flex justify-center w-full">
            <div className="w-full max-w-[280px] sm:max-w-xs rounded-2xl border-2 border-zinc-900 bg-white p-4 sm:p-6 text-center shadow-md space-y-3 sm:space-y-4 print:border-2 print:shadow-none print:p-6 print:max-w-sm">
              {/* Header Branding */}
              <div className="space-y-1">
                <span className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
                  {businessName}
                </span>
                <h3 className="text-base sm:text-lg font-black tracking-tight text-zinc-950 truncate">
                  {branchName}
                </h3>
                {/* Area Name (Prominent with Sinhala/Unicode Support) */}
                <div className="pt-1 pb-1">
                  <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-zinc-900 text-white text-xs font-black tracking-wide max-w-full">
                    <span>📍</span>
                    <span className="truncate">{area.name}</span>
                  </div>
                </div>
              </div>

              {/* QR Code Container */}
              <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 p-3 sm:p-4 space-y-2">
                {isActive && svgHtml ? (
                  <div
                    className="h-44 w-44 bg-white p-2 border border-zinc-200 rounded-lg shadow-2xs flex items-center justify-center"
                    dangerouslySetInnerHTML={{ __html: svgHtml }}
                  />
                ) : (
                  <div className="h-44 w-44 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 text-center text-xs text-zinc-400 p-3 space-y-1">
                    <span className="text-2xl mb-1">📱</span>
                    <span className="font-semibold text-zinc-600">No active Area QR code</span>
                    <span className="text-[11px] text-zinc-400">Click &quot;Generate Area QR&quot; to activate</span>
                  </div>
                )}
              </div>

              {/* Call to Action */}
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-zinc-900">Scan to View Menu &amp; Order</p>
                <p className="text-[10px] text-zinc-500">Only {area.name} tables selectable</p>
              </div>

              {/* Card Footer Branding */}
              <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-[9px] text-zinc-400 font-mono">
                <span>WSNexa Area QR</span>
                <span className="truncate max-w-[100px]">{area.code}</span>
              </div>
            </div>
          </div>

          {/* Action Controls & Area Scope Enforcement */}
          <div className="space-y-4 print:hidden">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 sm:p-4 space-y-2 text-xs text-zinc-600">
              <div className="font-bold text-zinc-900">Area Scope Enforcement</div>
              <ul className="space-y-1 text-[11px] list-disc list-inside text-zinc-600">
                <li>Locks guest ordering session to <strong>{area.name}</strong>.</li>
                <li>Restricts table selector strictly to this area&apos;s active tables.</li>
                <li>Rejects cross-area table tampering on the server.</li>
              </ul>
            </div>

            {isActive ? (
              <div className="space-y-2.5">
                <Button
                  variant="outline"
                  className="w-full min-h-[44px] justify-start text-xs font-bold touch-manipulation cursor-pointer"
                  onClick={handleCopyLink}
                >
                  {copied ? '✅ Link Copied!' : '🔗 Copy Public Menu Link'}
                </Button>

                <Button
                  variant="outline"
                  className="w-full min-h-[44px] justify-start text-xs font-bold touch-manipulation cursor-pointer"
                  onClick={handlePrint}
                >
                  🖨️ Print Area QR Card
                </Button>

                <Button
                  variant="outline"
                  className="w-full min-h-[44px] justify-start text-xs font-bold touch-manipulation cursor-pointer"
                  onClick={handleDownloadPng}
                >
                  💾 Download High-Res PNG
                </Button>

                {canManage && (
                  <>
                    <Button
                      variant="outline"
                      className="w-full min-h-[44px] justify-start text-xs font-bold text-zinc-700 touch-manipulation cursor-pointer"
                      disabled={isPending}
                      onClick={handleRegenerate}
                    >
                      🔄 Regenerate QR (Invalidate Old)
                    </Button>

                    <Button
                      variant="destructive"
                      className="w-full min-h-[44px] justify-start text-xs font-bold touch-manipulation cursor-pointer"
                      disabled={isPending}
                      onClick={handleDisable}
                    >
                      🚫 Revoke / Disable QR
                    </Button>
                  </>
                )}
              </div>
            ) : (
              canManage && (
                <div className="space-y-3 pt-1">
                  <p className="text-xs text-zinc-500">
                    Generate an active Area QR code to allow guests in <strong>{area.name}</strong> to scan and order directly from their table.
                  </p>
                  <Button
                    className="w-full text-xs font-extrabold min-h-[48px] bg-zinc-950 text-white hover:bg-zinc-800 rounded-xl shadow-xs touch-manipulation cursor-pointer"
                    disabled={isPending}
                    onClick={handleGenerate}
                  >
                    {isPending ? 'Generating...' : `✨ Generate Area QR (${area.name})`}
                  </Button>
                </div>
              )
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end pt-3 sm:pt-4 border-t border-zinc-100 print:hidden">
          <Button variant="outline" onClick={onClose} className="min-h-[44px] px-5 text-xs font-bold cursor-pointer touch-manipulation">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
