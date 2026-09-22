/**
 * Kivo copilot — rule-based engine (offline fallback).
 *
 * Deterministic, no-network intent detection + Hinglish entity extraction
 * (see ./parse.ts — DB-free and unit-testable) + real business-data fetchers
 * (always scoped by businessId).
 *
 * NEVER invents numbers: every figure comes from a Prisma query.
 * NEVER sends messages: reminders are returned as draft text only.
 * NEVER creates jobs: create_job intent always returns a preview for
 * explicit user confirmation (handled in the API route).
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
// Reply formatters (rule-based)
// ---------------------------------------------------------------------------

function formatJobList(
  jobs: Array<{ title: string; time: string | null; status: string; customer: { name: string } | null }>
): string {
  if (jobs.length === 0) return '';
  return jobs
    .map((j, i) => `${i + 1}. ${j.title} — ${j.customer?.name ?? '—'}${j.time ? ` (${j.time})` : ''} [${j.status}]`)
    .join('\n');
}

const HELP_TEXT = `Main aapki madad kar sakta hoon:

• Job book karna — bas WhatsApp jaisa message bhejo, jaise "Ramesh ka AC repair kal 3 baje, 9876543210, ₹800". Main confirm karke hi book karunga.
• Schedule dekhna — "Aaj ke jobs?" ya "Kal ke jobs?"
• Kamai — "Is hafte kitna kamaya?"
• Baki payment — "Kitna outstanding hai?"
• Customer dhundna — "Ramesh ka number"
• Payment reminder — "Ramesh ko reminder banao"

Kuch bhi poochho — main aapke asli business data se jawab dunga.`;

/** Short greeting — kept separate from help so "hi" doesn't dump the manual. */
const GREETING_TEXT = `Namaste! 🙏 Main aapka Kivo assistant hoon.

• Job book karni hai? Jaise likho: "Ramesh ka AC repair kal 3 baje, ₹800"
• Schedule dekhna hai? "Aaj ke jobs?" ya "Kal ke jobs?"
• "Kitna outstanding hai?" — baki payments ka hisaab

Bas aise hi message bhejo — job hamesha aapke confirm karne par hi book hogi.`;

/** Asked when the message carries no recognizable intent — never silence,
 *  never a wrong guess. */
const CLARIFY_TEXT = `Samajh nahi aaya — thoda detail mein bataoge? 🙂

Job book karni hai to aise likho:
"Ramesh ka AC repair kal 3 baje, ₹800"

Ya bas batao — kaunsa kaam hai, kiske liye hai, aur kab karna hai?`;

/** True for bare greetings ("hi", "namaste") — longer sentences that happen
 *  to contain "hi" (e.g. "Ramesh hi karega") are NOT greetings. */
function isGreeting(raw: string): boolean {
  const text = norm(raw);
  if (text.split(' ').length > 3) return false;
  return hasAny(' ' + text + ' ', [
    ' namaste ', ' namaskar ', ' hello ', ' hi ', ' hey ', ' salaam ',
    ' good morning ', ' good evening ', ' ram ram ',
  ]);
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export async function runCopilot(
  businessId: string,
  _userId: string,
  message: string,
  history: CopilotHistoryItem[] = []
): Promise<CopilotResult> {
  const biz = await prisma.business.findUnique({ where: { id: businessId }, select: { currency: true } });
  const currency = biz?.currency ?? 'INR';
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

      const lines = [
        'Maine yeh job samjha hai — confirm karein?',
        '',
        `Service: ${draft.title}`,
        `Date: ${formatDateShort(draft.date)}`,
        `Time: ${draft.time ?? 'TBD'}`,
        `Customer: ${draft.customerName || '(naam nahi mila)'}`,
        `Phone: ${draft.phone ?? '—'}`,
        `Address: ${draft.address ?? '—'}`,
        `Price: ${draft.price !== null ? formatMoney(draft.price, currency) : '(set nahi)'}`,
      ];
      if (!explicitDate) {
        lines.push('', 'Note: date saaf nahi thi, isliye aaj ki date li hai — preview mein sahi date set kar lena.');
      }
      if (matched) {
        lines.push('', `Note: ${matched.name} aapke customers mein pehle se hai.`);
      } else if (draft.customerName && !customerExists) {
        lines.push(
          '',
          `Note: "${draft.customerName}" aapke customers mein nahi mila — confirm karne par main inhe naye customer ke roop mein add kar dunga.`
        );
        if (similarCustomer) {
          lines.push(`Kya aapka matlab "${similarCustomer}" tha?`);
        }
      } else if (!draft.customerName) {
        lines.push('', 'Note: customer ka naam nahi mila — preview mein naam zaroor likh dein, tabhi booking hogi.');
      }
      lines.push('', 'Confirm karne par hi job book hogi.');

      return { intent, reply: lines.join('\n'), preview: draft };
    }

    case 'ask_schedule': {
      const dateStr = extractDate(message) ?? todayStr;
      const jobs = await jobsOn(businessId, dateStr);
      const label = dateStr === todayStr ? 'aaj' : formatDateShort(dateStr);
      if (jobs.length === 0) {
        return { intent, reply: `${label === 'aaj' ? 'Aaj' : formatDateShort(dateStr)} ke liye koi job scheduled nahi hai. Koi nayi booking aaye to bas yahan message bhej dijiye!` };
      }
      return {
        intent,
        reply: `${label === 'aaj' ? 'Aaj' : formatDateShort(dateStr)} ke ${jobs.length} job(s):\n\n${formatJobList(jobs)}`,
        data: { date: dateStr, count: jobs.length },
      };
    }

    case 'ask_revenue': {
      const text = norm(message);
      let start: Date, end: Date, label: string;
      const now = new Date();
      if (hasAny(' ' + text + ' ', [' aaj ', ' ajj ', ' today '])) {
        const { gte, lte } = dayRange(todayStr);
        start = gte; end = lte; label = 'aaj';
      } else if (hasAny(' ' + text + ' ', [' hafte ', ' week ', ' iss week '])) {
        start = new Date(now); start.setDate(now.getDate() - 7); end = now; label = 'pichhle 7 dinon mein';
      } else if (hasAny(' ' + text + ' ', [' mahine ', ' month ', ' iss month '])) {
        start = new Date(now); start.setDate(now.getDate() - 30); end = now; label = 'pichhle 30 dinon mein';
      } else {
        const { gte, lte } = dayRange(todayStr);
        start = gte; end = lte; label = 'aaj';
      }
      const total = await revenueBetween(businessId, start, end);
      return {
        intent,
        reply: `${label === 'aaj' ? 'Aaj' : label} ki collection: ${formatMoney(total, currency)} (received payments ke hisaab se).`,
        data: { total, label },
      };
    }

    case 'ask_unpaid': {
      const invoices = await unpaidInvoices(businessId);
      if (invoices.length === 0) {
        return { intent, reply: 'Badhiya! Koi baki (unpaid) payment nahi hai. Sab clear hai.' };
      }
      const withBalance = invoices.map((i) => ({ ...i, balance: invoiceBalance(i) }));
      const total = withBalance.reduce((s, i) => s + i.balance, 0);
      const lines = withBalance.slice(0, 10).map(
        (i, idx) => `${idx + 1}. ${i.customer.name} — ${i.number} — ${formatMoney(i.balance, currency)} baki [${i.status}]`
      );
      return {
        intent,
        reply: `Kul outstanding: ${formatMoney(total, currency)} (${invoices.length} invoice${invoices.length > 1 ? 's' : ''}):\n\n${lines.join('\n')}${
          invoices.length > 10 ? `\n\n...aur ${invoices.length - 10} aur.` : ''
        }\n\nKisi customer ke liye payment reminder draft chahiye to bolo, jaise "Ramesh ko reminder banao".`,
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
        return { intent, reply: 'Abhi aapke paas koi customer nahi hai. Pehla customer add karne ke liye "Customers" page par jayein.' };
      }
      const shown = all.slice(0, 10).map((c, i) => `${i + 1}. ${c.name}${c.phone ? ` — ${c.phone}` : ''}`);
      const more = total > 10 ? `\n\n...aur ${total - 10} aur.` : '';
      return {
        intent,
        reply: `Aapke kul ${total} customer${total === 1 ? '' : 's'} hain:\n\n${shown.join('\n')}${more}`,
        data: { count: total },
      };
    }

    case 'find_customer': {
      const phone = extractPhone(message);
      const name = extractCustomerName(message);
      // strip the "ka number" style suffix and search the raw words
      const query = phone ?? name ?? norm(message).replace(/\b(ka|ke|ki|number|no|mobile|customer|client|grahak|find|karo|do|batao|dikhao)\b/g, ' ').trim();
      if (!query) {
        return { intent, reply: 'Kaunsa customer dhundna hai? Naam ya mobile number batao, jaise "Ramesh ka number".' };
      }
      const customers = await findCustomers(businessId, query);
      if (customers.length === 0) {
        return { intent, reply: `"${query}" naam se koi customer nahi mila. Spelling check karke dobara try karein.` };
      }
      const lines = customers.map(
        (c, i) => `${i + 1}. ${c.name}${c.phone ? ` — ${c.phone}` : ''}${c._count.jobs ? ` (${c._count.jobs} jobs)` : ''}`
      );
      return {
        intent,
        reply: `${customers.length} customer mile:\n\n${lines.join('\n')}`,
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
            ? `"${query}" ke liye koi unpaid invoice nahi mili.`
            : 'Koi unpaid invoice nahi hai — reminder ki zaroorat nahi!',
        };
      }
      const inv = invoices[0];
      const balance = invoiceBalance(inv);
      const cname = inv.customer.name.split(' ')[0];
      const draft =
        `Namaste ${cname} ji, ${inv.number} (${formatMoney(balance, currency)}) ka payment abhi baki hai. ` +
        `Kripya jald se jald clear kar dein. Koi dikkat ho to batayein. Dhanyavaad!`;
      const note = invoices.length > 1
        ? `\n\n(Note: ${invoices.length} unpaid invoices hain — yeh draft sabse recent ke liye hai.)`
        : '';
      return {
        intent,
        reply: `Yeh raha reminder draft (maine kuch bheja NAHI hai — aap copy karke khud bhej sakte ho):\n\n"${draft}"${note}`,
        data: { invoiceId: inv.id, customer: inv.customer.name, amount: balance },
      };
    }

    case 'help':
      return { intent: 'help', reply: HELP_TEXT };

    case 'unknown':
    default: {
      // Ambiguous input ("fix the thing for the guy") previously fell
      // through to the generic help dump — and in one case produced no
      // useful reply at all. Always answer, and ask what you need.
      if (isGreeting(message)) return { intent: 'unknown', reply: GREETING_TEXT };
      return { intent: 'unknown', reply: CLARIFY_TEXT };
    }
  }
}
