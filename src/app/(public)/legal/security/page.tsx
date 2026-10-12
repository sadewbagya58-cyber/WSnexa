import React from 'react';
import { notFound } from 'next/navigation';
import { getLegalDocumentBySlug } from '@/content/legal/registry';
import { LegalDocumentView } from '@/components/legal/legal-document-view';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Security & Responsible Disclosure',
  description: 'Technical safeguards, Row-Level Security isolation, and guidelines for ethical security researchers reporting vulnerabilities.',
  alternates: {
    canonical: '/legal/security',
  },
  openGraph: {
    title: 'Security & Responsible Disclosure | WSNexa',
    description: 'Technical safeguards, Row-Level Security isolation, and guidelines for ethical security researchers reporting vulnerabilities.',
    url: '/legal/security',
  },
};

export default function SecurityPolicyPage() {
  const doc = getLegalDocumentBySlug('security');
  if (!doc) notFound();
  return <LegalDocumentView document={doc} />;
}
