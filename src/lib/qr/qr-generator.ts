import QRCode from 'qrcode';

/**
 * Standards-compliant ISO/IEC 18004 QR Code SVG Generator for WSNexa.
 * Generates valid, high-contrast vector SVG strings readable by Google Lens,
 * Android Camera, iOS Camera, and physical 2D barcode scanners.
 */
export async function generateQrSvgString(url: string, size: number = 256): Promise<string> {
  try {
    const svgString = await QRCode.toString(url, {
      type: 'svg',
      width: size,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#09090b',
        light: '#ffffff',
      },
    });
    return svgString;
  } catch (err) {
    console.error('Failed to generate QR SVG string:', err);
    // Fallback basic SVG frame if generation fails
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="${size}" height="${size}"><rect width="256" height="256" fill="#ffffff"/></svg>`;
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
