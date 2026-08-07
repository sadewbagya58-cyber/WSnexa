import React from 'react';
import { Metadata } from 'next';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { redirect } from 'next/navigation';
import { ReportsDashboard } from '@/components/reports/reports-dashboard';

export const metadata: Metadata = {
  title: 'Reports & Analytics | WSNexa POS',
  description: 'Real-time sales summary, revenue trend, kitchen efficiency, and multi-dimension reporting',
};

export default async function ReportsPage() {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.user) {
    redirect('/login');
  }

  const { role } = context.membership;
  if (!['business_owner', 'branch_manager', 'cashier', 'kitchen_staff', 'waiter'].includes(role)) {
    redirect('/dashboard');
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
      <ReportsDashboard />
    </div>
  );
}
