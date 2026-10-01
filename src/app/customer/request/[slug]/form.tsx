"use client";

import { useActionState } from 'react';
import { ArrowLeft, Send, AlertCircle, BadgeCheck } from 'lucide-react';
import { sendQuoteRequest } from '@/app/actions/customer-requests';
import { t, type Locale } from '@/lib/i18n';
import { Field, inputClass, primaryBtnClass } from '@/components/ui';
import { Avatar, BackLink, Card } from '@/components/customer/ui';

export default function CustomerQuoteForm({
  businessId,
  businessName,
  logoUrl,
  services,
  customerName,
  customerPhone,
  locale,
}: {
  businessId: string;
  businessName: string;
  logoUrl: string | null;
  services: string[];
  customerName: string;
  customerPhone: string;
  locale: Locale;
}) {
  const [state, formAction, isPending] = useActionState(sendQuoteRequest, { error: '' });
  const tr = (path: string) => t(locale, path as never);

  return (
    <div className="space-y-5">
      <div className="ej-anim-fade-up">
        <BackLink href="/customer">
          <ArrowLeft className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
          {tr('customer.quote.backToSearch')}
        </BackLink>
      </div>

      <div className="ej-anim-fade-up" style={{ animationDelay: '60ms' }}>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Avatar name={businessName} logoUrl={logoUrl} size="lg" />
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-bold text-[16px] text-zinc-900">{businessName}</h1>
                <BadgeCheck className="w-4 h-4 text-indigo-600 fill-indigo-100" />
              </div>
              <p className="text-xs text-zinc-500">{tr('customer.quote.verifiedPro')} · {tr('customer.quote.respondsWithinDay')}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="ej-anim-fade-up" style={{ animationDelay: '120ms' }}>
        <h2 className="text-lg font-bold tracking-tight text-zinc-900">{tr('customer.quote.title')}</h2>
        <p className="text-sm text-zinc-500 mt-0.5">
          {tr('customer.quote.hint')}
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="businessId" value={businessId} />

        <Field label={tr('customer.quote.whatService')}>
          {services.length > 0 ? (
            <select name="service" required className={inputClass} defaultValue="">
              <option value="" disabled>
                {tr('customer.quote.selectService')}
              </option>
              {services.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              <option value="Other">{tr('customer.quote.other')}</option>
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

        <Field label={tr('customer.quote.describeJob')}>
          <textarea
            name="description"
            rows={4}
            maxLength={2000}
            required
            placeholder={tr('customer.quote.describePlaceholder')}
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
          {isPending ? tr('customer.quote.sending') : tr('customer.quote.send')}
        </button>

        <p className="text-xs text-zinc-400 text-center">
          {tr('customer.quote.freeNote')}
        </p>
      </form>
    </div>
  );
}
