'use client';

import React, { useActionState, useEffect, useTransition } from 'react';
import { BadgeCheck, Star, Trash2, AlertCircle, Plus } from '@/components/icons';
import { toast } from 'sonner';
import { createReview, deleteReview, type ReviewResult } from '@/app/actions/reviews';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Button, Card, EmptyState, Select, SummaryCard, Textarea } from '@/components/kit';
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
          className={i <= rating ? 'fill-star text-star' : 'text-ink-2'}
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
  const [show, setShow] = React.useState(false);
  // Wrap so the form closes on success in the submission handler
  // (user-initiated) instead of syncing via an effect.
  const [state, formAction, isPending] = useActionState<ReviewResult, FormData>(
    async (prev, formData) => {
      const result = await createReview(prev, formData);
      if (result?.ok) setShow(false);
      return result;
    },
    {}
  );

  useResultToast(state, {
    success: t(locale, 't10money.reviewSaved'),
  });

  // (Form tidy-up now happens in the action wrapper above.)

  return (
    <div>
      {!show ? (
        <Button type="button" variant="primary" onClick={() => setShow(true)}>
          <Plus size={14} /> {t(locale, 't10money.reviewAdd')}
        </Button>
      ) : (
        <Card className="p-5 mb-6">
          <h3 className="font-bold text-ink mb-4">{t(locale, 't10money.reviewAddTitle')}</h3>
          <form action={formAction} className="space-y-4">
            <Select
              label={t(locale, 't10money.reviewJobLabel')}
              hint={t(locale, 't10money.reviewJobHint')}
              name="jobId"
              required
              defaultValue=""
              options={[
                {
                  value: '',
                  label:
                    eligibleJobs.length === 0
                      ? t(locale, 't10money.reviewNoEligibleJobs')
                      : '-',
                  disabled: true,
                },
                ...eligibleJobs.map((j) => ({
                  value: j.id,
                  label: `${j.title} · ${j.customerName}`,
                })),
              ]}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label={t(locale, 't10money.reviewRating')}
                name="rating"
                required
                defaultValue="5"
                options={[5, 4, 3, 2, 1].map((r) => ({
                  value: String(r),
                  label:
                    r === 1
                      ? t(locale, 't10money.reviewStarOne')
                      : t(locale, 't10money.reviewStarMany').replace('{count}', String(r)),
                }))}
              />
            </div>
            <Textarea
              label={t(locale, 't10money.reviewComment')}
              name="comment"
              rows={3}
              maxLength={2000}
              placeholder={t(locale, 't10money.reviewAddCommentPlaceholder')}
            />

            {state?.error && (
              <div className="flex items-start gap-2 bg-danger-bg border border-line text-danger text-xs font-medium rounded-xl px-3 py-2.5">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>{state.error}</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="primary" disabled={isPending || eligibleJobs.length === 0}>
                {isPending ? t(locale, 't10money.reviewSaving') : t(locale, 't10money.reviewSave')}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setShow(false)}>
                {t(locale, 't10money.leadCancel')}
              </Button>
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
    <div className="px-5 py-4 border-b border-line last:border-0">
      {error && (
        <div className="bg-danger-bg border border-line text-danger text-xs font-medium rounded-xl px-3 py-2 mb-2">
          Couldn&apos;t delete: {error}
        </div>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Stars rating={review.rating} />
            {review.verified ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-ok bg-ok-bg border border-line rounded-full px-2 py-0.5">
                <BadgeCheck size={11} />
                {t(locale, 't10money.reviewVerifiedBadge')}
              </span>
            ) : (
              <span className="text-[10px] font-bold text-ink-2">
                via {review.source}
              </span>
            )}
          </div>
          {review.comment && <p className="text-sm text-ink">{review.comment}</p>}
          <p className="text-xs text-ink-2 mt-1">
            {review.reviewerName ?? review.customerName ?? t(locale, 't10money.reviewAnonymous')} · {formatDateShort(review.reviewedAt ?? review.createdAt)}
          </p>
        </div>
        <button
          onClick={() => setConfirming(true)}
          disabled={isPending}
          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-ink-2 hover:text-danger rounded-xl hover:bg-danger-bg transition-colors shrink-0 disabled:opacity-50"
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
      <SummaryCard
        stats={[
          {
            label: t(locale, 't10money.reviewAvgRating'),
            value: average,
            sub:
              total === 0
                ? t(locale, 't10money.reviewNoReviewsYet')
                : total === 1
                  ? t(locale, 't10money.reviewAcrossOne')
                  : t(locale, 't10money.reviewAcrossMany').replace('{count}', String(total)),
          },
          {
            label: t(locale, 't10money.reviewTotalReviews'),
            value: String(total),
            sub: t(locale, 't10money.reviewCollectHint'),
          },
        ]}
      />

      <AddReviewForm eligibleJobs={eligibleJobs} locale={locale} />

      <Card>
        {reviews.length === 0 ? (
          <EmptyState
            icon={Star}
            title="No reviews yet"
            text="When customers praise your work, record it here. Good reviews help you win more jobs."
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
