import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Account & Access',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AuthFlowLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
