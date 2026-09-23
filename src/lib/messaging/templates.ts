/**
 * Track 9 — automated customer messaging: bilingual message templates.
 *
 * Pure, testable TypeScript: no DB, no network, no Next.js imports.
 * Every template is WhatsApp-friendly (short, plain Canadian language,
 * under 600 chars) and ends with a locale-correct CASL opt-out footer.
 */

export type MessageTemplateId =
  | 'reminder_24h'
  | 'reminder_dayof'
  | 'invoice_due'
  | 'invoice_overdue'
  | 'quote_followup_7d'
  | 'review_request';

export type MsgLocale = 'en' | 'fr';

export interface TemplateParams {
  businessName: string;
  customerName: string;
  jobTitle?: string;
  whenLabel?: string;
  invoiceNumber?: string;
  amountLabel?: string;
  payLink?: string;
  quoteNumber?: string;
}

export interface RenderedTemplate {
  subject: string;
  body: string;
}

export const TEMPLATE_IDS: MessageTemplateId[] = [
  'reminder_24h',
  'reminder_dayof',
  'invoice_due',
  'invoice_overdue',
  'quote_followup_7d',
  'review_request',
];

const OPT_OUT_EN = 'Reply STOP to opt out.';
const OPT_OUT_FR = 'Répondez ARRÊT pour vous désinscrire.';

function footer(locale: MsgLocale): string {
  return locale === 'fr' ? OPT_OUT_FR : OPT_OUT_EN;
}

/** "the Furnace check" / "l'inspection de la fournaise" — falls back to a generic label. */
function jobOr(label: string | undefined, en: string, fr: string, locale: MsgLocale): string {
  if (label && label.trim() !== '') return label;
  return locale === 'fr' ? fr : en;
}

/** Appends " (when)" when a whenLabel is present. */
function whenPart(whenLabel: string | undefined): string {
  const clean = (whenLabel ?? '').trim();
  if (!clean) return '';
  return ` (${clean})`;
}

function renderReminder24h(locale: MsgLocale, p: TemplateParams): RenderedTemplate {
  const job = jobOr(p.jobTitle, 'your appointment', 'votre rendez-vous', locale);
  if (locale === 'fr') {
    return {
      subject: `Rappel : ${p.jobTitle?.trim() || 'votre rendez-vous'} demain`,
      body:
        `Bonjour ${p.customerName}, ici ${p.businessName}. ` +
        `Petit rappel : ${job} est prévu demain${whenPart(p.whenLabel)}. ` +
        `Besoin de reporter? Répondez simplement à ce message.\n` +
        footer(locale),
    };
  }
  return {
    subject: `Job reminder: ${p.jobTitle?.trim() || 'your appointment'} tomorrow`,
    body:
      `Hi ${p.customerName}, this is ${p.businessName}. ` +
      `Just a reminder that ${job} is scheduled for tomorrow${whenPart(p.whenLabel)}. ` +
      `Need to reschedule? Just reply to this message.\n` +
      footer(locale),
  };
}

function renderReminderDayOf(locale: MsgLocale, p: TemplateParams): RenderedTemplate {
  const job = jobOr(p.jobTitle, 'your appointment', 'votre rendez-vous', locale);
  if (locale === 'fr') {
    return {
      subject: `Rappel : ${p.jobTitle?.trim() || 'votre rendez-vous'} aujourd'hui`,
      body:
        `Bonjour ${p.customerName}, ici ${p.businessName}. ` +
        `Petit rappel : ${job} est prévu aujourd'hui${whenPart(p.whenLabel)}. ` +
        `Besoin de reporter? Répondez simplement à ce message.\n` +
        footer(locale),
    };
  }
  return {
    subject: `Job reminder: ${p.jobTitle?.trim() || 'your appointment'} today`,
    body:
      `Hi ${p.customerName}, this is ${p.businessName}. ` +
      `Just a reminder that ${job} is scheduled for today${whenPart(p.whenLabel)}. ` +
      `Need to reschedule? Just reply to this message.\n` +
      footer(locale),
  };
}

function renderInvoiceDue(locale: MsgLocale, p: TemplateParams): RenderedTemplate {
  const invoice = (p.invoiceNumber ?? '').trim() || (locale === 'fr' ? 'votre facture' : 'your invoice');
  const amount = (p.amountLabel ?? '').trim();
  const payLine =
    p.payLink && p.payLink.trim() !== ''
      ? locale === 'fr'
        ? `Vous pouvez la payer ici : ${p.payLink.trim()} `
        : `You can pay here: ${p.payLink.trim()} `
      : '';
  if (locale === 'fr') {
    return {
      subject: `Petit rappel : facture ${invoice}`,
      body:
        `Bonjour ${p.customerName}, ici ${p.businessName}. ` +
        `Petit rappel : la facture ${invoice}${amount ? ` de ${amount}` : ''} a été envoyée récemment. ` +
        `${payLine}\n` +
        footer(locale),
    };
  }
  return {
    subject: `Friendly reminder: invoice ${invoice}`,
    body:
      `Hi ${p.customerName}, ${p.businessName} here. ` +
      `A friendly reminder that invoice ${invoice}${amount ? ` for ${amount}` : ''} was sent recently. ` +
      `${payLine}\n` +
      footer(locale),
  };
}

function renderInvoiceOverdue(locale: MsgLocale, p: TemplateParams): RenderedTemplate {
  const invoice = (p.invoiceNumber ?? '').trim() || (locale === 'fr' ? 'votre facture' : 'your invoice');
  const amount = (p.amountLabel ?? '').trim();
  const payLine =
    p.payLink && p.payLink.trim() !== ''
      ? locale === 'fr'
        ? `Vous pouvez la payer ici : ${p.payLink.trim()} `
        : `You can pay here: ${p.payLink.trim()} `
      : '';
  if (locale === 'fr') {
    return {
      subject: `Facture en retard : ${invoice}`,
      body:
        `Bonjour ${p.customerName}, ici ${p.businessName}. ` +
        `Selon nos dossiers, la facture ${invoice}${amount ? ` de ${amount}` : ''} est maintenant en retard. ` +
        `Merci de la régler dès que possible. ` +
        `${payLine}\n` +
        footer(locale),
    };
  }
  return {
    subject: `Overdue invoice: ${invoice}`,
    body:
      `Hi ${p.customerName}, ${p.businessName} here. ` +
      `Our records show invoice ${invoice}${amount ? ` for ${amount}` : ''} is now overdue. ` +
      `Please pay at your earliest convenience. ` +
      `${payLine}\n` +
      footer(locale),
  };
}

function renderQuoteFollowup(locale: MsgLocale, p: TemplateParams): RenderedTemplate {
  const quote = (p.quoteNumber ?? '').trim() || (locale === 'fr' ? 'votre devis' : 'your quote');
  const amount = (p.amountLabel ?? '').trim();
  if (locale === 'fr') {
    return {
      subject: `Suivi de votre devis ${quote}`,
      body:
        `Bonjour ${p.customerName}, ici ${p.businessName}. ` +
        `Nous vous avons envoyé le devis ${quote}${amount ? ` de ${amount}` : ''} il y a environ une semaine. ` +
        `N'hésitez pas à répondre à ce message si vous avez des questions.\n` +
        footer(locale),
    };
  }
  return {
    subject: `Following up on quote ${quote}`,
    body:
      `Hi ${p.customerName}, ${p.businessName} here. ` +
      `We sent you quote ${quote}${amount ? ` for ${amount}` : ''} about a week ago. ` +
      `Happy to answer any questions — just reply to this message.\n` +
      footer(locale),
  };
}

function renderReviewRequest(locale: MsgLocale, p: TemplateParams): RenderedTemplate {
  const job = jobOr(p.jobTitle, 'the work', 'le travail', locale);
  if (locale === 'fr') {
    return {
      subject: `Comment s'est passé votre expérience avec ${p.businessName}?`,
      body:
        `Bonjour ${p.customerName}, merci d'avoir choisi ${p.businessName}! ` +
        `Nous espérons que ${job} vous a satisfait. ` +
        `Nous aimerions beaucoup un avis Google si vous avez un moment.\n` +
        footer(locale),
    };
  }
  return {
    subject: `How was your experience with ${p.businessName}?`,
    body:
      `Hi ${p.customerName}, thanks for choosing ${p.businessName}! ` +
      `We hope you're happy with ${job}. ` +
      `We'd love a Google review if you have a moment — it really helps.\n` +
      footer(locale),
  };
}

export function renderTemplate(
  id: MessageTemplateId,
  locale: MsgLocale,
  params: TemplateParams
): RenderedTemplate {
  switch (id) {
    case 'reminder_24h':
      return renderReminder24h(locale, params);
    case 'reminder_dayof':
      return renderReminderDayOf(locale, params);
    case 'invoice_due':
      return renderInvoiceDue(locale, params);
    case 'invoice_overdue':
      return renderInvoiceOverdue(locale, params);
    case 'quote_followup_7d':
      return renderQuoteFollowup(locale, params);
    case 'review_request':
      return renderReviewRequest(locale, params);
    default: {
      const _exhaustive: never = id;
      throw new Error(`Unknown template id: ${_exhaustive}`);
    }
  }
}
