/**
 * Scroll lesson 7 — tap-to-expand plain-language explainers for quotes
 * and invoices. Static templates only: the page resolves the localized
 * strings (EN/FR) and passes the record's own numbers in; these builders
 * fill them and order them. No LLM, no fetched copy, nothing generated
 * per customer — the same sentence explains the same number every time.
 *
 * A line is { label, text }: the label names the row it explains
 * (Subtotal, GST, Total…), the text says what it means in plain words.
 * Lines that do not apply (no payment yet, no discount, no due date)
 * are simply omitted, so the explainer never states a zero as a fact.
 */
import { fillTemplate } from "./revenue.ts";

export interface ExplainerLine {
  label: string;
  text: string;
}

export interface ExplainerStrings {
  title: string;
  labelSubtotal: string;
  labelTotal: string;
  labelPaid: string;
  labelBalance: string;
  labelDue: string;
  labelOverdue: string;
  labelStatus: string;
  subtotal: string;
  taxOnSubtotal: string;
  quebecTaxNote: string;
  totalInvoice: string;
  totalQuote: string;
  paid: string;
  balance: string;
  due: string;
  overdue: string;
  discount: string;
  statusUnpaid: string;
  statusPartial: string;
  statusPaid: string;
  statusVoid: string;
  statusDraft: string;
  statusSent: string;
  statusApproved: string;
  statusDeclined: string;
}

export interface TaxLineInput {
  name: string;
  rate: number;
  amount: string; // already formatted for the locale, e.g. "$10.00"
}

function taxLines(
  taxes: TaxLineInput[],
  s: ExplainerStrings,
): ExplainerLine[] {
  return taxes.map((l) => ({
    label: `${l.name} ${l.rate}%`,
    text:
      fillTemplate(s.taxOnSubtotal, {
        name: l.name,
        rate: String(l.rate),
        amount: l.amount,
      }) + (l.name.toUpperCase() === "QST" ? ` ${s.quebecTaxNote}` : ""),
  }));
}

export interface InvoiceExplainerInput {
  subtotal: string;
  taxes: TaxLineInput[];
  total: string;
  paid: string;
  paidCents: number | bigint;
  balance: string;
  remainingCents: number | bigint;
  status: string;
  voided: boolean;
  dueAt: Date | null;
  dueTimezone: string;
  locale: "en" | "fr";
  overdue: boolean;
  strings: ExplainerStrings;
}

function formatDueDate(d: Date, tz: string, locale: "en" | "fr"): string {
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-CA" : "en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

/** Plain-language walk through an invoice's totals, top to bottom. */
export function buildInvoiceExplainerLines(
  input: InvoiceExplainerInput,
): ExplainerLine[] {
  const s = input.strings;
  const lines: ExplainerLine[] = [
    {
      label: s.labelSubtotal,
      text: fillTemplate(s.subtotal, { amount: input.subtotal }),
    },
    ...taxLines(input.taxes, s),
    {
      label: s.labelTotal,
      text: fillTemplate(s.totalInvoice, {
        subtotal: input.subtotal,
        total: input.total,
      }),
    },
  ];
  if (input.voided) {
    lines.push({ label: s.labelStatus, text: s.statusVoid });
    return lines;
  }
  if (input.paidCents > 0) {
    lines.push({
      label: s.labelPaid,
      text: fillTemplate(s.paid, { amount: input.paid }),
    });
  }
  if (input.remainingCents > 0) {
    lines.push({
      label: s.labelBalance,
      text: fillTemplate(s.balance, { amount: input.balance }),
    });
    if (input.dueAt) {
      lines.push({
        label: s.labelDue,
        text: fillTemplate(s.due, {
          date: formatDueDate(input.dueAt, input.dueTimezone, input.locale),
        }),
      });
    }
    if (input.overdue) {
      lines.push({ label: s.labelOverdue, text: s.overdue });
    }
  }
  const statusText =
    input.status === "PAID"
      ? s.statusPaid
      : input.status === "PARTIALLY PAID"
        ? s.statusPartial
        : s.statusUnpaid;
  lines.push({ label: s.labelStatus, text: statusText });
  return lines;
}

export interface QuoteExplainerInput {
  subtotal: string;
  discount: { label: string; amount: string } | null;
  taxes: TaxLineInput[];
  total: string;
  status: string;
  strings: ExplainerStrings;
}

/** Plain-language walk through a quote's totals, top to bottom. */
export function buildQuoteExplainerLines(
  input: QuoteExplainerInput,
): ExplainerLine[] {
  const s = input.strings;
  const lines: ExplainerLine[] = [
    {
      label: s.labelSubtotal,
      text: fillTemplate(s.subtotal, { amount: input.subtotal }),
    },
  ];
  if (input.discount) {
    lines.push({
      label: input.discount.label,
      text: fillTemplate(s.discount, {
        label: input.discount.label,
        amount: input.discount.amount,
      }),
    });
  }
  lines.push(...taxLines(input.taxes, s));
  lines.push({
    label: s.labelTotal,
    text: fillTemplate(s.totalQuote, {
      subtotal: input.subtotal,
      total: input.total,
    }),
  });
  const statusText =
    input.status === "APPROVED"
      ? s.statusApproved
      : input.status === "DECLINED"
        ? s.statusDeclined
        : input.status === "SENT"
          ? s.statusSent
          : s.statusDraft;
  lines.push({ label: s.labelStatus, text: statusText });
  return lines;
}

/**
 * Resolve the whole explainer string set from one lookup. Pages pass
 * their local `L` (e.g. `(k) => L(`explainer.${k}`)`) so the 27 keys
 * live in exactly one place instead of being copied per page.
 */
export function buildExplainerStrings(
  lookup: (key: string) => string,
): ExplainerStrings {
  const keys = [
    "title",
    "labelSubtotal",
    "labelTotal",
    "labelPaid",
    "labelBalance",
    "labelDue",
    "labelOverdue",
    "labelStatus",
    "subtotal",
    "taxOnSubtotal",
    "quebecTaxNote",
    "totalInvoice",
    "totalQuote",
    "paid",
    "balance",
    "due",
    "overdue",
    "discount",
    "statusUnpaid",
    "statusPartial",
    "statusPaid",
    "statusVoid",
    "statusDraft",
    "statusSent",
    "statusApproved",
    "statusDeclined",
  ] as const;
  return Object.fromEntries(keys.map((k) => [k, lookup(k)])) as unknown as ExplainerStrings;
}
