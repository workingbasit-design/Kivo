'use client';

import React, { useActionState, useState } from 'react';
import { AlertCircle, CheckCircle2, Star } from 'lucide-react';
import { createPublicReview, type MarketingResult } from '@/app/actions/marketing';
import { Field, inputClass, primaryBtnClass } from '@/components/ui';
import { cn } from '@/lib/utils';

export default function PublicReviewForm({ businessId }: { businessId: string }) {
  const [state, formAction, pending] = useActionState<MarketingResult, FormData>(
    createPublicReview,
    {}
  );
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);

  if (state?.ok) {
    return (
      <div className="bg-white rounded-2xl border border-zinc-200/60 shadow-sm p-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={24} />
        </div>
        <h2 className="text-lg font-bold text-zinc-900 mb-1">Thank you!</h2>
        <p className="text-sm text-zinc-500">Your review has been recorded.</p>
      </div>
    );
  }

  const shown = hovered || rating;

  return (
    <form action={formAction} className="bg-white rounded-2xl border border-zinc-200/60 shadow-sm p-6 md:p-8 space-y-5">
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="rating" value={rating} />

      {state?.error && (
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <div>
        <p className="block text-xs font-semibold text-zinc-700 mb-2">Your rating</p>
        <div className="flex gap-1.5" role="radiogroup" aria-label="Star rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHovered(n)}
              onMouseLeave={() => setHovered(0)}
              aria-label={`${n} star${n === 1 ? '' : 's'}`}
              className="p-1"
            >
              <Star
                size={34}
                className={cn(
                  'transition-colors',
                  n <= shown ? 'fill-amber-400 text-amber-400' : 'fill-zinc-100 text-zinc-300'
                )}
              />
            </button>
          ))}
        </div>
        {rating === 0 && (
          <p className="text-[11px] text-zinc-400 mt-1">Tap a star to rate.</p>
        )}
      </div>

      <Field label="Your name (optional)">
        <input
          name="customerName"
          maxLength={120}
          placeholder="e.g. Ramesh"
          className={inputClass}
        />
      </Field>

      <Field label="Tell us about your experience (optional)">
        <textarea
          name="comment"
          maxLength={2000}
          rows={4}
          placeholder="What did you like about the work?"
          className={inputClass}
        />
      </Field>

      <button
        type="submit"
        disabled={pending || rating === 0}
        className={primaryBtnClass}
      >
        {pending ? 'Submitting…' : 'Submit review'}
      </button>
    </form>
  );
}
