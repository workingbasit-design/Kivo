'use client';

import { useEffect } from 'react';
import { X } from '@/components/icons';
import QuoteForm from '@/app/(app)/quotes/new/QuoteForm';
import type { TaxConfig } from '@/lib/tax';
import { t, type Locale } from '@/lib/i18n';

/**
 * New Quote modal (Quotes list redesign, ChatGPT Quotes prototype).
 *
 * The prototype's modal chrome — ESTIMATES & PROPOSALS kicker, "New
 * quote", close button — wrapped around the REAL QuoteForm and the REAL
 * createQuote server action. No sample data, no fake persistence: a
 * successful submit redirects to the new quote's detail page, exactly
 * like /quotes/new. Escape and backdrop clicks close the modal. A
 * template chosen in the templates picker starts the form pre-filled
 * (title + lines) via initialTemplateId.
 */
export default function NewQuoteModal({
  customers,
  taxConfig,
  templates,
  locale,
  gstHstRegistered,
  initialTemplateId = '',
  onClose,
}: {
  customers: { id: string; name: string }[];
  taxConfig: TaxConfig;
  templates: {
    id: string;
    name: string;
    items: { desc: string; qty: string; rate: string; cost: string }[];
  }[];
  locale: Locale;
  gstHstRegistered: boolean;
  initialTemplateId?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const subtitle = gstHstRegistered
    ? t(locale, 'quotes.new.subtitle').replace('{taxLabel}', taxConfig.label)
    : t(locale, 'quotes.new.subtitleNoTax');

  return (
    <div
      className="ej-quotes-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="ej-quotes-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ej-new-quote-title"
      >
        <div className="ej-quotes-modal-heading">
          <div>
            <span className="ej-quotes-modal-kicker">
              {t(locale, 'quotes.list.eyebrow')}
            </span>
            <h2 id="ej-new-quote-title">{t(locale, 'quotes.new.title')}</h2>
            <p>{subtitle}</p>
          </div>
          <button
            type="button"
            className="ej-quotes-modal-close"
            onClick={onClose}
            aria-label={t(locale, 'common.close')}
          >
            <X size={19} aria-hidden="true" />
          </button>
        </div>
        <QuoteForm
          customers={customers}
          taxConfig={taxConfig}
          templates={templates}
          locale={locale}
          gstHstRegistered={gstHstRegistered}
          initialTemplateId={initialTemplateId}
          onCancel={onClose}
        />
      </section>
    </div>
  );
}
