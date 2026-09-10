import React from 'react';
import { notFound } from 'next/navigation';
import { getLegalDocumentBySlug } from '@/content/legal/registry';
import { LegalDocumentView } from '@/components/legal/legal-document-view';

export const metadata = {
  title: 'Terms & Conditions | WSNexa',
  description: 'Terms and Conditions governing the use of the WSNexa SaaS platform, accounts, roles, and services.',
};

export default function TermsPage() {
  const doc = getLegalDocumentBySlug('terms');
  if (!doc) notFound();
  return <LegalDocumentView document={doc} />;
}
