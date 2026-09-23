/**
 * EveryJob copilot — rule-based engine (offline fallback).
 *
 * Deterministic, no-network intent detection + multilingual entity extraction
 * (see ./parse.ts — DB-free and unit-testable) + real business-data fetchers
 * (always scoped by businessId).
 *
 * NEVER invents numbers: every figure comes from a Prisma query.
 * NEVER sends messages: reminders are returned as draft text only.
 * NEVER creates jobs: create_job intent always returns a preview for
 * explicit user confirmation (handled in the API route).
 *
 * Replies are bilingual (English / Canadian French), chosen from the
 * business's UI locale. English replies are written in plain professional
 * Canadian English.
 */

import { prisma } from '@/lib/prisma';
import { formatDateShort, toISODateLocal, dayRange } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import {
  detectIntent,
  extractAddress,
  extractCustomerName,
  extractDate,
  extractMoney,
  extractPhone,
  extractServiceTitle,
  extractTime,
  hasAny,
  norm,
  resolveFollowUpName,
  type CopilotHistoryItem,
  type CopilotIntent,
  type CopilotResult,
  type JobDraft,
} from './parse';

// Re-export the pure parsing API (and shared types) for route handlers,
// widgets and tests.
export {
  detectIntent,
  extractAddress,
  extractCustomerName,
  extractDate,
  extractMoney,
  extractPhone,
  extractServiceTitle,
  extractTime,
  resolveFollowUpName,
  type CopilotHistoryItem,
  type CopilotIntent,
  type CopilotResult,
  type JobDraft,
};

export type CopilotLang = 'en' | 'fr';

export interface RunCopilotOptions {
  /** UI locale of the business ('en' | 'fr'); defaults to 'en'. */
  locale?: string;
}

function langOf(locale?: string): CopilotLang {
  return locale === 'fr' ? 'fr' : 'en';
}

/** Pick the reply-language string. */
function pick(lang: CopilotLang, en: string, fr: string): string {
  return lang === 'fr' ? fr : en;
}

// ---------------------------------------------------------------------------
// Data fetchers (always businessId-scoped)
// ---------------------------------------------------------------------------
// Minimal row shapes are declared explicitly so this module typechecks even
// if the generated Prisma client types are stale; real query results
// structurally satisfy these interfaces.

export interface JobWithCustomer {
  title: string;
  time: string | null;
  status: string;
  customer: { name: string } | null;
}

export interface UnpaidInvoiceRow {
  id: string;
  number: string;
  total: number;
  status: string;
  date: Date;
  customer: { name: string; phone: string | null };
  payments: Array<{ amount: number }>;
}

/** Remaining balance after completed payments (never negative). */
export function invoiceBalance(inv: { total: number; payments: Array<{ amount: number }> }): number {
  const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
  return Math.max(0, Math.round((inv.total - paid) * 100) / 100);
}

export interface CustomerSearchRow {
  id: string;
  name: string;
  phone: string | null;
  _count: { jobs: number };
}

async function jobsOn(businessId: string, dateStr: string): Promise<JobWithCustomer[]> {
  const { gte, lte } = dayRange(dateStr);
  return prisma.job.findMany({
    where: { businessId, date: { gte, lte } },
    include: { customer: { select: { name: true } } },
    orderBy: { time: 'asc' },
  });
}

async function revenueBetween(businessId: string, start: Date, end: Date): Promise<number> {
  const agg = await prisma.payment.aggregate({
    where: {
      status: 'COMPLETED',
      createdAt: { gte: start, lte: end },
      invoice: { businessId },
    },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? 0;
}

async function unpaidInvoices(businessId: string, limit = 20): Promise<UnpaidInvoiceRow[]> {
  return prisma.invoice.findMany({
    where: { businessId, status: { in: ['UNPAID', 'PARTIALLY PAID'] } },
    include: {
      customer: { select: { name: true, phone: true } },
      payments: { where: { status: 'COMPLETED' }, select: { amount: true } },
    },
    orderBy: { date: 'desc' },
    take: limit,
  });
}

async function findCustomers(businessId: string, query: string, limit = 5): Promise<CustomerSearchRow[]> {
  const digits = query.replace(/\D/g, '');
  return prisma.customer.findMany({
    where: {
      businessId,
      OR: [
        { name: { contains: query } },
        ...(digits.length >= 6 ? [{ phone: { contains: digits } }] : []),
      ],
    },
    take: limit,
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { jobs: true } } },
  });
}

// ---------------------------------------------------------------------------
// Reply formatters (rule-based, bilingual)
// ---------------------------------------------------------------------------

function formatJobList(
  jobs: Array<{ title: string; time: string | null; status: string; customer: { name: string } | null }>
): string {
  if (jobs.length === 0) return '';
  return jobs
    .map((j, i) => `${i + 1}. ${j.title} — ${j.customer?.name ?? '—'}${j.time ? ` (${j.time})` : ''} [${j.status}]`)
    .join('\n');
}

function helpText(lang: CopilotLang, example: string): string {
  return pick(
    lang,
    `I can help with:\n\n` +
      `• Booking a job — write WhatsApp-style, e.g. "${example}". I'll confirm before booking.\n` +
      `• Checking the schedule — "Today's jobs?" or "Tomorrow's jobs?"\n` +
      `• Earnings — "How much did I earn this week?"\n` +
      `• Outstanding payments — "What's outstanding?"\n` +
      `• Finding a customer — "Sarah's number"\n` +
      `• Payment reminders — "Draft a reminder for Sarah"\n\n` +
      `Ask anything — I answer from your real business data.`,
    `Je peux vous aider avec :\n\n` +
      `• Réserver une tâche — écrivez comme sur WhatsApp, par ex. « ${example} ». Je confirmerai avant de réserver.\n` +
      `• Voir l'horaire — « Les tâches d'aujourd'hui? » ou « Celles de demain? »\n` +
      `• Les revenus — « Combien ai-je gagné cette semaine? »\n` +
      `• Les paiements impayés — « Combien me doit-on? »\n` +
      `• Trouver un client — « Le numéro de Sarah »\n` +
      `• Les rappels de paiement — « Prépare un rappel pour Sarah »\n\n` +
      `Posez votre question — je réponds à partir de vos vraies données d'affaires.`
  );
}

/** Short greeting — kept separate from help so "hi" doesn't dump the manual. */
function greetingText(lang: CopilotLang, example: string): string {
  return pick(
    lang,
    `Hi! 👋 I'm your EveryJob assistant.\n\n` +
      `• Need to book a job? Just write, e.g.: "${example}"\n` +
      `• Check the schedule? "Today's jobs?" or "Tomorrow's jobs?"\n` +
      `• "What's outstanding?" — for unpaid payments\n\n` +
      `Just message here — a job is only booked after you confirm.`,
    `Bonjour! 👋 Je suis votre assistant EveryJob.\n\n` +
      `• Vous voulez réserver une tâche? Écrivez par ex. : « ${example} »\n` +
      `• Voir l'horaire? « Les tâches d'aujourd'hui? » ou « Celles de demain? »\n` +
      `• « Combien me doit-on? » — pour les paiements impayés\n\n` +
      `Écrivez simplement ici — une tâche n'est réservée qu'après votre confirmation.`
  );
}

/** Asked when the message carries no recognizable intent — never silence,
 *  never a wrong guess. */
function clarifyText(lang: CopilotLang, example: string): string {
  return pick(
    lang,
    `I didn't quite catch that — could you say a bit more? 🙂\n\n` +
      `To book a job, write something like:\n"${example}"\n\n` +
      `Or just tell me — what's the work, who is it for, and when?`,
    `Je n'ai pas bien compris — pouvez-vous préciser? 🙂\n\n` +
      `Pour réserver une tâche, écrivez par exemple :\n« ${example} »\n\n` +
      `Ou dites-moi simplement — c'est quoi le travail, pour qui, et quand?`
  );
}

/** True for bare greetings ("hi", "bonjour") — longer sentences that happen
 *  to contain "hi" (e.g. "Sarah is doing it") are NOT greetings. */
function isGreeting(raw: string): boolean {
  const text = norm(raw);
  if (text.split(' ').length > 3) return false;
  return hasAny(' ' + text + ' ', [
    ' namaste ', ' namaskar ', ' hello ', ' hi ', ' hey ', ' salaam ',
    ' good morning ', ' good evening ', ' ram ram ',
    ' bonjour ', ' bonsoir ', ' salut ', ' allo ',
  ]);
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export async function runCopilot(
  businessId: string,
  _userId: string,
  message: string,
  history: CopilotHistoryItem[] = [],
  opts: RunCopilotOptions = {}
): Promise<CopilotResult> {
  const lang = langOf(opts.locale);
  // Locale-appropriate booking example for help/greeting/clarify.
  const example =
    lang === 'fr'
      ? 'Réparation de clim pour Sarah demain à 15h, 800 $'
      : 'AC repair for Sarah tomorrow at 3pm, $800';

  const currency = 'CAD';
  // Pronoun follow-ups ("usko kal kar do") resolve against recent turns.
  const followUpName = resolveFollowUpName(message, history);
  const intent = detectIntent(message, followUpName);
  const todayStr = toISODateLocal(new Date());

  switch (intent) {
    case 'create_job': {
      // Track whether the date was explicitly understood: defaulting to
      // today without telling the user was a real mis-parse ("25 ko" once
      // silently became "today"). When unsure, say so in the reply.
      const explicitDate = extractDate(message);
      // Pronoun follow-ups ("usko kal kar do") name no service — carry the
      // service forward from the most recent booking preview in history so
      // the follow-up doesn't silently reset to "General Service".
      let serviceTitle = extractServiceTitle(message);
      if (!serviceTitle) {
        for (let i = history.length - 1; i >= 0; i--) {
          const m = history[i].content.match(/^Service:\s*(.+)$/m);
          if (m && m[1].trim() && !/^general service$/i.test(m[1].trim())) {
            serviceTitle = m[1].trim();
            break;
          }
        }
      }
      const draft: JobDraft = {
        title: serviceTitle ?? 'General Service',
        date: explicitDate ?? todayStr,
        time: extractTime(message),
        customerName: extractCustomerName(message) ?? followUpName ?? '',
        phone: extractPhone(message),
        address: extractAddress(message),
        price: extractMoney(message),
      };

      // Check for a matching existing customer (helps confirmation)
      let matched: { name: string } | null = null;
      if (draft.phone) {
        matched = await prisma.customer.findFirst({
          where: { businessId, phone: { contains: draft.phone } },
          select: { name: true },
        });
        if (matched && !draft.customerName) draft.customerName = matched.name;
      }

      // Does this customer already exist in the workspace? Never silently
      // proceed: say so explicitly, and suggest a close match if there is one.
      let customerExists = !!matched;
      let similarCustomer: string | null = null;
      if (!customerExists && draft.customerName) {
        const candidates = await prisma.customer.findMany({
          where: { businessId, name: { contains: draft.customerName } },
          select: { name: true },
          take: 5,
        });
        const wanted = draft.customerName.trim().toLowerCase();
        customerExists = candidates.some(
          (c) => c.name.trim().toLowerCase() === wanted
        );
        if (!customerExists && candidates.length > 0) {
          similarCustomer = candidates[0].name;
        }
      }

      const L = {
        title: pick(lang, "Here's the job I understood — please confirm?", 'Voici la tâche que j’ai comprise — confirmez-vous?'),
        service: pick(lang, 'Service', 'Service'),
        date: pick(lang, 'Date', 'Date'),
        time: pick(lang, 'Time', 'Heure'),
        customer: pick(lang, 'Customer', 'Client'),
        phone: pick(lang, 'Phone', 'Téléphone'),
        address: pick(lang, 'Address', 'Adresse'),
        price: pick(lang, 'Price', 'Prix'),
        tbd: pick(lang, 'TBD', 'À déterminer'),
        noName: pick(lang, '(no name found)', '(nom introuvable)'),
        notSet: pick(lang, '(not set)', '(non défini)'),
        dateNote: pick(
          lang,
          'Note: the date wasn’t clear, so I used today — set the right date in the preview.',
          'Note : la date n’était pas claire, j’ai donc pris aujourd’hui — corrigez la date dans l’aperçu.'
        ),
        matchedNote: (name: string) =>
          pick(lang, `Note: ${name} is already in your customers.`, `Note : ${name} est déjà dans vos clients.`),
        newCustomerNote: (name: string) =>
          pick(
            lang,
            `Note: "${name}" isn’t in your customers — confirming will add them as a new customer.`,
            `Note : « ${name} » ne figure pas dans vos clients — en confirmant, je l’ajouterai comme nouveau client.`
          ),
        similarNote: (name: string) =>
          pick(lang, `Did you mean "${name}"?`, `Vouliez-vous dire « ${name} »?`),
        nameMissingNote: pick(
          lang,
          'Note: I couldn’t find the customer name — add it in the preview, it’s required to book.',
          'Note : je n’ai pas trouvé le nom du client — ajoutez-le dans l’aperçu, c’est requis pour réserver.'
        ),
        confirmNote: pick(lang, 'The job is only booked when you confirm.', 'La tâche ne sera réservée qu’après votre confirmation.'),
      };

      const lines = [
        L.title,
        '',
        `${L.service}: ${draft.title}`,
        `${L.date}: ${formatDateShort(draft.date)}`,
        `${L.time}: ${draft.time ?? L.tbd}`,
        `${L.customer}: ${draft.customerName || L.noName}`,
        `${L.phone}: ${draft.phone ?? '—'}`,
        `${L.address}: ${draft.address ?? '—'}`,
        `${L.price}: ${draft.price !== null ? formatMoney(draft.price, currency) : L.notSet}`,
      ];
      if (!explicitDate) {
        lines.push('', L.dateNote);
      }
      if (matched) {
        lines.push('', L.matchedNote(matched.name));
      } else if (draft.customerName && !customerExists) {
        lines.push('', L.newCustomerNote(draft.customerName));
        if (similarCustomer) {
          lines.push(L.similarNote(similarCustomer));
        }
      } else if (!draft.customerName) {
        lines.push('', L.nameMissingNote);
      }
      lines.push('', L.confirmNote);

      return { intent, reply: lines.join('\n'), preview: draft };
    }

    case 'ask_schedule': {
      const dateStr = extractDate(message) ?? todayStr;
      const jobs = await jobsOn(businessId, dateStr);
      const isToday = dateStr === todayStr;
      const dateLabel = isToday ? pick(lang, 'Today', 'Aujourd’hui') : formatDateShort(dateStr);
      if (jobs.length === 0) {
        return {
          intent,
          reply: pick(
            lang,
            `No jobs scheduled for ${dateLabel.toLowerCase() === 'today' ? 'today' : dateLabel}. When a new booking comes in, just message me here!`,
            `Aucune tâche prévue pour ${isToday ? 'aujourd’hui' : 'le ' + dateLabel}. Quand une nouvelle réservation arrive, écrivez-moi ici!`
          ),
        };
      }
      return {
        intent,
        reply: pick(
          lang,
          `${dateLabel}: ${jobs.length} job(s):\n\n${formatJobList(jobs)}`,
          `${dateLabel} : ${jobs.length} tâche(s) :\n\n${formatJobList(jobs)}`
        ),
        data: { date: dateStr, count: jobs.length },
      };
    }

    case 'ask_revenue': {
      const text = norm(message);
      let start: Date, end: Date, label: string;
      const now = new Date();
      if (hasAny(' ' + text + ' ', [' aaj ', ' ajj ', ' today ', ' aujourd hui '])) {
        const { gte, lte } = dayRange(todayStr);
        start = gte; end = lte; label = pick(lang, 'Today', 'Aujourd’hui');
      } else if (hasAny(' ' + text + ' ', [' hafte ', ' week ', ' iss week ', ' semaine '])) {
        start = new Date(now); start.setDate(now.getDate() - 7); end = now;
        label = pick(lang, 'the last 7 days', 'les 7 derniers jours');
      } else if (hasAny(' ' + text + ' ', [' mahine ', ' month ', ' iss month ', ' mois '])) {
        start = new Date(now); start.setDate(now.getDate() - 30); end = now;
        label = pick(lang, 'the last 30 days', 'les 30 derniers jours');
      } else {
        const { gte, lte } = dayRange(todayStr);
        start = gte; end = lte; label = pick(lang, 'Today', 'Aujourd’hui');
      }
      const total = await revenueBetween(businessId, start, end);
      return {
        intent,
        reply: pick(
          lang,
          label === 'Today'
            ? `Today's collection: ${formatMoney(total, currency)} (based on received payments).`
            : `Collection over ${label}: ${formatMoney(total, currency)} (based on received payments).`,
          label === 'Aujourd’hui'
            ? `Collecte d’aujourd’hui : ${formatMoney(total, currency)} (selon les paiements reçus).`
            : `Collecte sur ${label} : ${formatMoney(total, currency)} (selon les paiements reçus).`
        ),
        data: { total, label },
      };
    }

    case 'ask_unpaid': {
      const invoices = await unpaidInvoices(businessId);
      if (invoices.length === 0) {
        return {
          intent,
          reply: pick(
            lang,
            'All clear! No unpaid invoices — everything’s settled.',
            'Parfait! Aucune facture impayée — tout est réglé.'
          ),
        };
      }
      const withBalance = invoices.map((i) => ({ ...i, balance: invoiceBalance(i) }));
      const total = withBalance.reduce((s, i) => s + i.balance, 0);
      const lines = withBalance.slice(0, 10).map(
        (i, idx) =>
          `${idx + 1}. ${i.customer.name} — ${i.number} — ${formatMoney(i.balance, currency)} ${
            lang === 'fr' ? 'dû' : 'due'
          } [${i.status}]`
      );
      return {
        intent,
        reply: pick(
          lang,
          `Total outstanding: ${formatMoney(total, currency)} (${invoices.length} invoice${invoices.length > 1 ? 's' : ''}):\n\n${lines.join('\n')}${
            invoices.length > 10 ? `\n\n...and ${invoices.length - 10} more.` : ''
          }\n\nWant a payment reminder draft for a customer? Just say, e.g. "Draft a reminder for Sarah".`,
          `Total impayé : ${formatMoney(total, currency)} (${invoices.length} facture${invoices.length > 1 ? 's' : ''}) :\n\n${lines.join('\n')}${
            invoices.length > 10 ? `\n\n...et ${invoices.length - 10} de plus.` : ''
          }\n\nVoulez-vous un rappel de paiement pour un client? Dites par exemple « Prépare un rappel pour Sarah ».`
        ),
        data: { total, count: invoices.length },
      };
    }

    case 'ask_customers': {
      const all = await prisma.customer.findMany({
        where: { businessId },
        select: { name: true, phone: true },
        orderBy: { name: 'asc' },
        take: 11,
      });
      const total = await prisma.customer.count({ where: { businessId } });
      if (total === 0) {
        return {
          intent,
          reply: pick(
            lang,
            'You don’t have any customers yet. Head to the "Customers" page to add your first one.',
            'Vous n’avez aucun client pour l’instant. Allez à la page « Clients » pour ajouter le premier.'
          ),
        };
      }
      const shown = all.slice(0, 10).map((c, i) => `${i + 1}. ${c.name}${c.phone ? ` — ${c.phone}` : ''}`);
      const more = total > 10 ? (lang === 'fr' ? `\n\n...et ${total - 10} de plus.` : `\n\n...and ${total - 10} more.`) : '';
      return {
        intent,
        reply: pick(
          lang,
          `You have ${total} customer${total === 1 ? '' : 's'}:\n\n${shown.join('\n')}${more}`,
          `Vous avez ${total} client${total === 1 ? '' : 's'} :\n\n${shown.join('\n')}${more}`
        ),
        data: { count: total },
      };
    }

    case 'find_customer': {
      const phone = extractPhone(message);
      const name = extractCustomerName(message);
      // strip the "ka number" style suffix and search the raw words
      const query = phone ?? name ?? norm(message).replace(/\b(ka|ke|ki|number|no|mobile|customer|client|grahak|find|karo|do|batao|dikhao|numéro|téléphone|chercher|trouve)\b/g, ' ').trim();
      if (!query) {
        return {
          intent,
          reply: pick(
            lang,
            'Which customer should I look up? Give me a name or mobile number, e.g. "Sarah’s number".',
            'Quel client dois-je chercher? Donnez-moi un nom ou un numéro de mobile, par exemple « le numéro de Sarah ».'
          ),
        };
      }
      const customers = await findCustomers(businessId, query);
      if (customers.length === 0) {
        return {
          intent,
          reply: pick(
            lang,
            `No customer found matching "${query}". Check the spelling and try again.`,
            `Aucun client trouvé pour « ${query} ». Vérifiez l’orthographe et réessayez.`
          ),
        };
      }
      const lines = customers.map(
        (c, i) => `${i + 1}. ${c.name}${c.phone ? ` — ${c.phone}` : ''}${c._count.jobs ? ` (${c._count.jobs} jobs)` : ''}`
      );
      return {
        intent,
        reply: pick(
          lang,
          `${customers.length === 1 ? 'Found 1 customer' : `Found ${customers.length} customers`}:\n\n${lines.join('\n')}`,
          `${customers.length} client${customers.length === 1 ? '' : 's'} trouvé${customers.length === 1 ? '' : 's'} :\n\n${lines.join('\n')}`
        ),
        data: { count: customers.length },
      };
    }

    case 'draft_reminder': {
      const phone = extractPhone(message);
      const name = extractCustomerName(message);
      const query = phone ?? name ?? '';
      let invoices = await unpaidInvoices(businessId, 50);
      if (query) {
        invoices = invoices.filter((i) =>
          i.customer.name.toLowerCase().includes(query.toLowerCase()) ||
          (phone && i.customer.phone?.includes(phone))
        );
      }
      if (invoices.length === 0) {
        return {
          intent,
          reply: query
            ? pick(
                lang,
                `No unpaid invoice found for "${query}".`,
                `Aucune facture impayée trouvée pour « ${query} ».`
              )
            : pick(
                lang,
                'No unpaid invoices — no reminder needed!',
                'Aucune facture impayée — aucun rappel nécessaire!'
              ),
        };
      }
      const inv = invoices[0];
      const balance = invoiceBalance(inv);
      const cname = inv.customer.name.split(' ')[0];
      const draft = pick(
        lang,
        `Hi ${cname}, invoice ${inv.number} (${formatMoney(balance, currency)}) is still unpaid. ` +
          `Please clear it at your earliest. Let me know if there’s an issue. Thank you!`,
        `Bonjour ${cname}, la facture ${inv.number} (${formatMoney(balance, currency)}) est toujours impayée. ` +
          `Veuillez la régler dès que possible. N’hésitez pas s’il y a un problème. Merci!`
      );
      const note = invoices.length > 1
        ? pick(
            lang,
            `\n\n(Note: there are ${invoices.length} unpaid invoices — this draft is for the most recent one.)`,
            `\n\n(Note : il y a ${invoices.length} factures impayées — ce brouillon concerne la plus récente.)`
          )
        : '';
      return {
        intent,
        reply: pick(
          lang,
          `Here’s a reminder draft (I have NOT sent anything — copy it and send it yourself):\n\n"${draft}"${note}`,
          `Voici un brouillon de rappel (je n’ai RIEN envoyé — copiez-le et envoyez-le vous-même) :\n\n« ${draft} »${note}`
        ),
        data: { invoiceId: inv.id, customer: inv.customer.name, amount: balance },
      };
    }

    case 'help':
      return { intent: 'help', reply: helpText(lang, example) };

    case 'unknown':
    default: {
      // Ambiguous input ("fix the thing for the guy") previously fell
      // through to the generic help dump — and in one case produced no
      // useful reply at all. Always answer, and ask what you need.
      if (isGreeting(message)) return { intent: 'unknown', reply: greetingText(lang, example) };
      return { intent: 'unknown', reply: clarifyText(lang, example) };
    }
  }
}
