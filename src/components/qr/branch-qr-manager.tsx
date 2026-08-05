'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  generateBranchQrAction,
  regenerateBranchQrAction,
  disableBranchQrAction,
  updateBranchOrderingSettingsAction,
} from '@/server/actions/qr';
import { bulkGenerateBranchTablePinsAction } from '@/server/actions/table';
import { generateQrSvgString, generateQrPngDataUrl } from '@/lib/qr/qr-generator';

interface BranchQrManagerProps {
  businessName: string;
  branchName: string;
  branchCode: string;
  requireTableSelection: boolean;
  requireTablePin: boolean;
  tablePinLength: number;
  tablesSummary: {
    total: number;
    withPin: number;
    missingPin: number;
  };
  initialQr: {
    id: string;
    version: number;
    token_prefix: string | null;
    rawToken: string | null;
    is_active: boolean;
    generated_at: string;
  } | null;
}

export const BranchQrManager: React.FC<BranchQrManagerProps> = ({
  businessName,
  branchName,
  branchCode,
  requireTableSelection: initialSelection,
  requireTablePin: initialPin,
  tablePinLength: initialLength,
  tablesSummary: initialSummary,
  initialQr,
}) => {
  const [qr, setQr] = useState(initialQr);
  const [rawToken, setRawToken] = useState<string | null>(initialQr?.rawToken || null);
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [svgHtml, setSvgHtml] = useState<string>('');

  // Settings State
  const [requireTableSelection, setRequireTableSelection] = useState<boolean>(initialSelection);
  const [requireTablePin, setRequireTablePin] = useState<boolean>(initialPin);
  const [tablePinLength, setTablePinLength] = useState<number>(initialLength);
  const [tablesSummary, setTablesSummary] = useState(initialSummary);
  const [settingsLoading, setSettingsLoading] = useState<boolean>(false);

  const baseUrl =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  
  // Public Branch URL string
  const publicUrl = rawToken
    ? `${baseUrl}/m/${rawToken}`
    : `${baseUrl}/m/${qr?.token_prefix || 'SAMPLE'}`;

  useEffect(() => {
    let isMounted = true;
    generateQrSvgString(publicUrl, 216).then((svg) => {
      if (isMounted) setSvgHtml(svg);
    });
    return () => {
      isMounted = false;
    };
  }, [publicUrl]);

  const handleGenerate = async () => {
    setLoading(true);
    const res = await generateBranchQrAction();
    setLoading(false);

    if (res.success && res.rawToken && res.qrCodeId) {
      setRawToken(res.rawToken);
      setQr({
        id: res.qrCodeId,
        version: 1,
        token_prefix: res.rawToken.substring(0, 8),
        rawToken: res.rawToken,
        is_active: true,
        generated_at: new Date().toISOString(),
      });
    } else {
      alert(res.message || 'Failed to generate Branch QR code');
    }
  };

  const handleRegenerate = async () => {
    if (
      !confirm(
        'WARNING: Regenerating the Branch QR code will IMMEDIATELY invalidate the existing printed QR codes across your venue. Continue?'
      )
    ) {
      return;
    }

    setLoading(true);
    const res = await regenerateBranchQrAction();
    setLoading(false);

    if (res.success && res.rawToken && res.qrCodeId) {
      setRawToken(res.rawToken);
      setQr({
        id: res.qrCodeId,
        version: (qr?.version || 1) + 1,
        token_prefix: res.rawToken.substring(0, 8),
        rawToken: res.rawToken,
        is_active: true,
        generated_at: new Date().toISOString(),
      });
    } else {
      alert(res.message || 'Failed to regenerate Branch QR code');
    }
  };

  const handleDisable = async () => {
    if (!confirm('Are you sure you want to disable/revoke this Branch QR code?')) return;
    setLoading(true);
    const res = await disableBranchQrAction();
    setLoading(false);

    if (res.success) {
      setQr(null);
      setRawToken(null);
    } else {
      alert(res.message || 'Failed to disable Branch QR code');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPng = async () => {
    try {
      const pngUrl = await generateQrPngDataUrl(publicUrl, 1024);
      const downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      downloadLink.download = `Branch-QR-${branchCode}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } catch (err) {
      alert('Failed to generate PNG download: ' + err);
    }
  };

  const handleSettingChange = async (updates: {
    require_table_selection?: boolean;
    require_table_pin?: boolean;
    table_pin_length?: number;
  }) => {
    const nextSelection = updates.require_table_selection ?? requireTableSelection;
    let nextPin = updates.require_table_pin ?? requireTablePin;
    const nextLength = updates.table_pin_length ?? tablePinLength;

    if (!nextSelection) {
      nextPin = false; // Bypass PIN if table selection is disabled
    }

    setRequireTableSelection(nextSelection);
    setRequireTablePin(nextPin);
    setTablePinLength(nextLength);

    setSettingsLoading(true);
    const res = await updateBranchOrderingSettingsAction({
      require_table_selection: nextSelection,
      require_table_pin: nextPin,
      table_pin_length: nextLength,
    });
    setSettingsLoading(false);

    if (!res.success) {
      alert(res.message || 'Failed to update branch ordering settings');
    }
  };

  const handleBulkGeneratePins = async () => {
    if (!confirm(`Generate ${tablePinLength}-digit PINs for all tables missing a PIN?`)) return;
    setLoading(true);
    const res = await bulkGenerateBranchTablePinsAction(true);
    setLoading(false);

    if (res.success && res.data) {
      alert(`Successfully generated PINs for ${res.data.count} table(s)!`);
      setTablesSummary((prev) => ({
        ...prev,
        withPin: prev.total,
        missingPin: 0,
      }));
    } else {
      alert(res.message || 'Failed to bulk generate PINs');
    }
  };

  return (
    <div className="space-y-6">
      {/* Branch Settings & Readiness Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 print:hidden">
        {/* Branch Ordering Settings Card */}
        <Card className="p-6 lg:col-span-2 space-y-5">
          <div className="border-b border-zinc-100 pb-3">
            <h2 className="text-base font-bold text-zinc-950">Branch Guest Ordering & PIN Settings</h2>
            <p className="text-xs text-zinc-500">
              Configure how guests identify their table and verify access after scanning the Branch QR code.
            </p>
          </div>

          <div className="space-y-4">
            {/* Setting 1: Require Table Selection */}
            <div className="flex items-center justify-between rounded-lg border border-zinc-200 p-4">
              <div>
                <span className="text-sm font-bold text-zinc-950">Require Table Selection</span>
                <p className="text-xs text-zinc-500">
                  Guests must select their table number from the interactive floor layout before ordering.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={requireTableSelection}
                  disabled={settingsLoading}
                  onChange={(e) => handleSettingChange({ require_table_selection: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-zinc-950"></div>
              </label>
            </div>

            {/* Setting 2: Require Table PIN */}
            <div
              className={`flex items-center justify-between rounded-lg border p-4 transition-all ${
                !requireTableSelection
                  ? 'border-zinc-100 bg-zinc-50 opacity-60 cursor-not-allowed'
                  : 'border-zinc-200 bg-white'
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-zinc-950">Require Table PIN</span>
                  {!requireTableSelection && <Badge variant="neutral">Disabled</Badge>}
                </div>
                <p className="text-xs text-zinc-500">
                  Guests must enter the 4-6 digit PIN printed on their table sticker to confirm access.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={requireTablePin}
                  disabled={settingsLoading || !requireTableSelection}
                  onChange={(e) => handleSettingChange({ require_table_pin: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-zinc-950"></div>
              </label>
            </div>

            {/* Setting 3: Table PIN Length */}
            <div className="flex items-center justify-between rounded-lg border border-zinc-200 p-4">
              <div>
                <span className="text-sm font-bold text-zinc-950">Table PIN Length</span>
                <p className="text-xs text-zinc-500">Choose length for newly generated table PINs.</p>
              </div>
              <select
                value={tablePinLength}
                disabled={settingsLoading}
                onChange={(e) => handleSettingChange({ table_pin_length: Number(e.target.value) })}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-bold text-zinc-900 focus:outline-none"
              >
                <option value={4}>4 Digits (Standard)</option>
                <option value={5}>5 Digits</option>
                <option value={6}>6 Digits (Secure)</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Table PIN Readiness Summary */}
        <Card className="p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-2 border-b border-zinc-100 pb-3">
            <h2 className="text-base font-bold text-zinc-950">Table PIN Readiness</h2>
            <p className="text-xs text-zinc-500">Overview of table security PIN setup across {branchName}.</p>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-xs border-b border-zinc-100 pb-2">
              <span className="text-zinc-600">Total Active Tables</span>
              <span className="font-bold text-zinc-950">{tablesSummary.total}</span>
            </div>
            <div className="flex justify-between text-xs border-b border-zinc-100 pb-2">
              <span className="text-emerald-700 font-semibold">PIN Configured</span>
              <span className="font-bold text-emerald-800">{tablesSummary.withPin}</span>
            </div>
            <div className="flex justify-between text-xs pb-1">
              <span className="text-amber-700 font-semibold">Missing PIN</span>
              <span className="font-bold text-amber-800">{tablesSummary.missingPin}</span>
            </div>
          </div>

          {tablesSummary.missingPin > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              disabled={loading}
              onClick={handleBulkGeneratePins}
            >
              ⚡ Bulk Generate Missing PINs ({tablesSummary.missingPin})
            </Button>
          )}
        </Card>
      </div>

      {/* Main Branch QR Actions & Card Display Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Management Actions */}
        <Card className="p-6 space-y-6 lg:col-span-1 print:hidden">
          <div className="space-y-2 border-b border-zinc-100 pb-4">
            <h2 className="text-lg font-bold text-zinc-950">Branch QR Code</h2>
            {qr?.is_active ? (
              <div className="flex items-center gap-2">
                <Badge variant="success">Active (v{qr.version})</Badge>
                <span className="text-xs text-zinc-500">
                  Prefix: <code className="font-mono">{qr.token_prefix}</code>
                </span>
              </div>
            ) : (
              <Badge variant="neutral">Not Generated / Revoked</Badge>
            )}
          </div>

          <div className="space-y-3">
            {!qr?.is_active ? (
              <Button
                className="w-full"
                disabled={loading}
                onClick={handleGenerate}
              >
                {loading ? 'Generating...' : '✨ Generate Branch QR Code'}
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleCopyLink}
                >
                  {copied ? '✅ Link Copied!' : '🔗 Copy Public Menu Link'}
                </Button>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handlePrint}
                >
                  🖨️ Print Branch QR Card
                </Button>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleDownloadPng}
                >
                  💾 Download High-Res PNG
                </Button>

                <Button
                  variant="outline"
                  className="w-full"
                  disabled={loading}
                  onClick={handleRegenerate}
                >
                  🔄 Regenerate QR (Invalidate Old)
                </Button>

                <Button
                  variant="destructive"
                  className="w-full"
                  disabled={loading}
                  onClick={handleDisable}
                >
                  🚫 Revoke / Disable QR
                </Button>
              </>
            )}
          </div>

          {qr?.generated_at && (
            <p className="text-[11px] text-zinc-400">
              Generated at: {new Date(qr.generated_at).toLocaleString()}
            </p>
          )}
        </Card>

        {/* Printable Branch Card Preview */}
        <div className="lg:col-span-2 flex justify-center">
          <div className="w-full max-w-sm rounded-2xl border-2 border-zinc-900 bg-white p-8 text-center shadow-lg space-y-6 print:border-2 print:shadow-none print:m-0 print:p-8">
            {/* Header Branding */}
            <div className="space-y-1">
              <span className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
                {businessName}
              </span>
              <h1 className="text-2xl font-black tracking-tight text-zinc-950">
                {branchName}
              </h1>
              <div className="flex items-center justify-center gap-2 text-xs text-zinc-600">
                <Badge variant="neutral">{branchCode}</Badge>
                <span>•</span>
                <span className="font-semibold">Digital Menu</span>
              </div>
            </div>

            {/* QR Code Container */}
            <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 p-6 space-y-3">
              {qr?.is_active ? (
                <div
                  className="h-56 w-56 bg-white p-2 border border-zinc-200 rounded-lg shadow-sm flex items-center justify-center"
                  dangerouslySetInnerHTML={{ __html: svgHtml }}
                />
              ) : (
                <div className="h-56 w-56 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 text-center text-xs text-zinc-400 p-4">
                  <span className="text-2xl mb-1">📱</span>
                  <span>No active Branch QR code. Click &quot;Generate Branch QR Code&quot; to activate.</span>
                </div>
              )}
            </div>

            {/* Call to Action */}
            <div className="space-y-1">
              <p className="text-sm font-bold text-zinc-900">Scan to View Digital Menu</p>
              <p className="text-[11px] text-zinc-500">Point your phone camera at the QR code</p>
            </div>

            {/* Card Footer Branding */}
            <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-[10px] text-zinc-400">
              <span>Powered by WSNexa</span>
              <span className="font-mono">{branchCode}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
