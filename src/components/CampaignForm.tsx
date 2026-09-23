'use client';

import React, { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Eye, Users } from 'lucide-react';
import {
  createCampaign,
  updateCampaign,
  previewAudience,
  type MarketingResult,
} from '@/app/actions/marketing';
import { AUDIENCES, renderTemplate, type Audience } from '@/lib/marketing';
import { Field, inputClass, primaryBtnClass, secondaryBtnClass, Card } from '@/components/ui';

export default function CampaignForm({
  businessName,
  initial,
}: {
  businessName: string;
  initial?: { id: string; name: string; subject: string; body: string; audience: Audience };
}) {
  const router = useRouter();
  const action = initial ? updateCampaign : createCampaign;
  const [state, formAction, pending] = useActionState<MarketingResult, FormData>(action, {});

  const [name, setName] = useState(initial?.name ?? '');
  const [subject, setSubject] = useState(initial?.subject ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [audience, setAudience] = useState<Audience>(initial?.audience ?? 'ALL_CUSTOMERS');
  const [preview, setPreview] = useState<{ count: number; sample: { name: string; phone: string | null }[] } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (state?.ok && state.id) {
      router.push(`/marketing/${state.id}`);
    }
  }, [state, router]);

  async function handlePreview() {
    setPreviewLoading(true);
    const res = await previewAudience(audience);
    setPreviewLoading(false);
    if ('error' in res) {
      setPreview(null);
    } else {
      setPreview(res);
    }
  }

  const audienceHint = AUDIENCES.find((a) => a.value === audience)?.hint;
  const livePreview = renderTemplate(body || 'Your message will appear here…', {
    name: 'Ramesh',
    business: businessName,
  });

  return (
    <form action={formAction} className="space-y-6 max-w-3xl">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      {state?.error && (
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <Card className="p-6 space-y-4">
        <Field label="Campaign name">
          <input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={120}
            placeholder="e.g. Diwali AC service offer"
            className={inputClass}
          />
        </Field>

        <div>
          <Field label="Audience">
            <select
              name="audience"
              value={audience}
              onChange={(e) => setAudience(e.target.value as Audience)}
              className={inputClass}
            >
              {AUDIENCES.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-[11px] text-zinc-400">{audienceHint}</p>
            <button
              type="button"
              onClick={handlePreview}
              disabled={previewLoading}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6329d4] hover:text-[#5221b3] disabled:opacity-60"
            >
              <Users size={13} />
              {previewLoading ? 'Checking…' : 'Preview audience'}
            </button>
          </div>
          {preview && (
            <div className="mt-2 bg-violet-50 border border-violet-100 rounded-xl px-3 py-2.5">
              <p className="text-xs font-bold text-violet-900">
                {preview.count} recipient{preview.count === 1 ? '' : 's'}
              </p>
              {preview.sample.length > 0 && (
                <p className="text-[11px] text-violet-700 mt-0.5">
                  e.g. {preview.sample.map((s) => s.name).join(', ')}
                  {preview.count > preview.sample.length && '…'}
                </p>
              )}
              {preview.count === 0 && (
                <p className="text-[11px] text-violet-700 mt-0.5">
                  No customers match this audience yet.
                </p>
              )}
            </div>
          )}
        </div>

        <Field label="Subject / first line">
          <input
            name="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            maxLength={160}
            placeholder="e.g. Festive offer: 20% off AC servicing"
            className={inputClass}
          />
        </Field>

        <Field
          label="Message"
          hint="Use {{name}} for the customer's name and {{business}} for your business name."
        >
          <textarea
            name="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            maxLength={4000}
            rows={6}
            placeholder={'Namaste {{name}}! This is {{business}}. …'}
            className={inputClass}
          />
        </Field>
      </Card>

      <Card className="p-6">
        <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2 mb-3">
          <Eye size={14} className="text-zinc-400" /> Live preview
        </h3>
        <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4">
          <p className="text-xs font-bold text-zinc-900">{subject || 'Subject line…'}</p>
          <p className="text-sm text-zinc-600 mt-1.5 whitespace-pre-wrap">{livePreview}</p>
        </div>
        <p className="text-[11px] text-zinc-400 mt-2">
          Preview shows a sample name — the real message is personalised per customer.
        </p>
      </Card>

      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className={primaryBtnClass}>
          {pending ? 'Saving…' : initial ? 'Save changes' : 'Save draft campaign'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className={secondaryBtnClass}
        >
          Cancel
        </button>
      </div>

      <p className="text-[11px] text-zinc-400">
        EveryJob never sends messages itself — after queueing, you copy each message and send it
        yourself via WhatsApp or SMS.
      </p>
    </form>
  );
}
