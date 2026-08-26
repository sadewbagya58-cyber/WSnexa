import React from 'react';
import { redirect } from 'next/navigation';
import { requireSuperAdmin } from '@/server/auth/super-admin';
import { SubscriptionPaymentQueryService } from '@/server/services/subscription-payment-query.service';
import { AdminSubscriptionPaymentsClient } from '@/components/admin/admin-subscription-payments-client';

interface PageProps {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    status?: string;
    provider?: string;
    purpose?: string;
    plan?: string;
    search?: string;
    businessId?: string;
  }>;
}

export default async function AdminSubscriptionPaymentsPage({ searchParams }: PageProps) {
  try {
    await requireSuperAdmin();
  } catch {
    redirect('/dashboard');
  }

  const sParams = await searchParams;
  const page = parseInt(sParams.page || '1', 10) || 1;
  const limit = parseInt(sParams.limit || '20', 10) || 20;

  const result = await SubscriptionPaymentQueryService.listAdminSubscriptionPayments({
    page,
    limit,
    status: sParams.status,
    provider: sParams.provider,
    purpose: sParams.purpose,
    plan: sParams.plan,
    search: sParams.search,
    businessId: sParams.businessId,
  });

  return (
    <AdminSubscriptionPaymentsClient
      initialData={result}
      filters={{
        status: sParams.status || 'all',
        provider: sParams.provider || 'all',
        purpose: sParams.purpose || 'all',
        plan: sParams.plan || 'all',
        search: sParams.search || '',
      }}
    />
  );
}
