/**
 * Track 9 — automation scheduler: scans jobs/invoices/quotes and builds
 * the list of message candidates due right now.
 *
 * Pure, testable TypeScript: no DB, no network, no Next.js imports.
 * Dates are compared in the business timezone. The caller (engine) is
 * responsible for quota checks, CASL consent checks, quiet hours, and
 * rendering templates with the final business name.
 */

import type { MessageTemplateId, MsgLocale, TemplateParams } from './templates.ts';
import type { MessageChannel } from './consent.ts';
import { toISODateLocal } from '../utils.ts';
import { formatWhenLabel } from '../reminders.ts';
import { formatMoney } from '../money.ts';

export interface MessageCandidate {
  template: MessageTemplateId;
  channel: MessageChannel;
  customerId: string;
  customerName: string;
  toPhone: string | null;
  toEmail: string | null;
  locale: MsgLocale;
  eventKey: string;
  params: TemplateParams;
  href: string | null;
}

export interface AutomationToggles {
  reminder24h: boolean;
  reminderDayOf: boolean;
  invoiceDue: boolean;
  invoiceOverdue: boolean;
  quoteFollowup: boolean;
  reviewRequest: boolean;
}

export interface SchedJob {
  id: string;
  title: string;
  date: Date;
  time: string | null;
  status: string;
  customerId: string;
  customerName: string;
  phone: string | null;
  email: string | null;
  consent: boolean | null;
  locale: MsgLocale;
}

export interface SchedInvoice {
  id: string;
  number: string;
  total: number;
  date: Date;
  status: string;
  customerId: string;
  customerName: string;
  phone: string | null;
  email: string | null;
  consent: boolean | null;
  locale: MsgLocale;
}

export interface SchedQuote {
  id: string;
  number: string;
  total: number;
  status: string;
  createdAt: Date;
  customerId: string;
  customerName: string;
  phone: string | null;
  email: string | null;
  consent: boolean | null;
  locale: MsgLocale;
}

export interface SchedInput {
  now: Date;
  timeZone: string;
  toggles: AutomationToggles;
  jobs: SchedJob[];
  invoices: SchedInvoice[];
  quotes: SchedQuote[];
  alreadySentKeys: Set<string>;
  payLinkFor?: (invoiceId: string) => string | null;
  /** Optional: threaded into candidate params for rendering. */
  businessName?: string;
}

/**
 * Shift a Date into the business timezone: returns a Date whose *local*
 * calendar components equal the calendar components of `d` in `timeZone`,
 * so toISODateLocal() yields the business-local ISO date regardless of
 * the VM's own timezone.
 */
function shiftToTimeZone(d: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return new Date(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
}

/** ISO date (YYYY-MM-DD) of d in the business timezone. */
function isoDateInTimeZone(d: Date, timeZone: string): string {
  return toISODateLocal(shiftToTimeZone(d, timeZone));
}

function addDays(shiftedLocal: Date, days: number): Date {
  const d = new Date(shiftedLocal);
  d.setDate(d.getDate() + days);
  return d;
}

const REMINDER_STATUSES = ['NEW', 'SCHEDULED', 'IN PROGRESS'];
const UNPAID_STATUSES = ['UNPAID', 'PARTIALLY PAID'];

const DAY_MS = 24 * 60 * 60 * 1000;

function hasText(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim() !== '';
}

export function buildMessageCandidates(input: SchedInput): MessageCandidate[] {
  const { now, timeZone, toggles, alreadySentKeys } = input;
  const businessName = input.businessName ?? '';

  const todayShifted = shiftToTimeZone(now, timeZone);
  const todayISO = toISODateLocal(todayShifted);
  const tomorrowISO = toISODateLocal(addDays(todayShifted, 1));
  const threeDaysAgoISO = toISODateLocal(addDays(todayShifted, -3));
  const thirtyDaysAgoISO = toISODateLocal(addDays(todayShifted, -30));

  const candidates: MessageCandidate[] = [];

  const pickChannel = (phone: string | null, email: string | null): MessageChannel | null => {
    if (hasText(phone)) return 'WHATSAPP';
    if (hasText(email)) return 'EMAIL';
    return null;
  };

  const push = (c: Omit<MessageCandidate, 'params' | 'channel'> & { params: Omit<TemplateParams, 'businessName' | 'customerName'> }): void => {
    if (alreadySentKeys.has(c.eventKey)) return; // idempotency
    const channel = pickChannel(c.toPhone, c.toEmail);
    if (channel === null) return; // no contact info: skip
    candidates.push({
      ...c,
      channel,
      params: { businessName, customerName: c.customerName, ...c.params },
    });
  };

  for (const job of input.jobs) {
    const jobISO = isoDateInTimeZone(job.date, timeZone);
    const whenLabel = formatWhenLabel(job.date, job.time, job.locale);

    if (toggles.reminder24h && REMINDER_STATUSES.includes(job.status) && jobISO === tomorrowISO) {
      push({
        template: 'reminder_24h',
        customerId: job.customerId,
        customerName: job.customerName,
        toPhone: job.phone,
        toEmail: job.email,
        locale: job.locale,
        eventKey: `reminder24h:${job.id}:${tomorrowISO}`,
        params: { jobTitle: job.title, whenLabel },
        href: `/jobs/${job.id}`,
      });
    }

    if (toggles.reminderDayOf && REMINDER_STATUSES.includes(job.status) && jobISO === todayISO) {
      push({
        template: 'reminder_dayof',
        customerId: job.customerId,
        customerName: job.customerName,
        toPhone: job.phone,
        toEmail: job.email,
        locale: job.locale,
        eventKey: `reminderDayof:${job.id}:${todayISO}`,
        params: { jobTitle: job.title, whenLabel },
        href: `/jobs/${job.id}`,
      });
    }

    if (toggles.reviewRequest && job.status === 'COMPLETED' && jobISO >= threeDaysAgoISO && jobISO <= todayISO) {
      push({
        template: 'review_request',
        customerId: job.customerId,
        customerName: job.customerName,
        toPhone: job.phone,
        toEmail: job.email,
        locale: job.locale,
        eventKey: `reviewRequest:${job.id}`,
        params: { jobTitle: job.title },
        href: `/jobs/${job.id}`,
      });
    }
  }

  for (const invoice of input.invoices) {
    const invoiceISO = isoDateInTimeZone(invoice.date, timeZone);
    const payLink = input.payLinkFor?.(invoice.id) ?? null;
    const invoiceParams = {
      invoiceNumber: invoice.number,
      amountLabel: formatMoney(invoice.total, 'CAD', invoice.locale),
      ...(payLink ? { payLink } : {}),
    };

    if (toggles.invoiceDue && UNPAID_STATUSES.includes(invoice.status) && invoiceISO === threeDaysAgoISO) {
      push({
        template: 'invoice_due',
        customerId: invoice.customerId,
        customerName: invoice.customerName,
        toPhone: invoice.phone,
        toEmail: invoice.email,
        locale: invoice.locale,
        eventKey: `invoiceDue:${invoice.id}`,
        params: invoiceParams,
        href: `/invoices/${invoice.id}`,
      });
    }

    if (toggles.invoiceOverdue && UNPAID_STATUSES.includes(invoice.status) && invoiceISO < thirtyDaysAgoISO) {
      push({
        template: 'invoice_overdue',
        customerId: invoice.customerId,
        customerName: invoice.customerName,
        toPhone: invoice.phone,
        toEmail: invoice.email,
        locale: invoice.locale,
        eventKey: `invoiceOverdue:${invoice.id}`,
        params: invoiceParams,
        href: `/invoices/${invoice.id}`,
      });
    }
  }

  for (const quote of input.quotes) {
    if (toggles.quoteFollowup && quote.status === 'SENT') {
      const ageMs = now.getTime() - quote.createdAt.getTime();
      if (ageMs >= 6.5 * DAY_MS && ageMs <= 7.5 * DAY_MS) {
        push({
          template: 'quote_followup_7d',
          customerId: quote.customerId,
          customerName: quote.customerName,
          toPhone: quote.phone,
          toEmail: quote.email,
          locale: quote.locale,
          eventKey: `quoteFollowup:${quote.id}`,
          params: {
            quoteNumber: quote.number,
            amountLabel: formatMoney(quote.total, 'CAD', quote.locale),
          },
          href: `/quotes/${quote.id}`,
        });
      }
    }
  }

  return candidates;
}

/**
 * True when the local hour in `timeZone` falls in [startHour, endHour),
 * handling overnight wrap (e.g. 21 -> 8 means 21:00..08:00).
 */
export function isQuietHour(now: Date, timeZone: string, startHour: number, endHour: number): boolean {
  const hour = Number(
    new Intl.DateTimeFormat('en-CA', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(now)
  );
  if (startHour <= endHour) {
    return hour >= startHour && hour < endHour;
  }
  return hour >= startHour || hour < endHour;
}
