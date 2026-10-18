'use client';

import React, { useActionState, useState } from 'react';
import { AlertCircle, CheckCircle2, Star } from '@/components/icons';
import { t, type Locale } from '@/lib/i18n';
import {
  submitTokenReview,
  type ReviewRequestResult,
} from '@/app/actions/review-requests';
import { Button, Textarea } from '@/components/kit';
import { cn } from '@/lib/utils';

/**
 * Public review form behind a single-use token (/rev/[token]).
 * Includes a honeypot field + minimum fill-time check (validated
 * server-side) as the CAPTCHA-or-equivalent bot protection.
 */
export default function TokenReviewForm({
  token,
  customerName,
  locale = 'en',
}: {
  token: string;
  customerName: string;
  locale?: Locale;
}) {
  const [state, formAction, pending] = useActionState<
    ReviewRequestResult,
    FormData
  >(submitTokenReview, {});
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  // Form render time for the minimum fill-time bot check (server-validated).
  const [renderedAtMs] = useState(() => Date.now());
  const L = (path: string) => t(locale, path);

  if (state?.ok) {
    return (
      <div className="bg-surface rounded-[20px] border border-line/70 shadow-[0_1px_3px_rgba(22,22,22,0.06)] p-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-ok-bg text-ok flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={24} />
        </div>
        <h2 className="text-lg font-bold text-ink mb-1">
          {L('t10money.reviewThanksTitle')}
        </h2>
        <p className="text-sm text-ink-2">{L('t10money.reviewThanksBody')}</p>
      </div>
    );
  }

  const shown = hovered || rating;

  return (
    <form
      action={formAction}
      className="bg-surface rounded-[20px] border border-line/70 shadow-[0_1px_3px_rgba(22,22,22,0.06)] p-6 md:p-8 space-y-5"
    >
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="rating" value={rating} />
      <input type="hidden" name="renderedAtMs" value={renderedAtMs} />
      {/* Honeypot: invisible to humans, filled by naive bots. Server-checked. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: -9999 }}>
        <input
          type="text"
          name="honeypot"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>

      {state?.error && (
        <div className="flex items-start gap-2 bg-danger-bg border border-line text-danger text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />{' '}
          <span>{state.error}</span>
        </div>
      )}

      <p className="text-xs text-ink-2">
        {L('t10money.reviewTokenPostingAs').replace('{name}', customerName)}
      </p>

      <div>
        <p
          id="review-rating-label"
          className="block text-xs font-semibold text-ink mb-2"
        >
          {L('t10money.reviewYourRating')}
        </p>
        <div
          className="flex gap-1"
          role="radiogroup"
          aria-labelledby="review-rating-label"
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHovered(n)}
              onMouseLeave={() => setHovered(0)}
              aria-checked={rating === n}
              aria-label={`${n}`}
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <Star
                size={34}
                className={cn(
                  'transition-colors',
                  n <= shown
                    ? 'fill-star text-star'
                    : 'fill-surface-2 text-ink-2'
                )}
              />
            </button>
          ))}
        </div>
        {rating === 0 && (
          <p className="text-[11px] text-ink-2 mt-1">
            {L('t10money.reviewTapToRate')}
          </p>
        )}
      </div>

      <Textarea
        label={L('t10money.reviewCommentLabel')}
        name="comment"
        maxLength={2000}
        rows={4}
        placeholder={L('t10money.reviewCommentPlaceholder')}
      />

      <Button
        type="submit"
        variant="primary"
        block
        disabled={pending || rating === 0}
      >
        {pending ? L('t10money.reviewSubmitting') : L('t10money.reviewSubmit')}
      </Button>
    </form>
  );
}
