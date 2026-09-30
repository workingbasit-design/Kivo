"use client";

import { useActionState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Send, AlertCircle, BadgeCheck } from 'lucide-react';
import { sendQuoteRequest } from '@/app/actions/customer-requests';
import { Field, inputClass, primaryBtnClass } from '@/components/ui';

export default function CustomerQuoteForm({
  businessId,
  businessName,
  logoUrl,
  services,
  customerName,
  customerPhone,
}: {
  businessId: string;
  businessName: string;
  logoUrl: string | null;
  services: string[];
  customerName: string;
  customerPhone: string;
}) {
  const [state, formAction, isPending] = useActionState(sendQuoteRequest, { error: '' });

  return (
    <div className="space-y-5">
      <Link
        href="/customer"
        className="inline-flex items-center gap-1 text-sm font-semibold text-zinc-500 hover:text-zinc-800 min-h-[44px]"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to search
      </Link>

      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 rounded-3xl p-5 text-white shadow-lg shadow-indigo-600/25">
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle at 85% 15%, white 0, transparent 35%)',
          }}
        />
        <div className="relative flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur border border-white/30 flex items-center justify-center shrink-0 overflow-hidden">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-white">{businessName.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-bold text-[16px] text-white">{businessName}</h1>
              <BadgeCheck className="w-4 h-4 text-emerald-300" />
            </div>
            <p className="text-xs text-indigo-200">Verified pro · typically responds within a day</p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold tracking-tight text-zinc-900">Request a quote</h2>
        <p className="text-sm text-zinc-500 mt-0.5">
          Describe what you need — it's free and takes less than a minute.
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="businessId" value={businessId} />

        <Field label="What service do you need?">
          {services.length > 0 ? (
            <select name="service" required className={inputClass} defaultValue="">
              <option value="" disabled>
                Select a service…
              </option>
              {services.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              <option value="Other">Other</option>
            </select>
          ) : (
            <input
              name="service"
              required
              maxLength={100}
              placeholder="e.g. Fix leaky faucet"
              className={inputClass}
            />
          )}
        </Field>

        <Field label="Describe the job">
          <textarea
            name="description"
            rows={4}
            maxLength={2000}
            required
            placeholder="Tell the pro what you need, when, and any details…"
            className={`${inputClass} resize-none`}
          />
        </Field>

        {state?.error && (
          <div
            role="alert"
            className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-3 py-2.5"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            {state.error}
          </div>
        )}

        <button type="submit" disabled={isPending} className={primaryBtnClass}>
          <Send className="w-4 h-4" />
          {isPending ? 'Sending…' : 'Send quote request'}
        </button>

        <p className="text-xs text-zinc-400 text-center">
          Free for you. The pro receives your request as a lead.
        </p>
      </form>
    </div>
  );
}
