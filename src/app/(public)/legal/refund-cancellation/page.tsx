import React from 'react';
import { notFound } from 'next/navigation';
import { getLegalDocumentBySlug } from '@/content/legal/registry';
import { LegalDocumentView } from '@/components/legal/legal-document-view';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Refund & Cancellation Policy',
  description: 'Dual-tier refund policy separating WSNexa SaaS subscription terms from independent hospitality venue dining order cancellations.',
  alternates: {
    canonical: '/legal/refund-cancellation',
  },
  openGraph: {
    title: 'Refund & Cancellation Policy | WSNexa',
    description: 'Dual-tier refund policy separating WSNexa SaaS subscription terms from independent hospitality venue dining order cancellations.',
    url: '/legal/refund-cancellation',
  },
};

export default function RefundCancellationPage() {
  const doc = getLegalDocumentBySlug('refund-cancellation');
  if (!doc) notFound();
  return <LegalDocumentView document={doc} />;
}
