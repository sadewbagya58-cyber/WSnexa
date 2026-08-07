import React from 'react';
import { Metadata } from 'next';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { redirect } from 'next/navigation';
import { PendingAccessScreen } from '@/components/auth/pending-access-screen';

export const metadata: Metadata = {
  title: 'Pending Authorization | WSNexa',
  description: 'Your manager or staff account is waiting for business authorization',
};

export default async function PendingAccessPage() {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.user) {
    redirect('/login');
  }

  // If user actually has verified active membership, redirect to dashboard
  if (context.membership && context.membership.status === 'active') {
    redirect('/dashboard');
  }

  const intent = 'staff';

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <PendingAccessScreen intent={intent} userEmail={context.user.email || 'User'} />
    </div>
  );
}
