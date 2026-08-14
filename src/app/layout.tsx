import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WSNexa — Smart Hospitality. Simplified.',
  description:
    'Multi-tenant Hospitality Operating System for restaurants, cafes, resorts, food courts, and hospitality venues.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-white text-zinc-950">
        {children}
      </body>
    </html>
  );
}
