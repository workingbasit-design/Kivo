'use client';

import React, { useActionState, useEffect, useTransition } from 'react';
import { BadgeCheck, Star, Trash2, AlertCircle, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { createReview, deleteReview, type ReviewResult } from '@/app/actions/reviews';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Card, StatCard, EmptyState, Field, FormGrid, inputClass, primaryBtnClass, secondaryBtnClass } from '@/components/ui';
import { t, type Locale } from '@/lib/i18n';
import { formatDateShort } from '@/lib/utils';

/**
 * Fires a toast exactly once per server-action result. Minimal inline
 * replacement for the removed useActionToast helper.
 */
function useResultToast<T extends { ok?: boolean; error?: string }>(
  state: T | undefined,
  messages: { success?: string; error?: string }
) {
  const seen = React.useRef<T | undefined>(undefined);
  React.useEffect(() => {
    if (!state || seen.current === state) return;
    seen.current = state;
    if (state.ok && messages.success) {
      toast.success(messages.success);
    } else if (state.error) {
      toast.error(messages.error ?? state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}

export type ReviewItem = {
  id: string;
  rating: number;
  comment: string | null;
  /** Classified display source: 'Verified', 'Google', or 'Legacy'. */
  source: string;
  /** True only for reviews created through a verified channel. */
  verified: boolean;
  reviewerName: string | null;
  reviewedAt: string | null;
  customerName: string | null;
  createdAt: string;
};

/** Jobs eligible for a review: completed + paid invoice. */
export type EligibleJobOption = { id: string; title: string; customerName: string };

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          className={i <= rating ? 'fill-amber-400 text-amber-400' : 'text-zinc-300'}
        />
      ))}
    </span>
  );
}

function AddReviewForm({
  eligibleJobs,
  locale,
}: {
  eligibleJobs: EligibleJobOption[];
  locale: Locale;
}) {
  const [state, formAction, isPending] = useActionState<ReviewResult, FormData>(createReview, {});
  const [show, setShow] = React.useState(false);

  useResultToast(state, {
    success: t(locale, 't10money.reviewSaved'),
  });

  useEffect(() => {
    if (state?.ok) setShow(false);
  }, [state]);

  return (
    <div>
      {!show ? (
        <button onClick={() => setShow(true)} className={primaryBtnClass}>
          <Plus size={14} /> {t(locale, 't10money.reviewAdd')}
        </button>
      ) : (
        <Card className="p-5 mb-6">
          <h3 className="font-bold text-zinc-900 mb-4">{t(locale, 't10money.reviewAddTitle')}</h3>
          <form action={formAction} className="space-y-4">
            <Field label={t(locale, 't10money.reviewJobLabel')} hint={t(locale, 't10money.reviewJobHint')}>
              <select name="jobId" required defaultValue="" className={inputClass}>
                <option value="" disabled>
                  {eligibleJobs.length === 0
                    ? t(locale, 't10money.reviewNoEligibleJobs')
                    : '—'}
                </option>
                {eligibleJobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title} · {j.customerName}
                  </option>
                ))}
              </select>
            </Field>
            <FormGrid>
              <Field label={t(locale, 't10money.reviewRating')}>
                <select name="rating" required defaultValue="5" className={inputClass}>
                  {[5, 4, 3, 2, 1].map((r) => (
                    <option key={r} value={r}>
                      {r === 1
                        ? t(locale, 't10money.reviewStarOne')
                        : t(locale, 't10money.reviewStarMany').replace('{count}', String(r))}
                    </option>
                  ))}
                </select>
              </Field>
            </FormGrid>
            <Field label={t(locale, 't10money.reviewComment')}>
              <textarea
                name="comment"
                rows={3}
                maxLength={2000}
                placeholder={t(locale, 't10money.reviewAddCommentPlaceholder')}
                className={inputClass}
              />
            </Field>

            {state?.error && (
              <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>{state.error}</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={isPending || eligibleJobs.length === 0} className={primaryBtnClass}>
                {isPending ? t(locale, 't10money.reviewSaving') : t(locale, 't10money.reviewSave')}
              </button>
              <button type="button" onClick={() => setShow(false)} className={secondaryBtnClass}>
                {t(locale, 't10money.leadCancel')}
              </button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}

function ReviewRow({ review, locale }: { review: ReviewItem; locale: Locale }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState(false);

  const runDelete = () => {
    setConfirming(false);
    startTransition(async () => {
      setError(null);
      const res = await deleteReview(review.id);
      if (res.error) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success(t(locale, 't10money.reviewDeleted'));
      }
    });
  };

  return (
    <div className="px-5 py-4 border-b border-zinc-100 last:border-0">
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2 mb-2">
          Couldn't delete: {error}
        </div>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Stars rating={review.rating} />
            {review.verified ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                <BadgeCheck size={11} />
                {t(locale, 't10money.reviewVerifiedBadge')}
              </span>
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                via {review.source}
              </span>
            )}
          </div>
          {review.comment && <p className="text-sm text-zinc-800">{review.comment}</p>}
          <p className="text-xs text-zinc-400 mt-1">
            {review.reviewerName ?? review.customerName ?? t(locale, 't10money.reviewAnonymous')} · {formatDateShort(review.reviewedAt ?? review.createdAt)}
          </p>
        </div>
        <button
          onClick={() => setConfirming(true)}
          disabled={isPending}
          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-zinc-300 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-colors shrink-0 disabled:opacity-50"
          title={t(locale, 't10money.reviewDeleteAria')}
          aria-label={t(locale, 't10money.reviewDeleteAria')}
        >
          <Trash2 size={16} />
        </button>
      </div>
      <ConfirmDialog
        open={confirming}
        title={t(locale, 't10money.reviewDeleteTitle')}
        message={t(locale, 't10money.reviewDeleteMessage')}
        confirmLabel={t(locale, 't10money.reviewDeleteConfirm')}
        cancelLabel={t(locale, 't10money.reviewDeleteKeep')}
        busy={isPending}
        onConfirm={runDelete}
        onClose={() => setConfirming(false)}
      />
    </div>
  );
}

export default function ReviewsClient({
  reviews,
  eligibleJobs,
  average,
  total,
  locale = 'en',
}: {
  reviews: ReviewItem[];
  eligibleJobs: EligibleJobOption[];
  average: string;
  total: number;
  locale?: Locale;
}) {
  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 gap-4">
        <StatCard
          label={t(locale, 't10money.reviewAvgRating')}
          value={average}
          sub={total === 0
            ? t(locale, 't10money.reviewNoReviewsYet')
            : total === 1
              ? t(locale, 't10money.reviewAcrossOne')
              : t(locale, 't10money.reviewAcrossMany').replace('{count}', String(total))}
          icon={<Star size={16} />}
          accent="bg-amber-100 text-amber-600"
        />
        <StatCard
          label={t(locale, 't10money.reviewTotalReviews')}
          value={String(total)}
          sub={t(locale, 't10money.reviewCollectHint')}
          icon={<Star size={16} />}
          accent="bg-zinc-100 text-zinc-600"
        />
      </div>

      <AddReviewForm eligibleJobs={eligibleJobs} locale={locale} />

      <Card>
        {reviews.length === 0 ? (
          <EmptyState
            icon={<Star size={24} />}
            title="No reviews yet"
            description="When customers praise your work, record it here. Good reviews help you win more jobs."
          />
        ) : (
          <div>
            {reviews.map((r) => (
              <ReviewRow key={r.id} review={r} locale={locale} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
