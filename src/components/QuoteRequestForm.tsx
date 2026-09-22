'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, MessageSquareQuote, Send } from 'lucide-react';
import { submitQuoteRequest, type DirectoryActionResult } from '@/app/actions/directory';

const inputClass =
  'w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-800 placeholder:text-zinc-400 outline-none focus:border-[#8b5cf6]';

export default function QuoteRequestForm() {
  const [state, formAction, isPending] = useActionState<DirectoryActionResult, FormData>(
    submitQuoteRequest,
    {}
  );

  if (state?.ok) {
    return (
      <div className="bg-white rounded-2xl border border-zinc-200/60 shadow-sm p-6 md:p-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-6 h-6 text-emerald-600" />
        </div>
        <h2 className="text-lg font-bold text-zinc-900">Request sent!</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Your request is now sitting in the inbox of:
        </p>
        <ul className="mt-3 space-y-1.5">
          {(state.businessNames ?? []).map((n) => (
            <li key={n} className="text-sm font-semibold text-zinc-800 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2">
              {n}
            </li>
          ))}
        </ul>
        <p className="text-xs text-zinc-400 mt-4">
          They&apos;ll contact you directly if they can take the work. Kivo never charges you anything.
        </p>
        <Link href="/directory" className="inline-block mt-4 text-sm font-bold text-[#6329d4] hover:underline">
          ← Back to directory
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="bg-white rounded-2xl border border-zinc-200/60 shadow-sm p-6 md:p-8 space-y-4">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="w-10 h-10 rounded-xl bg-[#f1ecfd] flex items-center justify-center">
          <MessageSquareQuote className="w-5 h-5 text-[#6329d4]" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-zinc-900 tracking-tight">Request quotes</h1>
          <p className="text-xs text-zinc-500">One request, up to 5 matching pros. Free.</p>
        </div>
      </div>

      <div>
        <label htmlFor="qr-service" className="block text-xs font-bold text-zinc-700 mb-1">
          What do you need done?
        </label>
        <input
          id="qr-service"
          name="serviceNeed"
          required
          minLength={3}
          maxLength={200}
          placeholder="e.g. AC deep cleaning, leaky tap repair"
          className={inputClass}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="qr-city" className="block text-xs font-bold text-zinc-700 mb-1">
            City
          </label>
          <input
            id="qr-city"
            name="city"
            required
            minLength={2}
            maxLength={100}
            placeholder="e.g. Mumbai"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="qr-area" className="block text-xs font-bold text-zinc-700 mb-1">
            Area / locality <span className="font-normal text-zinc-400">(optional)</span>
          </label>
          <input
            id="qr-area"
            name="area"
            maxLength={100}
            placeholder="e.g. Andheri West"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="qr-details" className="block text-xs font-bold text-zinc-700 mb-1">
          Tell the pros a little more <span className="font-normal text-zinc-400">(optional)</span>
        </label>
        <textarea
          id="qr-details"
          name="details"
          rows={3}
          maxLength={1000}
          placeholder="e.g. 2 split ACs, Sunday morning works best"
          className={inputClass}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="qr-name" className="block text-xs font-bold text-zinc-700 mb-1">
            Your name
          </label>
          <input
            id="qr-name"
            name="name"
            required
            minLength={2}
            maxLength={100}
            placeholder="Your name"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="qr-phone" className="block text-xs font-bold text-zinc-700 mb-1">
            Your phone
          </label>
          <input
            id="qr-phone"
            name="phone"
            type="tel"
            required
            maxLength={25}
            placeholder="+91 98765 43210"
            className={inputClass}
          />
          <p className="text-[11px] text-zinc-400 mt-1">Only shared with the pros who receive your request.</p>
        </div>
      </div>

      {state?.error && (
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#6329d4] hover:bg-[#5223b3] text-white text-sm font-bold px-5 py-3 transition-colors disabled:opacity-60"
      >
        <Send size={15} /> {isPending ? 'Sending…' : 'Send request to matching pros'}
      </button>
      <p className="text-[11px] text-zinc-400 text-center">
        No spam, no commission. Pros reply only if they want the work.
      </p>
    </form>
  );
}
