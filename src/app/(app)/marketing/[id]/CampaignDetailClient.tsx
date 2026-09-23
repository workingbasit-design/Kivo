'use client';

import React, { useActionState, useState } from 'react';
import { AlertCircle, CheckCircle2, Pencil, Send, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  advanceCampaignStatus,
  deleteCampaign,
  type MarketingResult,
} from '@/app/actions/marketing';
import { renderTemplate } from '@/lib/marketing';
import CopyButton from '@/components/CopyButton';
import WhatsAppButton from '@/components/WhatsAppButton';
import { primaryBtnClass, secondaryBtnClass } from '@/components/ui';

export default function CampaignDetailClient({
  campaign,
  recipients,
  businessName,
  regionCode,
}: {
  campaign: { id: string; name: string; subject: string; body: string; status: string };
  recipients: { id: string; name: string; phone: string | null }[];
  businessName: string;
  regionCode?: string | null;
}) {
  const router = useRouter();
  const [advanceState, advanceAction, advancePending] = useActionState<MarketingResult, FormData>(
    async () => advanceCampaignStatus(campaign.id),
    {}
  );
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function handleDelete() {
    setDeletePending(true);
    setDeleteError(null);
    const res = await deleteCampaign(campaign.id);
    if (res?.ok) {
      router.push('/marketing');
    } else {
      setDeletePending(false);
      setDeleteError(res?.error ?? 'Could not delete this campaign.');
    }
  }

  const error = advanceState?.error || deleteError;

  const nextLabel =
    campaign.status === 'DRAFT'
      ? 'Queue for manual sending'
      : campaign.status === 'QUEUED'
        ? 'Mark as sent'
        : null;

  const visible = expanded ? recipients : recipients.slice(0, 10);

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {advanceState?.ok && (
        <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium rounded-xl px-3 py-2.5">
          <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
          <span>
            {campaign.status === 'DRAFT'
              ? 'Ready for manual sending. Copy each message below and send it yourself via WhatsApp or SMS.'
              : 'Marked as sent.'}
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {nextLabel && (
          <form action={advanceAction}>
            <button type="submit" disabled={advancePending} className={primaryBtnClass}>
              <Send size={13} />
              {advancePending ? 'Saving…' : nextLabel}
            </button>
          </form>
        )}
        {campaign.status === 'DRAFT' && (
          <button
            type="button"
            onClick={() => router.push(`/marketing/${campaign.id}/edit`)}
            className={secondaryBtnClass}
          >
            <Pencil size={13} /> Edit
          </button>
        )}
        {!confirmingDelete ? (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="ml-auto text-xs font-semibold text-rose-600 hover:text-rose-700 inline-flex items-center gap-1.5"
          >
            <Trash2 size={13} /> Delete campaign
          </button>
        ) : (
          <div className="ml-auto flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5">
            <span className="text-xs text-rose-700 font-medium">Delete this campaign?</span>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deletePending}
              className="text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-60 px-3 py-1.5 rounded-lg transition-colors"
            >
              {deletePending ? 'Deleting…' : 'Yes, delete'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="text-xs font-semibold text-zinc-600 hover:text-zinc-800 px-2 py-1.5"
            >
              Keep
            </button>
          </div>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
        <p className="text-xs text-amber-800 font-medium">
          EveryJob doesn&apos;t send messages itself — tap Send via WhatsApp on a
          message, or copy it and send it via WhatsApp or SMS yourself.{' '}
          {recipients.length} recipient{recipients.length === 1 ? '' : 's'}.
        </p>
      </div>

      {recipients.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No recipients match this campaign&apos;s audience right now.
        </p>
      ) : (
        <div className="space-y-3">
          {visible.map((r) => {
            const message = `${campaign.subject}\n\n${renderTemplate(campaign.body, {
              name: r.name,
              business: businessName,
            })}`;
            return (
              <div
                key={r.id}
                className="bg-white rounded-2xl border border-zinc-200/60 shadow-sm p-4"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-zinc-900 truncate">{r.name}</p>
                    {r.phone && <p className="text-[11px] text-zinc-400">{r.phone}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <WhatsAppButton phone={r.phone} message={message} regionCode={regionCode} />
                    <CopyButton text={message} label="Copy message" />
                  </div>
                </div>
                <p className="text-xs text-zinc-600 whitespace-pre-wrap bg-zinc-50 rounded-xl p-3 border border-zinc-100">
                  {message}
                </p>
              </div>
            );
          })}
          {recipients.length > 10 && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="text-xs font-semibold text-ink hover:text-graphite"
            >
              {expanded ? 'Show fewer' : `Show all ${recipients.length} recipients`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
