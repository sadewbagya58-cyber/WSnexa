import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dining Order Session',
  robots: {
    index: false,
    follow: false,
  },
};

export default function MobileOrderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
