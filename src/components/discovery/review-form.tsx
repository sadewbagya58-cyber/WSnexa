'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { createReviewAction } from '@/server/actions/venue-discovery';

interface ReviewFormProps {
  venueProfileId: string;
  orderId: string;
  onSuccess?: () => void;
}

export function ReviewForm({ venueProfileId, orderId, onSuccess }: ReviewFormProps) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ success: boolean; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const res = await createReviewAction({
      venueProfileId,
      orderId,
      rating,
      reviewText,
    });

    setLoading(false);
    if (res.success) {
      setMessage({ success: true, text: res.message || 'Review submitted!' });
      if (onSuccess) onSuccess();
    } else {
      setMessage({ success: false, text: res.message || 'Failed to submit review.' });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
      <div className="space-y-1">
        <h3 className="text-base font-black text-zinc-950">Write a Verified Review</h3>
        <p className="text-xs text-zinc-500 font-medium leading-relaxed">
          Share your dining experience. Your review will display a <strong className="text-emerald-700 font-extrabold">✓ Verified Visit</strong> badge based on your completed order.
        </p>
      </div>

      {/* Star Selector */}
      <div className="space-y-1">
        <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Rating</label>
        <div className="flex items-center gap-1.5 text-2xl">
          {[1, 2, 3, 4, 5].map((star) => {
            const active = star <= (hoverRating || rating);
            return (
              <button
                key={star}
                type="button"
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setRating(star)}
                className="transition-transform hover:scale-125 focus:outline-hidden"
              >
                <span className={active ? 'text-amber-500' : 'text-zinc-200'}>★</span>
              </button>
            );
          })}
          <span className="text-xs font-black text-zinc-950 ml-2">
            {rating} of 5 Stars
          </span>
        </div>
      </div>

      {/* Review Text Area */}
      <div className="space-y-1">
        <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Review (Optional)</label>
        <textarea
          rows={3}
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          placeholder="What did you enjoy about the food, ambiance, or service?"
          maxLength={1000}
          className="w-full rounded-2xl border border-zinc-200 bg-zinc-50/50 p-3 text-xs font-medium text-zinc-950 placeholder-zinc-400 focus:bg-white focus:border-amber-500 focus:outline-hidden transition-all"
        />
      </div>

      {message && (
        <div
          className={`p-3 rounded-2xl text-xs font-bold ${
            message.success
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border border-rose-200 text-rose-900'
          }`}
        >
          {message.text}
        </div>
      )}

      <Button
        type="submit"
        disabled={loading}
        className="w-full bg-zinc-950 hover:bg-amber-500 hover:text-black text-white font-extrabold text-xs py-3 rounded-xl transition-all shadow-xs"
      >
        {loading ? 'Submitting Review...' : '✨ Submit Verified Review'}
      </Button>
    </form>
  );
}
