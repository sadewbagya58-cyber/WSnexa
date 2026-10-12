import React from 'react';
import { notFound } from 'next/navigation';
import { getLegalDocumentBySlug } from '@/content/legal/registry';
import { LegalDocumentView } from '@/components/legal/legal-document-view';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy Policy detailing data processing, multi-tenant controller/processor responsibilities, and Sri Lanka PDPA rights.',
  alternates: {
    canonical: '/legal/privacy',
  },
  openGraph: {
    title: 'Privacy Policy | WSNexa',
    description: 'Privacy Policy detailing data processing, multi-tenant controller/processor responsibilities, and Sri Lanka PDPA rights.',
    url: '/legal/privacy',
  },
};

export default function PrivacyPage() {
  const doc = getLegalDocumentBySlug('privacy');
  if (!doc) notFound();
  return <LegalDocumentView document={doc} />;
}
