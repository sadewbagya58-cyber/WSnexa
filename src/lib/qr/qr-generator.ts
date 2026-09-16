import QRCode from 'qrcode';

/**
 * Standards-compliant ISO/IEC 18004 QR Code Vector SVG Generator for WSNexa.
 * Generates crisp, pixel-perfect filled vector SVGs readable by Google Lens,
 * Android Camera, iOS Camera, and physical 2D barcode scanners.
 *
 * Architecture & Print Optimization:
 * - Uses solid filled rectangular path runs (fill="#09090b") instead of strokes.
 *   Strokes centered on half-pixels cause severe sub-pixel blurring and merged
 *   modules in print engines; filled vectors render with razor-sharp edges.
 * - Standard ISO/IEC 18004 4-module quiet zone (margin: 4) ensures instant scanner lock.
 * - Error correction level 'Q' (Quality, ~25% recovery) guarantees reliable reads
 *   even with minor print wear or low contrast.
 * - viewBox only (no fixed width/height) allows infinite, clean vector scaling.
 */
export async function generateQrSvgString(
  url: string,
  _ignoredSize: number = 256,
  options?: { errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'; margin?: number }
): Promise<string> {
  try {
    const errorCorrectionLevel = options?.errorCorrectionLevel || 'Q';
    const margin = options?.margin !== undefined ? options.margin : 4;
    const qr = QRCode.create(url, { errorCorrectionLevel });
    const modCount = qr.modules.size;
    const totalSize = modCount + margin * 2;

    // Merge horizontal runs of dark modules on each row into single rectangular path segments
    let pathData = '';
    for (let r = 0; r < modCount; r++) {
      let runStart = -1;
      for (let c = 0; c < modCount; c++) {
        const isDark = qr.modules.get(r, c);
        if (isDark) {
          if (runStart === -1) runStart = c;
        } else {
          if (runStart !== -1) {
            const w = c - runStart;
            pathData += `M${runStart + margin} ${r + margin}h${w}v1h-${w}z`;
            runStart = -1;
          }
        }
      }
      if (runStart !== -1) {
        const w = modCount - runStart;
        pathData += `M${runStart + margin} ${r + margin}h${w}v1h-${w}z`;
      }
    }

    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" shape-rendering="crispEdges">` +
      `<rect width="${totalSize}" height="${totalSize}" fill="#ffffff"/>` +
      `<path fill="#09090b" d="${pathData}"/>` +
      `</svg>`
    );
  } catch (err) {
    console.error('Failed to generate QR SVG string:', err);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 41 41" shape-rendering="crispEdges"><rect width="41" height="41" fill="#ffffff"/></svg>`;
  }
}

/**
 * Generates a high-res PNG Data URL directly from a target URL string.
 */
export async function generateQrPngDataUrl(url: string, size: number = 1024): Promise<string> {
  return await QRCode.toDataURL(url, {
    width: size,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: {
      dark: '#09090b',
      light: '#ffffff',
    },
  });
}

export function getPublicQrUrl(rawToken: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  return `${baseUrl}/m/${rawToken}`;
}
