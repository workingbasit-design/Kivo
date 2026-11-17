'use client';

import { useEffect } from 'react';
import { ArrowRight, FileText, X } from '@/components/icons';
import { Button } from '@/components/kit';
import { t, type Locale } from '@/lib/i18n';

/**
 * Quote templates picker (Quotes list redesign, ChatGPT Quotes
 * prototype).
 *
 * The prototype's templates modal chrome — START FASTER kicker, template
 * rows with a green icon tile and an arrow — listing the business's REAL
 * saved templates (never the prototype's five hard-coded names).
 * Choosing one opens the New Quote modal pre-filled from that template;
 * applying a template COPIES its lines into the new quote, so a template
 * edit never rewrites quotes already built from it. Escape and backdrop
 * clicks close the modal.
 */
export default function QuoteTemplatesModal({
  templates,
  locale,
  onChoose,
  onClose,
}: {
  templates: { id: string; name: string; itemCount: number }[];
  locale: Locale;
  onChoose: (templateId: string) => void;
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

  const lineWord = (count: number) =>
    count === 1
      ? t(locale, 'quotes.templates.lineOne')
      : t(locale, 'quotes.templates.lineOther').replace('{count}', String(count));

  return (
    <div
      className="ej-quotes-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="ej-quotes-modal ej-quotes-modal-narrow"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ej-quote-templates-title"
      >
        <div className="ej-quotes-modal-heading">
          <div>
            <span className="ej-quotes-modal-kicker">
              {t(locale, 'quotes.list.eyebrow')}
            </span>
            <h2 id="ej-quote-templates-title">
              {t(locale, 'quotes.templates.title')}
            </h2>
            <p>{t(locale, 'quotes.templates.subtitle')}</p>
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

        {templates.length === 0 ? (
          <div className="ej-quotes-empty">
            <span className="ej-quotes-empty-icon">
              <FileText size={23} aria-hidden="true" />
            </span>
            <h2>{t(locale, 'quotes.templates.emptyTitle')}</h2>
            <p>{t(locale, 'quotes.templates.emptyDesc')}</p>
            <Button variant="primary" href="/quotes/templates/new">
              {t(locale, 'quotes.templates.newTemplate')}
            </Button>
          </div>
        ) : (
          <div className="ej-quotes-template-list">
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                className="ej-quotes-template-option"
                onClick={() => onChoose(tpl.id)}
              >
                <span className="ej-quotes-template-icon">
                  <FileText size={18} aria-hidden="true" />
                </span>
                <span>
                  <b>{tpl.name}</b>
                  <small>{lineWord(tpl.itemCount)}</small>
                </span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            ))}
          </div>
        )}

        <div className="ej-quotes-modal-actions">
          <Button variant="secondary" href="/quotes/templates">
            {t(locale, 'quotes.templates.manageTemplates')}
          </Button>
          <Button variant="ghost" type="button" onClick={onClose}>
            {t(locale, 'common.close')}
          </Button>
        </div>
      </section>
    </div>
  );
}
