import React from 'react';
import { notFound } from 'next/navigation';
import { getLegalDocumentBySlug } from '@/content/legal/registry';
import { LegalDocumentView } from '@/components/legal/legal-document-view';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cookie & Storage Policy',
  description: 'Detailed disclosure of strictly necessary authentication cookies, active context tokens, and local cache utilized by WSNexa.',
  alternates: {
    canonical: '/legal/cookies',
  },
  openGraph: {
    title: 'Cookie & Storage Policy | WSNexa',
    description: 'Detailed disclosure of strictly necessary authentication cookies, active context tokens, and local cache utilized by WSNexa.',
    url: '/legal/cookies',
  },
};

export default function CookiesPage() {
  const doc = getLegalDocumentBySlug('cookies');
  if (!doc) notFound();
  return <LegalDocumentView document={doc} />;
}
