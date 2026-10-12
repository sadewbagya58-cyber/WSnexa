import React from 'react';
import { notFound } from 'next/navigation';
import { getLegalDocumentBySlug } from '@/content/legal/registry';
import { LegalDocumentView } from '@/components/legal/legal-document-view';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Subscription & Billing Policy',
  description: 'Pre-commercial billing terms, indicative Starter/Growth/Enterprise configurations in LKR, payment processing status, and renewal rules.',
  alternates: {
    canonical: '/legal/subscription-billing',
  },
  openGraph: {
    title: 'Subscription & Billing Policy | WSNexa',
    description: 'Pre-commercial billing terms, indicative Starter/Growth/Enterprise configurations in LKR, payment processing status, and renewal rules.',
    url: '/legal/subscription-billing',
  },
};

export default function SubscriptionBillingPage() {
  const doc = getLegalDocumentBySlug('subscription-billing');
  if (!doc) notFound();
  return <LegalDocumentView document={doc} />;
}
