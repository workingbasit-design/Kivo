'use client';

import React, { useEffect, useState, type CSSProperties } from 'react';
import { Link2 } from 'lucide-react';
import CopyButton from '@/components/CopyButton';
import { Card } from '@/components/ui';
import { formatDateShort } from '@/lib/utils';
import { t, type Locale } from '@/lib/i18n';

export type ReviewRequestRow = {
  jobId: string;
  jobTitle: string;
  jobDate: string;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
};

export default function ReviewRequestsClient({
  businessId,
  businessName,
  rows,
  locale,
}: {
  businessId: string;
  businessName: string;
  rows: ReviewRequestRow[];
  locale: Locale;
}) {
  const tr = (path: string) => t(locale, path);
  // Set after mount so SSR and the first client render agree (avoids hydration mismatch).
  const [origin, setOrigin] = useState('');
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  const reviewUrl = `${origin}/r/${businessId}`;
  const shareText = t(locale, 't10misc.marketing.reviewShareText')
    .replace('{business}', businessName)
    .replace('{url}', reviewUrl);

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2 mb-1">
          <Link2 size={14} className="text-zinc-400" /> {tr('t10misc.marketing.reviewLinkTitle')}
        </h2>
        <p className="text-xs text-zinc-500 mb-3">
          {tr('t10misc.marketing.reviewLinkDesc')}
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <code className="flex-1 text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-zinc-700 truncate">
            {reviewUrl}
          </code>
          <div className="flex gap-2 shrink-0">
            <CopyButton text={reviewUrl} label={tr('t10misc.marketing.copyLink')} />
            <CopyButton text={shareText} label={tr('t10misc.marketing.copyWhatsAppText')} />
          </div>
        </div>
      </Card>

      <div>
        <h2 className="text-sm font-bold text-zinc-900 mb-3">
          {tr('t10misc.marketing.recentNoReview').replace('{count}', String(rows.length))}
        </h2>
        {rows.length === 0 ? (
          <Card className="p-6">
            <p className="text-sm text-zinc-500">
              {tr('t10misc.marketing.noReviewsYet')}
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {rows.map((r, i) => (
              <Card key={r.jobId} className="p-4">
                <div className="ej-row-in flex items-center justify-between gap-3" style={{ '--row-delay': `${Math.min(i, 12) * 35}ms` } as CSSProperties}>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-zinc-900 truncate">{r.customerName}</p>
                    <p className="text-xs text-zinc-500 truncate">
                      {r.jobTitle} · {formatDateShort(new Date(r.jobDate), locale === 'fr' ? 'fr-CA' : 'en-CA')}
                    </p>
                    {r.customerPhone && (
                      <p className="text-[11px] text-zinc-400">{r.customerPhone}</p>
                    )}
                  </div>
                  <CopyButton
                    text={t(locale, 't10misc.marketing.reviewShareTextJob')
                      .replace('{name}', r.customerName)
                      .replace('{business}', businessName)
                      .replace('{job}', r.jobTitle)
                      .replace('{url}', reviewUrl)}
                    label={tr('t10misc.marketing.copyRequest')}
                    className="shrink-0"
                  />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
