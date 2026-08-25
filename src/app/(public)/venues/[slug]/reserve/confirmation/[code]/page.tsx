import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { getGuestReservationDetailAction } from '@/server/actions/reservation-public';
import { CustomerReservationService } from '@/server/reservations/customer-reservation.service';

interface ConfirmationPageProps {
  params: Promise<{ slug: string; code: string }>;
  searchParams: Promise<{ token?: string }>;
}

export async function generateMetadata({ params }: ConfirmationPageProps): Promise<Metadata> {
  const { code } = await params;
  return {
    title: `Reservation ${code} Confirmed | WSNexa`,
    description: `View details for reservation ${code}`,
  };
}

export default async function GuestConfirmationPage({ params, searchParams }: ConfirmationPageProps) {
  const { slug, code } = await params;
  const { token } = await searchParams;

  const result = await getGuestReservationDetailAction({
    confirmationCode: code,
    token: token || null,
  });

  if (!result.ok) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl bg-white border border-zinc-200 p-6 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 text-xl flex items-center justify-center mx-auto font-black">
            🔒
          </div>
          <h1 className="text-xl font-black text-zinc-950">Access Restricted</h1>
          <p className="text-xs font-medium text-zinc-600">
            {result.error.message || 'Verification token is missing or invalid. Please check your confirmation link.'}
          </p>
          <Link
            href={`/venues/${slug}`}
            className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-2xl bg-zinc-950 text-white font-extrabold text-xs"
          >
            Return to Venue
          </Link>
        </div>
      </div>
    );
  }

  const booking = result.data;
  const statusLabel = CustomerReservationService.getCustomerStatusLabel(booking.status);

  // Format date & time
  const startDate = new Date(booking.reservationStartAt);
  const formattedDate = startDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const formattedTime = startDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <div className="min-h-screen bg-zinc-50 font-sans antialiased text-zinc-950 flex flex-col justify-between">
      <div className="max-w-xl mx-auto px-4 py-8 sm:py-12 w-full">
        {/* Success Icon Badge */}
        <div className="text-center space-y-3 mb-8">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500 text-white text-3xl font-black flex items-center justify-center mx-auto shadow-md">
            ✓
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
            Reservation Received!
          </h1>
          <p className="text-xs font-semibold text-zinc-600">
            Confirmation Code:{' '}
            <span className="font-black text-zinc-950 tracking-wider bg-zinc-200 px-2 py-0.5 rounded-lg">
              {booking.confirmationCode}
            </span>
          </p>
        </div>

        {/* Details Card */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
            <div>
              <h2 className="text-lg font-black text-zinc-950">{booking.venueName}</h2>
              <p className="text-xs font-semibold text-zinc-500">{booking.branchName}</p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                booking.status === 'CONFIRMED'
                  ? 'bg-emerald-100 text-emerald-800'
                  : booking.status === 'PENDING'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-zinc-100 text-zinc-800'
              }`}
            >
              {statusLabel}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="font-black uppercase tracking-wider text-zinc-400 block mb-0.5">Date</span>
              <span className="font-extrabold text-zinc-900">{formattedDate}</span>
            </div>
            <div>
              <span className="font-black uppercase tracking-wider text-zinc-400 block mb-0.5">Time</span>
              <span className="font-extrabold text-zinc-900">{formattedTime}</span>
            </div>
            <div>
              <span className="font-black uppercase tracking-wider text-zinc-400 block mb-0.5">Party Size</span>
              <span className="font-extrabold text-zinc-900">{booking.partySize} Guests</span>
            </div>
            <div>
              <span className="font-black uppercase tracking-wider text-zinc-400 block mb-0.5">Guest Name</span>
              <span className="font-extrabold text-zinc-900">{booking.guestName}</span>
            </div>
          </div>

          {booking.occasion && (
            <div className="pt-3 border-t border-zinc-100 text-xs">
              <span className="font-black uppercase tracking-wider text-zinc-400 block mb-0.5">Occasion</span>
              <span className="font-extrabold text-zinc-900">{booking.occasion}</span>
            </div>
          )}

          {booking.specialRequests && (
            <div className="pt-3 border-t border-zinc-100 text-xs">
              <span className="font-black uppercase tracking-wider text-zinc-400 block mb-0.5">Special Requests</span>
              <span className="font-medium text-zinc-700">{booking.specialRequests}</span>
            </div>
          )}

          {/* Guest Arrival Info */}
          <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-700 font-medium space-y-1">
            <p className="font-extrabold text-zinc-900">📍 Arrival Instructions</p>
            <p>Please present your confirmation code upon arrival at the host stand. Check in with staff when you arrive.</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
          <Link
            href={`/venues/${slug}`}
            className="w-full flex-1 flex items-center justify-center min-h-[48px] px-4 py-3 rounded-2xl bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold text-xs transition-colors shadow-xs"
          >
            Return to Venue Page
          </Link>
          <Link
            href="/customer/reservations"
            className="w-full flex-1 flex items-center justify-center min-h-[48px] px-4 py-3 rounded-2xl bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-950 font-extrabold text-xs transition-colors"
          >
            My Reservations
          </Link>
        </div>
      </div>
    </div>
  );
}
