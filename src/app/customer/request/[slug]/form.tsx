"use client";

import Link from 'next/link';
import { useActionState } from 'react';
import { ArrowLeft, Send, AlertCircle, BadgeCheck } from '@/components/icons';
import { sendQuoteRequest } from '@/app/actions/customer-requests';
import { t, type Locale } from '@/lib/i18n';
import { Button, Card, Input, Select, Textarea } from '@/components/kit';

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
  const initial = businessName.charAt(0).toUpperCase();

  return (
    <div className="space-y-5">
      <div className="ej-anim-fade-up">
        <Link
          href="/customer"
          className="group inline-flex items-center gap-1 text-sm font-semibold text-ink-2 hover:text-ink min-h-[44px] transition-colors"
        >
          <ArrowLeft className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
          {tr('customer.quote.backToSearch')}
        </Link>
      </div>

      <div className="ej-anim-fade-up" style={{ animationDelay: '60ms' }}>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid w-16 h-16 place-items-center rounded-full bg-surface-2 ring-1 ring-inset ring-line font-bold text-ink text-[22px] flex-none overflow-hidden"
            >
              {logoUrl ? (
                <img src={logoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                initial
              )}
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-bold text-[16px] text-ink">{businessName}</h1>
                <BadgeCheck className="w-4 h-4 text-info shrink-0" />
              </div>
              <p className="text-xs text-ink-2">{tr('customer.quote.verifiedPro')} · {tr('customer.quote.respondsWithinDay')}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="ej-anim-fade-up" style={{ animationDelay: '120ms' }}>
        <h2 className="text-lg font-bold tracking-tight text-ink">{tr('customer.quote.title')}</h2>
        <p className="text-sm text-ink-2 mt-0.5">
          {tr('customer.quote.hint')}
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="businessId" value={businessId} />

        {services.length > 0 ? (
          <Select
            label={tr('customer.quote.whatService')}
            name="service"
            required
            defaultValue=""
            options={[
              { value: '', label: tr('customer.quote.selectService'), disabled: true },
              ...services.map((s) => ({ value: s, label: s })),
              { value: 'Other', label: tr('customer.quote.other') },
            ]}
          />
        ) : (
          <Input
            label={tr('customer.quote.whatService')}
            name="service"
            required
            maxLength={100}
            placeholder="e.g. Fix leaky faucet"
          />
        )}

        <Textarea
          label={tr('customer.quote.describeJob')}
          name="description"
          rows={4}
          maxLength={2000}
          required
          placeholder={tr('customer.quote.describePlaceholder')}
        />

        {state?.error && (
          <div
            role="alert"
            className="flex items-start gap-2 bg-danger-bg border border-line text-danger text-xs font-medium rounded-xl px-3 py-2.5"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            {state.error}
          </div>
        )}

        <Button type="submit" disabled={isPending} block>
          <Send className="w-4 h-4" />
          {isPending ? tr('customer.quote.sending') : tr('customer.quote.send')}
        </Button>

        <p className="text-xs text-ink-2 text-center">
          {tr('customer.quote.freeNote')}
        </p>
      </form>
    </div>
  );
}
