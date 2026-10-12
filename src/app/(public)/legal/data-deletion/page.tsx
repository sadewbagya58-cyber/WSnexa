import React from 'react';
import { notFound } from 'next/navigation';
import { getLegalDocumentBySlug } from '@/content/legal/registry';
import { LegalDocumentView } from '@/components/legal/legal-document-view';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Data & Account Deletion Policy',
  description: 'Procedures and timelines for requesting business account deactivation, personal data erasure, and statutory retention rules.',
  alternates: {
    canonical: '/legal/data-deletion',
  },
  openGraph: {
    title: 'Data & Account Deletion Policy | WSNexa',
    description: 'Procedures and timelines for requesting business account deactivation, personal data erasure, and statutory retention rules.',
    url: '/legal/data-deletion',
  },
};

export default function DataDeletionPage() {
  const doc = getLegalDocumentBySlug('data-deletion');
  if (!doc) notFound();
  return <LegalDocumentView document={doc} />;
}
