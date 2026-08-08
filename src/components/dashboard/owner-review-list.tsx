'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { VenueReviewRecord } from '@/server/services/venue-review.service';
import { respondToReviewAction } from '@/server/actions/venue-discovery';

interface OwnerReviewListProps {
  reviews: VenueReviewRecord[];
  canRespond: boolean;
}

export function OwnerReviewList({ reviews, canRespond }: OwnerReviewListProps) {
  const [activeRespondId, setActiveRespondId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ success: boolean; text: string } | null>(null);

  const handlePostResponse = async (reviewId: string) => {
    setLoading(true);
    setMessage(null);

    const res = await respondToReviewAction({
      reviewId,
      response: responseText,
    });

    setLoading(false);
    if (res.success) {
      setMessage({ success: true, text: res.message || 'Response posted!' });
      setActiveRespondId(null);
      setResponseText('');
    } else {
      setMessage({ success: false, text: res.message || 'Failed to post response.' });
    }
  };

  if (reviews.length === 0) {
    return (
      <div className="rounded-3xl border border-zinc-200 bg-white p-12 text-center space-y-4 shadow-sm max-w-md mx-auto my-12">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-3xl">
          💬
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-zinc-950">No customer reviews yet</h3>
          <p className="text-xs text-zinc-500 font-medium">
            Once guests complete orders and leave feedback, reviews will appear here for management responses.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {message && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold ${
            message.success
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border border-rose-200 text-rose-900'
          }`}
        >
          {message.text}
        </div>
      )}

      {reviews.map((r) => (
        <div key={r.id} className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-zinc-950">{r.user_name}</h3>
              {r.is_verified_visit && (
                <Badge className="bg-emerald-100 text-emerald-950 border border-emerald-300 text-[10px] font-black">
                  ✓ Verified Visit
                </Badge>
              )}
              {r.order_number_formatted && (
                <span className="text-[11px] font-mono font-bold text-zinc-400">{r.order_number_formatted}</span>
              )}
            </div>
            <span className="text-[11px] text-zinc-400 font-medium">{new Date(r.created_at).toLocaleDateString()}</span>
          </div>

          {/* Rating Stars */}
          <div className="flex items-center gap-1 text-amber-500 text-sm">
            {Array.from({ length: r.rating }).map((_, i) => (
              <span key={i}>★</span>
            ))}
            <span className="text-xs font-black text-zinc-950 ml-2">{r.rating} / 5</span>
          </div>

          {r.review_text && <p className="text-xs text-zinc-700 font-medium leading-relaxed">{r.review_text}</p>}

          {/* Existing Response */}
          {r.owner_response && (
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-1">
              <div className="text-[11px] font-black text-amber-950 flex items-center justify-between">
                <span>🏢 Manager Response:</span>
                {r.owner_responded_at && (
                  <span className="text-[10px] font-medium text-amber-800">
                    {new Date(r.owner_responded_at).toLocaleDateString()}
                  </span>
                )}
              </div>
              <p className="text-xs text-amber-900 font-medium">{r.owner_response}</p>
            </div>
          )}

          {/* Respond Form */}
          {canRespond && (
            <div>
              {activeRespondId === r.id ? (
                <div className="space-y-3 pt-2">
                  <textarea
                    rows={3}
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    placeholder="Write an official manager response to this review..."
                    maxLength={1000}
                    className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-medium text-zinc-950 focus:border-amber-500 focus:outline-hidden"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      onClick={() => setActiveRespondId(null)}
                      variant="outline"
                      className="text-xs font-bold py-1.5"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={() => handlePostResponse(r.id)}
                      disabled={loading || responseText.trim().length === 0}
                      className="bg-zinc-950 hover:bg-amber-500 hover:text-black text-white text-xs font-extrabold py-1.5"
                    >
                      {loading ? 'Posting...' : 'Post Manager Response'}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  onClick={() => {
                    setActiveRespondId(r.id);
                    setResponseText(r.owner_response || '');
                  }}
                  variant="outline"
                  className="text-xs font-bold py-1.5 border-zinc-200 text-zinc-700"
                >
                  💬 {r.owner_response ? 'Edit Manager Response' : 'Respond to Guest Review'}
                </Button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
