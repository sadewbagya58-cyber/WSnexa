import React from 'react';
import { notFound } from 'next/navigation';
import { getLegalDocumentBySlug } from '@/content/legal/registry';
import { LegalDocumentView } from '@/components/legal/legal-document-view';

export const metadata = {
  title: 'Acceptable Use Policy | WSNexa',
  description: 'Standards of conduct, anti-fraud rules, and prohibited operational activities on the WSNexa hospitality platform.',
};

export default function AcceptableUsePage() {
  const doc = getLegalDocumentBySlug('acceptable-use');
  if (!doc) notFound();
  return <LegalDocumentView document={doc} />;
}
