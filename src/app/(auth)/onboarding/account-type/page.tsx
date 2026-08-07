import React from 'react';
import { Metadata } from 'next';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { redirect } from 'next/navigation';
import { AccountTypeSelector } from '@/components/auth/account-type-selector';

export const metadata: Metadata = {
  title: 'Choose Account Type | WSNexa',
  description: 'Select your workspace role intent during onboarding',
};

export default async function AccountTypePage() {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.user) {
    redirect('/login');
  }

  // If user already has verified active membership, redirect to dashboard directly
  if (context.membership && context.membership.status === 'active') {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <AccountTypeSelector />
    </div>
  );
}
