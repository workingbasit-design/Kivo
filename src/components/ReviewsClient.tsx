'use client';

import React, { useActionState, useTransition } from 'react';
import { Star, Trash2, AlertCircle, CheckCircle2, Plus } from 'lucide-react';
import { createReview, deleteReview, type ReviewResult } from '@/app/actions/reviews';
import { Card, StatCard, EmptyState, Field, inputClass, primaryBtnClass } from '@/components/ui';
import { formatDateShort } from '@/lib/utils';

export type ReviewItem = {
  id: string;
  rating: number;
  comment: string | null;
  source: string | null;
  customerName: string | null;
  createdAt: string;
};

export type CustomerOption = { id: string; name: string };

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

function AddReviewForm({ customers }: { customers: CustomerOption[] }) {
  const [state, formAction, isPending] = useActionState<ReviewResult, FormData>(createReview, {});
  const [show, setShow] = React.useState(false);

  return (
    <div>
      {!show ? (
        <button onClick={() => setShow(true)} className={primaryBtnClass}>
          <Plus size={14} /> Add review
        </button>
      ) : (
        <Card className="p-5 mb-6">
          <h3 className="font-bold text-zinc-900 mb-4">Add a review</h3>
          <form action={formAction} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Rating">
                <select name="rating" required defaultValue="5" className={inputClass}>
                  {[5, 4, 3, 2, 1].map((r) => (
                    <option key={r} value={r}>
                      {r} star{r === 1 ? '' : 's'}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Source" hint="e.g. Google, WhatsApp, Direct">
                <input name="source" type="text" maxLength={100} placeholder="Google" className={inputClass} />
              </Field>
            </div>
            <Field label="Customer (optional)">
              <select name="customerId" defaultValue="" className={inputClass}>
                <option value="">— No customer linked —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Comment">
              <textarea
                name="comment"
                rows={3}
                maxLength={2000}
                placeholder="What did the customer say?"
                className={inputClass}
              />
            </Field>

            {state?.error && (
              <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>{state.error}</span>
              </div>
            )}
            {state?.ok && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium rounded-xl px-3 py-2.5">
                <CheckCircle2 size={14} className="shrink-0" />
                <span>Review saved.</span>
              </div>
            )}

            <div className="flex gap-2">
              <button type="submit" disabled={isPending} className={primaryBtnClass}>
                {isPending ? 'Saving…' : 'Save review'}
              </button>
              <button type="button" onClick={() => setShow(false)} className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-500 hover:bg-zinc-100">
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}

function ReviewRow({ review }: { review: ReviewItem }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const handleDelete = () => {
    if (confirm('Delete this review?')) {
      startTransition(async () => {
        setError(null);
        const res = await deleteReview(review.id);
        if (res.error) setError(res.error);
      });
    }
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
          <div className="flex items-center gap-2 mb-1">
            <Stars rating={review.rating} />
            {review.source && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                via {review.source}
              </span>
            )}
          </div>
          {review.comment && <p className="text-sm text-zinc-800">{review.comment}</p>}
          <p className="text-xs text-zinc-400 mt-1">
            {review.customerName ?? 'Anonymous'} · {formatDateShort(review.createdAt)}
          </p>
        </div>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="text-zinc-300 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors shrink-0 disabled:opacity-50"
          title="Delete review"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

export default function ReviewsClient({
  reviews,
  customers,
  average,
  total,
}: {
  reviews: ReviewItem[];
  customers: CustomerOption[];
  average: string;
  total: number;
}) {
  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 gap-4">
        <StatCard
          label="Average rating"
          value={average}
          sub={total === 0 ? 'No reviews yet' : `Across ${total} review${total === 1 ? '' : 's'}`}
          icon={<Star size={16} />}
          accent="bg-amber-100 text-amber-600"
        />
        <StatCard
          label="Total reviews"
          value={String(total)}
          sub="Collect reviews to build trust"
          icon={<Star size={16} />}
          accent="bg-zinc-100 text-zinc-600"
        />
      </div>

      <AddReviewForm customers={customers} />

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
              <ReviewRow key={r.id} review={r} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
