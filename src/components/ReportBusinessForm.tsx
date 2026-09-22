'use client';

import { useActionState } from 'react';
import { AlertCircle, CheckCircle2, Flag } from 'lucide-react';
import { reportBusiness, type DirectoryActionResult } from '@/app/actions/directory';

const REASONS = [
  { value: 'spam', label: 'Spam / scam' },
  { value: 'fake-listing', label: 'Fake listing' },
  { value: 'wrong-info', label: 'Wrong contact info or prices' },
  { value: 'rude-behaviour', label: 'Rude behaviour' },
  { value: 'other', label: 'Something else' },
];

export default function ReportBusinessForm({ slug }: { slug: string }) {
  const [state, formAction, isPending] = useActionState<DirectoryActionResult, FormData>(
    reportBusiness,
    {}
  );

  if (state?.ok) {
    return (
      <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium rounded-xl px-3 py-2.5">
        <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
        <span>Thanks — we&apos;ve received your report and will review it.</span>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-2.5">
      <input type="hidden" name="slug" value={slug} />
      <select
        name="reason"
        required
        defaultValue="spam"
        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-[#8b5cf6]"
        aria-label="Reason"
      >
        {REASONS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      <textarea
        name="details"
        rows={2}
        maxLength={1000}
        placeholder="What happened? (optional)"
        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 placeholder:text-zinc-400 outline-none focus:border-[#8b5cf6]"
      />
      <input
        name="reporterContact"
        type="text"
        maxLength={120}
        placeholder="Your phone or email so we can follow up (optional)"
        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 placeholder:text-zinc-400 outline-none focus:border-[#8b5cf6]"
      />
      {state?.error && (
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-bold px-4 py-2 transition-colors disabled:opacity-60"
      >
        <Flag size={12} /> {isPending ? 'Sending…' : 'Send report'}
      </button>
    </form>
  );
}
