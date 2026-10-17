'use client';

import React from 'react';
import { ArrowLeft, Star } from '@/components/icons';
import ReviewLinkButton from '@/components/ReviewLinkButton';
import { Card } from '@/components/ui';
import { t, type Locale } from '@/lib/i18n';

/** Jobs that passed the review-moat eligibility check, rendered by the page. */
export type ReviewRequestRow = {
  jobId: string;
  jobTitle: string;
  customerName: string;
  dateLabel: string;
};

export default function ReviewRequestsClient({
  locale = 'en',
  rows,
}: {
  locale?: Locale;
  rows: ReviewRequestRow[];
}) {
  const tr = (path: string) => t(locale, `t10misc.marketing.${path}`);

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => window.history.back()}
        className="inline-flex items-center gap-1 text-xs font-semibold text-ink-2 hover:text-ink transition-colors"
      >
        <ArrowLeft size={13} /> {tr('backToMarketing')}
      </button>

      <div>
        <h1 className="text-2xl font-bold text-ink tracking-tight">
          {tr('reviewsTitle')}
        </h1>
        <p className="text-sm text-ink-2 mt-1">{tr('reviewsSubtitle')}</p>
      </div>

      <div className="flex items-start gap-2 bg-warn-bg border border-amber-200 text-amber-800 text-xs font-medium rounded-xl px-3 py-2.5">
        <Star size={14} className="mt-0.5 shrink-0" />
        <span>{tr('reviewHowItWorks')}</span>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-line">
          <h2 className="text-sm font-bold text-ink">
            {tr('recentNoReview').replace('{count}', String(rows.length))}
          </h2>
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-ink-2">{tr('noReviewsYet')}</p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((row) => (
              <li
                key={row.jobId}
                className="px-4 py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink truncate">
                    {row.jobTitle}
                  </p>
                  <p className="text-xs text-ink-2 truncate">
                    {row.customerName} · {row.dateLabel}
                  </p>
                </div>
                <ReviewLinkButton
                  jobId={row.jobId}
                  idleLabel={tr('reviewGetLink')}
                  copiedLabel={tr('reviewLinkCopied').replace(
                    '{name}',
                    row.customerName
                  )}
                  errorLabel={tr('reviewLinkError')}
                  className="shrink-0"
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
