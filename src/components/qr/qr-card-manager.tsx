'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  generateTableQrAction,
  regenerateTableQrAction,
  disableTableQrAction,
} from '@/server/actions/qr';
import { generateQrSvgString } from '@/lib/qr/qr-generator';

interface QrCardManagerProps {
  businessName: string;
  branchName: string;
  areaName: string;
  tableName: string;
  tableCode: string;
  tableId: string;
  initialQr: {
    id: string;
    version: number;
    token_prefix: string | null;
    is_active: boolean;
    generated_at: string;
  } | null;
}

export const QrCardManager: React.FC<QrCardManagerProps> = ({
  businessName,
  branchName,
  areaName,
  tableName,
  tableCode,
  tableId,
  initialQr,
}) => {
  const [qr, setQr] = useState(initialQr);
  const [rawToken, setRawToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const baseUrl =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  
  // Public URL string
  const publicUrl = rawToken ? `${baseUrl}/m/${rawToken}` : `${baseUrl}/m/${qr?.token_prefix || 'SAMPLE'}`;

  const handleGenerate = async () => {
    setLoading(true);
    const res = await generateTableQrAction(tableId);
    setLoading(false);

    if (res.success && res.rawToken && res.qrCodeId) {
      setRawToken(res.rawToken);
      setQr({
        id: res.qrCodeId,
        version: 1,
        token_prefix: res.rawToken.substring(0, 8),
        is_active: true,
        generated_at: new Date().toISOString(),
      });
    } else {
      alert(res.message || 'Failed to generate QR code');
    }
  };

  const handleRegenerate = async () => {
    if (
      !confirm(
        'WARNING: Regenerating this QR code will IMMEDIATELY invalidate the existing printed QR code on the table. Continue?'
      )
    ) {
      return;
    }

    setLoading(true);
    const res = await regenerateTableQrAction(tableId);
    setLoading(false);

    if (res.success && res.rawToken && res.qrCodeId) {
      setRawToken(res.rawToken);
      setQr({
        id: res.qrCodeId,
        version: (qr?.version || 1) + 1,
        token_prefix: res.rawToken.substring(0, 8),
        is_active: true,
        generated_at: new Date().toISOString(),
      });
    } else {
      alert(res.message || 'Failed to regenerate QR code');
    }
  };

  const handleDisable = async () => {
    if (!confirm('Are you sure you want to disable/revoke this QR code?')) return;
    setLoading(true);
    const res = await disableTableQrAction(tableId);
    setLoading(false);

    if (res.success) {
      setQr(null);
      setRawToken(null);
    } else {
      alert(res.message || 'Failed to disable QR code');
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

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Left Column: Management Controls */}
      <Card className="p-6 space-y-6 lg:col-span-1 print:hidden">
        <div className="space-y-2 border-b border-zinc-100 pb-4">
          <h2 className="text-lg font-bold text-zinc-950">QR Code Status</h2>
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
              {loading ? 'Generating...' : '✨ Generate QR Code'}
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
                🖨️ Print Single Card
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

      {/* Right Column: Printable Card Preview */}
      <div className="lg:col-span-2 flex justify-center">
        <div className="w-full max-w-sm rounded-2xl border-2 border-zinc-900 bg-white p-8 text-center shadow-lg space-y-6 print:border-2 print:shadow-none print:m-0 print:p-8">
          {/* Header Branding */}
          <div className="space-y-1">
            <span className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
              {businessName}
            </span>
            <h1 className="text-2xl font-black tracking-tight text-zinc-950">
              {tableName}
            </h1>
            <div className="flex items-center justify-center gap-2 text-xs text-zinc-600">
              <span>{branchName}</span>
              <span>•</span>
              <span className="font-semibold">{areaName}</span>
              <span>•</span>
              <Badge variant="neutral">{tableCode}</Badge>
            </div>
          </div>

          {/* QR Code Container */}
          <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 p-6 space-y-3">
            {qr?.is_active ? (
              <div
                className="h-56 w-56 bg-white p-2 border border-zinc-200 rounded-lg shadow-sm"
                dangerouslySetInnerHTML={{ __html: generateQrSvgString(publicUrl, 216) }}
              />
            ) : (
              <div className="h-56 w-56 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 text-center text-xs text-zinc-400 p-4">
                <span className="text-2xl mb-1">📱</span>
                <span>No active QR code. Click &quot;Generate QR Code&quot; to activate.</span>
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
            <span className="font-mono">{tableCode}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
