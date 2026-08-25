import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AccountService } from '@/server/services/account.service';
import { CustomerShell } from '@/components/customer/customer-shell';
import { CustomerReservationsClient } from '@/components/customer/customer-reservations-client';
import { CustomerReservationService } from '@/server/reservations/customer-reservation.service';

export const metadata: Metadata = {
  title: 'My Table Reservations | WSNexa Customer',
  description: 'Manage upcoming table reservations and view past dining history',
};

export default async function CustomerReservationsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const [membershipsRes, customerData, reservations] = await Promise.all([
    supabase
      .from('business_memberships')
      .select('id')
      .eq('user_id', user.id)
      .eq('membership_status', 'active')
      .limit(1),
    AccountService.getCustomerProfile(user.id),
    CustomerReservationService.getCustomerReservations(user.id),
  ]);

  const hasBusinessAccess = !!(membershipsRes.data && membershipsRes.data.length > 0);

  return (
    <CustomerShell
      displayName={customerData.displayName}
      email={customerData.email}
      hasBusinessAccess={hasBusinessAccess}
    >
      <CustomerReservationsClient initialReservations={reservations} />
    </CustomerShell>
  );
}
