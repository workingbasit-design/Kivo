'use client';

import { useActionState, useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Link2 } from 'lucide-react';
import { saveBookingSettings } from '@/app/actions/booking';
import { Card, Field, inputClass, primaryBtnClass } from '@/components/ui';
import { slugify } from '@/lib/slug';

const initialState = { error: undefined as string | undefined, ok: undefined as boolean | undefined };

export { slugify };

export default function BookingSettingsForm({
  initial,
  suggestedSlug,
}: {
  initial: { enabled: boolean; slug: string; headline: string; intro: string } | null;
  suggestedSlug: string;
}) {
  const [state, formAction, pending] = useActionState(saveBookingSettings, initialState);
  const [slug, setSlug] = useState(initial?.slug ?? suggestedSlug);
  const [copied, setCopied] = useState(false);
  // Set after mount so SSR and the first client render agree (avoids hydration mismatch).
  const [origin, setOrigin] = useState('');
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  const publicUrl = `${origin}/book/${slug}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <form action={formAction}>
        <Card className="p-6 space-y-5">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={initial?.enabled ?? true}
              className="mt-1 w-4 h-4 accent-[#6329d4]"
            />
            <span>
              <span className="block text-sm font-semibold text-zinc-900">Enable online booking</span>
              <span className="block text-xs text-zinc-500 mt-0.5">
                When on, anyone with your booking link can request a job — no app needed.
              </span>
            </span>
          </label>

          <Field label="Booking link" hint="Lowercase letters, numbers and hyphens only.">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 whitespace-nowrap">/book/</span>
              <input
                name="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                required
                minLength={3}
                maxLength={60}
                className={inputClass}
                placeholder={suggestedSlug}
              />
            </div>
          </Field>

          <Field label="Headline" hint="Shown at the top of your booking page.">
            <input
              name="headline"
              defaultValue={initial?.headline ?? ''}
              maxLength={120}
              placeholder="e.g. Book trusted AC repair in minutes"
              className={inputClass}
            />
          </Field>

          <Field label="Intro message" hint="A line or two about your services and areas covered.">
            <textarea
              name="intro"
              defaultValue={initial?.intro ?? ''}
              rows={3}
              maxLength={1000}
              placeholder="e.g. Same-day service across the city. Free inspection on every visit."
              className={inputClass}
            />
          </Field>

          {state.error && (
            <p className="text-sm font-medium text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
              {state.error}
            </p>
          )}
          {state.ok && (
            <p className="text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5">
              Booking page saved.
            </p>
          )}

          <button type="submit" disabled={pending} className={primaryBtnClass}>
            {pending ? 'Saving…' : 'Save booking page'}
          </button>
        </Card>
      </form>

      <Card className="p-6">
        <h2 className="text-sm font-bold text-zinc-900 mb-1 flex items-center gap-2">
          <Link2 size={15} /> Share your booking link
        </h2>
        <p className="text-xs text-zinc-500 mb-3">
          Put this on your WhatsApp status, Google profile or visiting card.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 truncate text-zinc-700">
            {publicUrl}
          </code>
          <button type="button" onClick={copyLink} className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700">
            {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <a href={publicUrl} target="_blank" rel="noreferrer" className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2.5 rounded-xl bg-[#6329d4] text-white hover:bg-[#5221b3]">
            <ExternalLink size={14} /> Open
          </a>
        </div>
      </Card>
    </div>
  );
}
