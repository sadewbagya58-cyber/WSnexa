import React from 'react';
import { notFound } from 'next/navigation';
import { getLegalDocumentBySlug } from '@/content/legal/registry';
import { LegalDocumentView } from '@/components/legal/legal-document-view';

export const metadata = {
  title: 'Subscription & Billing Policy | WSNexa',
  description: 'Pre-commercial billing terms, indicative Starter/Growth/Enterprise configurations in LKR, payment processing status, and renewal rules.',
};

export default function SubscriptionBillingPage() {
  const doc = getLegalDocumentBySlug('subscription-billing');
  if (!doc) notFound();
  return <LegalDocumentView document={doc} />;
}
