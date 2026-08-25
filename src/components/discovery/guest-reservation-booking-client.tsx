'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getPublicAvailableSlotsAction, createPublicBookingAction } from '@/server/actions/reservation-public';
import { ReservationSettingsDTO, TimeSlotDTO } from '@/lib/reservations/reservation-types';

interface GuestReservationBookingClientProps {
  venue: {
    display_name: string;
    slug: string;
    featured_branch_id: string;
    logo_url?: string | null;
    cover_image_url?: string | null;
  };
  branchName: string;
  initialSettings: ReservationSettingsDTO | null;
  currentUser: { id: string; name?: string; email?: string; phone?: string } | null;
}

export function GuestReservationBookingClient({
  venue,
  branchName,
  initialSettings,
  currentUser,
}: GuestReservationBookingClientProps) {
  const router = useRouter();

  const todayStr = new Date().toISOString().split('T')[0];
  const [reservationDate, setReservationDate] = useState<string>(todayStr);
  const [partySize, setPartySize] = useState<number>(initialSettings?.minimumPartySize || 2);

  const [slots, setSlots] = useState<TimeSlotDTO[]>([]);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlotDTO | null>(null);

  // Guest Details
  const [guestName, setGuestName] = useState<string>(currentUser?.name || '');
  const [guestEmail, setGuestEmail] = useState<string>(currentUser?.email || '');
  const [guestPhone, setGuestPhone] = useState<string>(currentUser?.phone || '');
  const [occasion, setOccasion] = useState<string>('');
  const [specialRequests, setSpecialRequests] = useState<string>('');
  const [consentPromotional, setConsentPromotional] = useState<boolean>(false);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load available time slots when date or partySize changes
  useEffect(() => {
    let active = true;

    async function loadSlots() {
      setLoadingSlots(true);
      setErrorMsg(null);
      setSelectedSlot(null);

      try {
        const res = await getPublicAvailableSlotsAction({
          venueSlug: venue.slug,
          reservationDate,
          partySize,
        });

        if (active) {
          if (res.ok) {
            setSlots(res.data);
          } else {
            setSlots([]);
            setErrorMsg(res.error.message);
          }
        }
      } catch (err: unknown) {
        if (active) {
          setSlots([]);
          setErrorMsg(
            typeof err === 'object' && err && 'message' in err
              ? (err as { message: string }).message
              : 'We couldn\'t load available times. Please try again.'
          );
        }
      } finally {
        if (active) {
          setLoadingSlots(false);
        }
      }
    }

    loadSlots();

    return () => {
      active = false;
    };
  }, [venue.slug, reservationDate, partySize]);

  async function handleSubmitBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSlot) {
      setErrorMsg('Please select a time slot for your reservation.');
      return;
    }

    if (!guestName.trim()) {
      setErrorMsg('Please enter your name.');
      return;
    }

    if (initialSettings?.requireGuestEmail && !guestEmail.trim()) {
      setErrorMsg('Email address is required by this venue.');
      return;
    }

    if (initialSettings?.requireGuestPhone && !guestPhone.trim()) {
      setErrorMsg('Phone number is required by this venue.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    const result = await createPublicBookingAction({
      venueSlug: venue.slug,
      branchId: venue.featured_branch_id,
      guestName: guestName.trim(),
      guestEmail: guestEmail.trim() || undefined,
      guestPhone: guestPhone.trim() || undefined,
      reservationStartAt: selectedSlot.startAt,
      partySize,
      occasion: occasion.trim() || undefined,
      specialRequests: specialRequests.trim() || undefined,
      consentPromotional,
    });

    setSubmitting(false);

    if (result.ok) {
      router.push(
        `/venues/${venue.slug}/reserve/confirmation/${result.data.confirmationCode}?token=${result.data.guestAccessToken}`
      );
    } else {
      setErrorMsg(result.error.message);
    }
  }

  const minParty = initialSettings?.minimumPartySize || 1;
  const maxParty = initialSettings?.maximumPartySize || 20;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
      {/* Header / Breadcrumb */}
      <div className="mb-6 space-y-2">
        <Link
          href={`/venues/${venue.slug}`}
          className="inline-flex items-center gap-1 text-xs font-black text-amber-600 hover:underline"
        >
          ← Back to {venue.display_name}
        </Link>
        <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
          Reserve a Table at {venue.display_name}
        </h1>
        <div className="flex items-center gap-2 text-xs font-bold text-zinc-600">
          <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
            📍 {branchName}
          </span>
          <span>• Instant Verification</span>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-extrabold flex items-center justify-between">
          <span>⚠️ {errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-rose-500 hover:text-rose-700 font-black text-sm ml-2"
          >
            ✕
          </button>
        </div>
      )}

      <form onSubmit={handleSubmitBooking} className="space-y-8">
        {/* Step 1: Party Size & Date */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-5">
          <h2 className="text-base font-black text-zinc-950 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-amber-500 text-black text-xs font-black flex items-center justify-center">
              1
            </span>
            Party &amp; Date
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Party Size Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-zinc-700 uppercase tracking-wider">Guests</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPartySize((p) => Math.max(minParty, p - 1))}
                  disabled={partySize <= minParty}
                  className="w-12 h-12 rounded-2xl border border-zinc-300 bg-zinc-100 disabled:opacity-40 text-zinc-900 font-black text-lg flex items-center justify-center touch-manipulation hover:bg-zinc-200 active:bg-zinc-300 transition-colors"
                >
                  -
                </button>
                <div className="flex-1 text-center min-h-[48px] flex items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 font-black text-sm text-zinc-900">
                  {partySize} {partySize === 1 ? 'Guest' : 'Guests'}
                </div>
                <button
                  type="button"
                  onClick={() => setPartySize((p) => Math.min(maxParty, p + 1))}
                  disabled={partySize >= maxParty}
                  className="w-12 h-12 rounded-2xl border border-zinc-300 bg-zinc-100 disabled:opacity-40 text-zinc-900 font-black text-lg flex items-center justify-center touch-manipulation hover:bg-zinc-200 active:bg-zinc-300 transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            {/* Date Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-zinc-700 uppercase tracking-wider">Date</label>
              <input
                type="date"
                min={todayStr}
                value={reservationDate}
                onChange={(e) => setReservationDate(e.target.value)}
                className="w-full min-h-[48px] px-3.5 py-2.5 rounded-2xl border border-zinc-300 bg-white text-xs font-extrabold text-zinc-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Step 2: Time Slot Selection */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-4">
          <h2 className="text-base font-black text-zinc-950 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-amber-500 text-black text-xs font-black flex items-center justify-center">
              2
            </span>
            Select Time Slot
          </h2>

          {loadingSlots ? (
            <div className="py-6 space-y-3">
              <div className="text-center text-xs font-extrabold text-amber-700 flex items-center justify-center gap-2 animate-pulse">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                Checking table availability...
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div
                    key={i}
                    className="min-h-[48px] rounded-2xl bg-zinc-100 border border-zinc-200 animate-pulse"
                  />
                ))}
              </div>
            </div>
          ) : slots.length === 0 ? (
            <div className="py-8 text-center text-xs font-extrabold text-zinc-600 bg-zinc-50 rounded-2xl border border-dashed border-zinc-300 space-y-1.5 p-4">
              <p className="text-sm font-black text-zinc-800">No available times for this date.</p>
              <p className="text-zinc-500 text-xs">
                Please try choosing another date or changing the party size ({partySize} guests).
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-72 overflow-y-auto pr-1">
              {slots.map((slot) => {
                const isSelected = selectedSlot?.time === slot.time;
                return (
                  <button
                    key={slot.time}
                    type="button"
                    disabled={!slot.available}
                    onClick={() => setSelectedSlot(slot)}
                    className={`min-h-[48px] px-3 py-2.5 rounded-2xl border text-xs font-extrabold transition-all touch-manipulation ${
                      isSelected
                        ? 'bg-amber-500 text-black border-amber-500 ring-2 ring-amber-400 shadow-xs scale-[1.02]'
                        : slot.available
                        ? 'bg-white text-zinc-950 border-zinc-300 hover:border-amber-400 active:bg-amber-50'
                        : 'bg-zinc-100 text-zinc-400 border-zinc-200 line-through opacity-50 cursor-not-allowed'
                    }`}
                  >
                    {slot.displayTime}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Step 3: Guest Details */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-4">
          <h2 className="text-base font-black text-zinc-950 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-amber-500 text-black text-xs font-black flex items-center justify-center">
              3
            </span>
            Guest Information
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-black text-zinc-700 uppercase tracking-wider">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Alex Morgan"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="w-full min-h-[48px] px-3.5 py-2.5 rounded-2xl border border-zinc-300 bg-white text-xs font-extrabold text-zinc-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black text-zinc-700 uppercase tracking-wider">
                Email Address {initialSettings?.requireGuestEmail && <span className="text-rose-500">*</span>}
              </label>
              <input
                type="email"
                placeholder="alex@example.com"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                className="w-full min-h-[48px] px-3.5 py-2.5 rounded-2xl border border-zinc-300 bg-white text-xs font-extrabold text-zinc-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black text-zinc-700 uppercase tracking-wider">
                Phone Number {initialSettings?.requireGuestPhone && <span className="text-rose-500">*</span>}
              </label>
              <input
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                className="w-full min-h-[48px] px-3.5 py-2.5 rounded-2xl border border-zinc-300 bg-white text-xs font-extrabold text-zinc-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-black text-zinc-700 uppercase tracking-wider">Occasion (Optional)</label>
              <select
                value={occasion}
                onChange={(e) => setOccasion(e.target.value)}
                className="w-full min-h-[48px] px-3.5 py-2.5 rounded-2xl border border-zinc-300 bg-white text-xs font-extrabold text-zinc-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              >
                <option value="">None / Regular Dining</option>
                <option value="Birthday">🎂 Birthday</option>
                <option value="Anniversary">💍 Anniversary</option>
                <option value="Date Night">✨ Date Night</option>
                <option value="Business">💼 Business Meeting</option>
                <option value="Celebration">🎉 Special Celebration</option>
              </select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-black text-zinc-700 uppercase tracking-wider">
                Special Requests (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Dietary requirements, seating preferences, etc."
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-zinc-300 bg-white text-xs font-medium text-zinc-900 focus:ring-2 focus:ring-amber-500 focus:outline-none resize-none"
              />
            </div>

            {/* Promotional Consent Opt-in */}
            <div className="sm:col-span-2 flex items-start gap-2.5 pt-2">
              <input
                id="consentPromotional"
                type="checkbox"
                checked={consentPromotional}
                onChange={(e) => setConsentPromotional(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-zinc-300 text-amber-500 focus:ring-amber-400"
              />
              <label htmlFor="consentPromotional" className="text-xs font-medium text-zinc-600 leading-normal">
                Receive promotional offers and event updates from {venue.display_name}. (Contact details used for booking confirmations regardless of selection).
              </label>
            </div>
          </div>
        </div>

        {/* Submit CTA */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={submitting || !selectedSlot}
            className="w-full min-h-[52px] px-6 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-black text-sm shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
          >
            {submitting ? 'Confirming Reservation...' : selectedSlot ? `Confirm Reservation for ${selectedSlot.displayTime}` : 'Select a Time Slot'}
          </button>
        </div>
      </form>
    </div>
  );
}
