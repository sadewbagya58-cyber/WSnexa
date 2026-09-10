import React from 'react';
import { notFound } from 'next/navigation';
import { getLegalDocumentBySlug } from '@/content/legal/registry';
import { LegalDocumentView } from '@/components/legal/legal-document-view';

export const metadata = {
  title: 'Data & Account Deletion Policy | WSNexa',
  description: 'Procedures and timelines for requesting business account deactivation, personal data erasure, and statutory retention rules.',
};

export default function DataDeletionPage() {
  const doc = getLegalDocumentBySlug('data-deletion');
  if (!doc) notFound();
  return <LegalDocumentView document={doc} />;
}
