'use client';

import React, { useEffect, useState } from 'react';
import { Link2 } from 'lucide-react';
import CopyButton from '@/components/CopyButton';
import { Card } from '@/components/ui';
import { formatDateShort } from '@/lib/utils';

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
}: {
  businessId: string;
  businessName: string;
  rows: ReviewRequestRow[];
}) {
  // Set after mount so SSR and the first client render agree (avoids hydration mismatch).
  const [origin, setOrigin] = useState('');
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  const reviewUrl = `${origin}/r/${businessId}`;
  const shareText = `Namaste! This is ${businessName}. If you were happy with our work, please leave us a quick review here: ${reviewUrl} — Thank you! 🙏`;

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2 mb-1">
          <Link2 size={14} className="text-zinc-400" /> Your public review link
        </h2>
        <p className="text-xs text-zinc-500 mb-3">
          Share this link with customers after a job. Anyone with the link can leave a review —
          it only shows your business name, nothing else.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <code className="flex-1 text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-zinc-700 truncate">
            {reviewUrl}
          </code>
          <div className="flex gap-2 shrink-0">
            <CopyButton text={reviewUrl} label="Copy link" />
            <CopyButton text={shareText} label="Copy WhatsApp text" />
          </div>
        </div>
      </Card>

      <div>
        <h2 className="text-sm font-bold text-zinc-900 mb-3">
          Recently completed jobs without a review ({rows.length})
        </h2>
        {rows.length === 0 ? (
          <Card className="p-6">
            <p className="text-sm text-zinc-500">
              Nothing here — every recent customer has already left a review, or there are no
              completed jobs in the last 60 days.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <Card key={r.jobId} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-zinc-900 truncate">{r.customerName}</p>
                    <p className="text-xs text-zinc-500 truncate">
                      {r.jobTitle} · {formatDateShort(new Date(r.jobDate))}
                    </p>
                    {r.customerPhone && (
                      <p className="text-[11px] text-zinc-400">{r.customerPhone}</p>
                    )}
                  </div>
                  <CopyButton
                    text={`Namaste ${r.customerName}! This is ${businessName}. If you were happy with our work (${r.jobTitle}), please leave us a quick review here: ${reviewUrl} — Thank you! 🙏`}
                    label="Copy request"
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
