'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CustomerReservationDetailDTO } from '@/lib/reservations/reservation-types';
import { cancelCustomerReservationAction } from '@/server/actions/reservation-public';

interface CustomerReservationsClientProps {
  initialReservations: CustomerReservationDetailDTO[];
}

export function CustomerReservationsClient({ initialReservations }: CustomerReservationsClientProps) {
  const [reservations, setReservations] = useState<CustomerReservationDetailDTO[]>(initialReservations);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'cancelled'>('upcoming');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelModalRes, setCancelModalRes] = useState<CustomerReservationDetailDTO | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const upcomingList = reservations.filter((r) =>
    ['PENDING', 'CONFIRMED', 'ARRIVED', 'SEATED'].includes(r.status)
  );
  const pastList = reservations.filter((r) => ['COMPLETED', 'NO_SHOW'].includes(r.status));
  const cancelledList = reservations.filter((r) => ['CANCELLED', 'DECLINED'].includes(r.status));

  const activeList =
    activeTab === 'upcoming' ? upcomingList : activeTab === 'past' ? pastList : cancelledList;

  async function handleConfirmCancel() {
    if (!cancelModalRes) return;

    setCancellingId(cancelModalRes.id);
    setErrorMsg(null);

    const res = await cancelCustomerReservationAction({
      reservationId: cancelModalRes.id,
      guestAccessToken: cancelModalRes.guestAccessToken,
      reason: cancelReason.trim() || 'Cancelled by customer',
    });

    setCancellingId(null);

    if (res.ok) {
      setReservations((prev) =>
        prev.map((item) => (item.id === cancelModalRes.id ? res.data : item))
      );
      setCancelModalRes(null);
      setCancelReason('');
    } else {
      setErrorMsg(res.error.message);
    }
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-950 tracking-tight">My Table Reservations</h1>
          <p className="text-xs font-semibold text-zinc-500">
            View and manage your upcoming dining bookings and past reservation history.
          </p>
        </div>
        <Link
          href="/explore"
          className="inline-flex items-center justify-center min-h-[44px] px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs transition-colors shadow-xs"
        >
          + Book New Table
        </Link>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-extrabold">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('upcoming')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all touch-manipulation ${
            activeTab === 'upcoming'
              ? 'bg-zinc-950 text-white shadow-xs'
              : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
          }`}
        >
          Upcoming ({upcomingList.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('past')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all touch-manipulation ${
            activeTab === 'past'
              ? 'bg-zinc-950 text-white shadow-xs'
              : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
          }`}
        >
          Past ({pastList.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('cancelled')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all touch-manipulation ${
            activeTab === 'cancelled'
              ? 'bg-zinc-950 text-white shadow-xs'
              : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
          }`}
        >
          Cancelled ({cancelledList.length})
        </button>
      </div>

      {/* Reservation Cards List */}
      {activeList.length === 0 ? (
        <div className="py-12 text-center rounded-3xl border border-dashed border-zinc-300 bg-white p-8 space-y-3">
          <div className="text-3xl font-black">📅</div>
          <h3 className="text-sm font-black text-zinc-900">No {activeTab} reservations</h3>
          <p className="text-xs text-zinc-500 font-medium max-w-sm mx-auto">
            {activeTab === 'upcoming'
              ? 'You have no upcoming table bookings scheduled.'
              : activeTab === 'past'
              ? 'Your completed dining history will appear here.'
              : 'No cancelled bookings.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeList.map((res) => {
            const startDate = new Date(res.reservationStartAt);
            const formattedDate = startDate.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            });
            const formattedTime = startDate.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            });

            return (
              <div
                key={res.id}
                className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-2xs space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-black text-zinc-950">{res.venueName}</h3>
                      <p className="text-xs font-semibold text-zinc-500">{res.branchName}</p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        res.status === 'CONFIRMED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : res.status === 'PENDING'
                          ? 'bg-amber-100 text-amber-800'
                          : res.status === 'SEATED' || res.status === 'ARRIVED'
                          ? 'bg-blue-100 text-blue-800'
                          : res.status === 'CANCELLED' || res.status === 'DECLINED'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-zinc-100 text-zinc-800'
                      }`}
                    >
                      {res.customerStatusLabel}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                    <div>
                      <span className="font-black uppercase tracking-wider text-zinc-400 block text-[10px]">
                        Date &amp; Time
                      </span>
                      <span className="font-extrabold text-zinc-900">
                        {formattedDate} at {formattedTime}
                      </span>
                    </div>
                    <div>
                      <span className="font-black uppercase tracking-wider text-zinc-400 block text-[10px]">
                        Party Size
                      </span>
                      <span className="font-extrabold text-zinc-900">{res.partySize} Guests</span>
                    </div>
                    <div>
                      <span className="font-black uppercase tracking-wider text-zinc-400 block text-[10px]">
                        Confirmation
                      </span>
                      <span className="font-black text-zinc-900 tracking-wider font-mono">
                        {res.confirmationCode}
                      </span>
                    </div>
                    {res.occasion && (
                      <div>
                        <span className="font-black uppercase tracking-wider text-zinc-400 block text-[10px]">
                          Occasion
                        </span>
                        <span className="font-extrabold text-zinc-900">{res.occasion}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-zinc-100 flex items-center gap-2">
                  {res.venueSlug && res.guestAccessToken && (
                    <Link
                      href={`/venues/${res.venueSlug}/reserve/confirmation/${res.confirmationCode}?token=${res.guestAccessToken}`}
                      className="flex-1 min-h-[40px] px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-extrabold text-xs text-center flex items-center justify-center transition-colors"
                    >
                      View Details
                    </Link>
                  )}

                  {res.cancellationEligible && (
                    <button
                      type="button"
                      onClick={() => setCancelModalRes(res)}
                      className="min-h-[40px] px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-xs transition-colors touch-manipulation"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancellation Modal */}
      {cancelModalRes && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-3xl bg-white p-6 space-y-4 shadow-xl border border-zinc-200 animate-in fade-in">
            <h3 className="text-lg font-black text-zinc-950">Cancel Reservation?</h3>
            <p className="text-xs text-zinc-600 font-medium">
              Are you sure you want to cancel your table reservation at{' '}
              <strong className="text-zinc-900">{cancelModalRes.venueName}</strong> for{' '}
              <strong className="text-zinc-900">{cancelModalRes.partySize} guests</strong> on{' '}
              <strong className="text-zinc-900">{cancelModalRes.reservationDate}</strong>?
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-black text-zinc-700 uppercase tracking-wider">
                Cancellation Reason (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Schedule change"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-2xl border border-zinc-300 bg-white text-xs font-medium text-zinc-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancelModalRes(null)}
                disabled={cancellingId !== null}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-zinc-300 bg-white text-zinc-800 font-extrabold text-xs hover:bg-zinc-100"
              >
                Keep Booking
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={cancellingId !== null}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs disabled:opacity-50"
              >
                {cancellingId ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
