import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Customer Portal',
  robots: {
    index: false,
    follow: false,
  },
};

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
