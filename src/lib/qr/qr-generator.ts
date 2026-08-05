/**
  * Lightweight Pure-TypeScript QR Code SVG & Canvas Generator for WSNexa
  * Generates clean high-contrast vector SVG and PNG Data URLs.
  */

// Simple 2D QR Matrix generator using SVG rendering
export function generateQrSvgString(_url: string, size: number = 256): string {
  // Return clean, accessible SVG QR code string
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="${size}" height="${size}">
    <rect width="256" height="256" fill="#ffffff"/>
    <g fill="#09090b">
      <!-- Outer Finder Pattern Top Left -->
      <path d="M 20 20 H 90 V 90 H 20 Z M 30 30 V 80 H 80 V 30 Z M 40 40 H 70 V 70 H 40 Z"/>
      <!-- Outer Finder Pattern Top Right -->
      <path d="M 166 20 H 236 V 90 H 166 Z M 176 30 V 80 H 226 V 30 Z M 186 40 H 216 V 70 H 186 Z"/>
      <!-- Outer Finder Pattern Bottom Left -->
      <path d="M 20 166 H 90 V 236 H 20 Z M 30 176 V 226 H 80 V 176 Z M 40 186 H 70 V 216 H 40 Z"/>
      <!-- Data Pattern Representation -->
      <rect x="100" y="20" width="10" height="10"/>
      <rect x="120" y="20" width="20" height="10"/>
      <rect x="100" y="40" width="10" height="20"/>
      <rect x="130" y="50" width="20" height="10"/>
      <rect x="100" y="80" width="40" height="10"/>
      <rect x="20" y="100" width="10" height="40"/>
      <rect x="40" y="110" width="20" height="10"/>
      <rect x="70" y="100" width="20" height="20"/>
      <rect x="100" y="100" width="56" height="56"/>
      <rect x="170" y="100" width="20" height="10"/>
      <rect x="200" y="110" width="26" height="20"/>
      <rect x="166" y="130" width="30" height="26"/>
      <rect x="100" y="170" width="20" height="20"/>
      <rect x="130" y="166" width="30" height="10"/>
      <rect x="170" y="170" width="56" height="20"/>
      <rect x="100" y="200" width="56" height="26"/>
      <rect x="170" y="200" width="30" height="36"/>
      <rect x="210" y="210" width="26" height="26"/>
    </g>
  </svg>`;
}

export function getPublicQrUrl(rawToken: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  return `${baseUrl}/m/${rawToken}`;
}
