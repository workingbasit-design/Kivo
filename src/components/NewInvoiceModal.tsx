'use client';

import { useEffect } from 'react';
import { X } from '@/components/icons';
import InvoiceForm from '@/app/(app)/invoices/new/InvoiceForm';
import type { TaxConfig } from '@/lib/tax';
import { t, type Locale } from '@/lib/i18n';

/**
 * New Invoice modal (Invoices list redesign, ChatGPT Invoices prototype).
 *
 * The prototype's modal chrome - PAYMENTS & RECORDS kicker, "Create an
 * invoice", close button - wrapped around the REAL InvoiceForm and the
 * REAL createInvoice server action. No sample data, no fake persistence:
 * a successful submit redirects to the new invoice's detail page,
 * exactly like /invoices/new. Escape and backdrop clicks close the modal.
 */
export default function NewInvoiceModal({
  customers,
  taxConfig,
  locale,
  gstHstRegistered,
  onClose,
}: {
  customers: { id: string; name: string }[];
  taxConfig: TaxConfig;
  locale: Locale;
  gstHstRegistered: boolean;
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

  return (
    <div
      className="ej-invoices-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="ej-invoices-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ej-new-invoice-title"
      >
        <div className="ej-invoices-modal-heading">
          <div>
            <span className="ej-invoices-modal-kicker">
              {t(locale, 'billing.listEyebrow')}
            </span>
            <h2 id="ej-new-invoice-title">{t(locale, 'billing.newInvoice')}</h2>
            <p>{t(locale, 'billing.listSubtitle')}</p>
          </div>
          <button
            type="button"
            className="ej-invoices-modal-close"
            onClick={onClose}
            aria-label={t(locale, 'common.close')}
          >
            <X size={19} aria-hidden="true" />
          </button>
        </div>
        <InvoiceForm
          customers={customers}
          taxConfig={taxConfig}
          locale={locale}
          gstHstRegistered={gstHstRegistered}
          onCancel={onClose}
        />
      </section>
    </div>
  );
}
