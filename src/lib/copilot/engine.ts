/**
 * Kivo copilot — rule-based engine (offline fallback).
 *
 * Deterministic, no-network intent detection + Hinglish entity extraction +
 * real business-data fetchers (always scoped by businessId).
 *
 * NEVER invents numbers: every figure comes from a Prisma query.
 * NEVER sends messages: reminders are returned as draft text only.
 * NEVER creates jobs: create_job intent always returns a preview for
 * explicit user confirmation (handled in the API route).
 */

import { prisma } from '@/lib/prisma';
import { formatDateShort, toISODateLocal, dayRange } from '@/lib/utils';
import { formatMoney } from '@/lib/money';

export type CopilotIntent =
  | 'create_job'
  | 'ask_revenue'
  | 'ask_schedule'
  | 'ask_unpaid'
  | 'ask_customers'
  | 'find_customer'
  | 'draft_reminder'
  | 'help'
  | 'unknown';

export interface JobDraft {
  title: string;
  date: string; // YYYY-MM-DD (local)
  time: string | null;
  customerName: string;
  phone: string | null;
  address: string | null;
  price: number | null;
}

export interface CopilotResult {
  intent: CopilotIntent;
  reply: string;
  preview?: JobDraft;
  data?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

function norm(s: string): string {
  return s.toLowerCase().replace(/[।!?.,;:'"()\[\]{}]/g, ' ').replace(/\s+/g, ' ').trim();
}

function hasAny(text: string, words: string[]): boolean {
  return words.some((w) => text.includes(w));
}

// ---------------------------------------------------------------------------
// Entity extraction (Hinglish)
// ---------------------------------------------------------------------------

const WEEKDAYS: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  ravivaar: 0, somvaar: 1, mangalvaar: 2, budhvaar: 3, gurvaar: 4, shukravaar: 5, shanivaar: 6,
  // common transliterations
  itvaar: 0, somvar: 1, mangalvar: 2, budhvar: 3, guruvar: 4, shukravar: 5, shanivar: 6,
};

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
  dec: 11, december: 11,
};

/** Resolve relative Hinglish/English date words to YYYY-MM-DD (local). */
export function extractDate(raw: string): string | null {
  const text = norm(raw);
  const today = new Date();

  const addDays = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    return toISODateLocal(d);
  };

  if (/\b(aaj|ajj|aj|today)\b/.test(text)) return addDays(0);
  if (/\bkal\b/.test(text)) {
    // "kal" is ambiguous (yesterday/tomorrow); in a booking context it means tomorrow
    return addDays(1);
  }
  if (/\bparso\b/.test(text)) return addDays(2);
  if (/\b(day after tomorrow)\b/.test(text)) return addDays(2);

  // weekday name -> next occurrence (if today, assume next week)
  for (const [name, dayIdx] of Object.entries(WEEKDAYS)) {
    if (new RegExp(`\\b${name}\\b`).test(text)) {
      let delta = (dayIdx - today.getDay() + 7) % 7;
      if (delta === 0) delta = 7;
      return addDays(delta);
    }
  }

  // "12 oct", "12 october", "5 jan"
  const md = text.match(/\b(\d{1,2})\s*(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\b/);
  if (md) {
    const day = Number(md[1]);
    const month = MONTHS[md[2]];
    let year = today.getFullYear();
    const candidate = new Date(year, month, day);
    if (candidate < new Date(toISODateLocal(today))) year += 1; // roll to next year if passed
    return toISODateLocal(new Date(year, month, day));
  }

  // ISO YYYY-MM-DD
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  return null;
}

/** Extract an INR amount: "₹1,500", "1500 rs", "500 rupees", "rs 500". */
export function extractMoney(raw: string): number | null {
  const text = raw.replace(/,/g, '');
  const patterns = [
    /₹\s*(\d+(?:\.\d+)?)/,
    /(\d+(?:\.\d+)?)\s*(?:rs|rupees|rupaye|inr)\b/i,
    /\brs\.?\s*(\d+(?:\.\d+)?)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const v = Number(m[1]);
      if (v > 0 && v < 10000000) return Math.round(v);
    }
  }
  return null;
}

/** Extract a 10-digit Indian mobile number (optionally +91 / spaces). */
export function extractPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  // +91XXXXXXXXXX
  const m91 = digits.match(/(?:91)?([6-9]\d{9})/);
  if (m91) return m91[1];
  return null;
}

/** Extract a time hint: "3 baje", "3:30", "3pm", "subah 10 baje", "shaam 5 baje". */
export function extractTime(raw: string): string | null {
  // Colon times are matched on the RAW text because norm() strips colons.
  let m = raw.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/i);
  if (m) {
    let h = Number(m[1]);
    const min = m[2];
    const ap = (m[3] ?? '').toLowerCase();
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    if (h > 23) return null;
    return `${String(h).padStart(2, '0')}:${min}`;
  }

  const text = norm(raw);

  // "3 baje", "3pm", "subah 10 baje", "shaam ko 5 baje".
  // The meridiem word (baje/am/pm) is REQUIRED so bare numbers
  // (e.g. digits inside a phone number) never match.
  // NOTE: "baje" is meridiem-neutral; only am/pm shift the hour, plus
  // evening period words (shaam/raat/...) with a neutral meridiem.
  m = text.match(/(subah|savere|morning|dopahar|afternoon|shaam|sham|evening|raat|night)?\s*(\d{1,2})\s*(baje|pm|am)(?!\d)/);
  if (m) {
    let h = Number(m[2]);
    const period = m[1];
    const ap = m[3];
    const isPM = ap === 'pm';
    const isAM = ap === 'am';
    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;
    if (!isPM && !isAM && (period === 'shaam' || period === 'sham' || period === 'evening' || period === 'raat' || period === 'night') && h < 12) h += 12;
    if (h > 23) return null;
    return `${String(h).padStart(2, '0')}:00`;
  }

  return null;
}

/** Guess the service/job title from common trade keywords. */
const SERVICE_KEYWORDS: Array<{ keys: string[]; title: string }> = [
  { keys: ['ac', 'air conditioner', 'cooler'], title: 'AC Service' },
  { keys: ['fridge', 'refrigerator'], title: 'Fridge Repair' },
  { keys: ['washing machine', 'washer'], title: 'Washing Machine Repair' },
  { keys: ['plumb', 'nal', 'tap', 'pipe', 'leak'], title: 'Plumbing Work' },
  { keys: ['electric', 'bijli', 'wire', 'switch', 'board', 'fan', 'pankha', 'light'], title: 'Electrical Work' },
  { keys: ['pest', 'cockroach', 'termite', 'deemak'], title: 'Pest Control' },
  { keys: ['clean', 'safai', 'saaf'], title: 'Cleaning Service' },
  { keys: ['paint'], title: 'Painting Work' },
  { keys: ['carpenter', 'furniture', 'lakdi'], title: 'Carpentry Work' },
  { keys: ['tv', 'television'], title: 'TV Repair' },
  { keys: ['chimney'], title: 'Chimney Service' },
  { keys: ['geyser', 'water heater'], title: 'Geyser Service' },
  { keys: ['microwave', 'oven'], title: 'Microwave Repair' },
];

export function extractServiceTitle(raw: string): string | null {
  const text = norm(raw);
  for (const s of SERVICE_KEYWORDS) {
    if (hasAny(text, s.keys)) return s.title;
  }
  return null;
}

const NAME_STOPWORDS = new Set([
  'kal', 'parso', 'aaj', 'ajj', 'aj', 'kaam', 'job', 'repair', 'service',
  'ac', 'tv', 'fridge', 'cooler', 'fan', 'pankha', 'geyser', 'chimney',
  'tap', 'nal', 'pipe', 'mere', 'mera', 'meri', 'apna', 'apni',
  'uska', 'uski', 'iska', 'iski', 'ghar', 'dukaan', 'shop', 'office',
  'ka', 'ke', 'ki', 'ko', 'mein', 'me', 'par', 'se', 'hai', 'tha',
]);

function capitalizeWord(w: string): string {
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

/**
 * Guess a customer name. Heuristics for Hinglish WhatsApp text:
 *  - "Ramesh ka AC repair" / "Ramesh ke ghar" (word right before ka/ke/ki,
 *    stopword-filtered so "AC ka" / "ghar ka" don't match)
 *  - "customer: Ramesh Kumar" / "naam Ramesh hai"
 */
export function extractCustomerName(raw: string): string | null {
  const text = raw.trim();

  const m1 = text.match(/\b([A-Za-z]{2,25})\s+(?:ka|ke|ki)\b/);
  if (m1 && !NAME_STOPWORDS.has(m1[1].toLowerCase())) {
    return capitalizeWord(m1[1]);
  }

  const m2 = text.match(/(?:customer|client|grahak|naam|name)\s*[:\-]?\s*([A-Za-z][A-Za-z\s]{1,30}?)(?:\s*,|\s+ka\b|\s+ke\b|\s+ki\b|\s+hai\b|\s*₹|\s*\d|$)/i);
  if (m2) {
    const name = m2[1].trim().split(/\s+/).map(capitalizeWord).join(' ');
    if (name.length >= 2 && !/^(kaam|job|repair|service)$/i.test(name)) return name;
  }

  return null;
}

/** Address hints: "address: ...", "ghar ...", "sector 21", "at ..." */
export function extractAddress(raw: string): string | null {
  const text = raw.trim();
  // Commas are allowed so "Sector 21, Noida" is captured whole.
  // The confirmation preview lets the user correct over-capture.
  const m = text.match(/(?:address|pata)\s*[:\-]\s*([^\n]{3,80})/i);
  if (m) return m[1].trim();
  const m2 = text.match(/\b(sector\s*\d+[a-z]?[^,\n]{0,40})/i);
  if (m2) return m2[1].trim();
  return null;
}

// ---------------------------------------------------------------------------
// Intent detection
// ---------------------------------------------------------------------------

export function detectIntent(raw: string): CopilotIntent {
  const text = ' ' + norm(raw) + ' ';

  const isQuestion = /[?]/.test(raw) || hasAny(text, [
    ' kitna ', ' kitne ', ' kitni ', ' kab ', ' kaun ', ' kya ', ' kaise ',
    ' batao ', ' bataye ', ' dikhao ', ' show ', ' list ', ' check ',
    ' how much ', ' how many ', ' what ', ' when ',
  ]);

  // 1. Payment reminder drafting
  if (hasAny(text, [' reminder ', ' yaad dilao ', ' msg banao ', ' message banao ', ' payment reminder '])) {
    return 'draft_reminder';
  }

  // 2. Revenue questions
  if (hasAny(text, [' kamai ', ' kamaya ', ' revenue ', ' collection ', ' earning ', ' income '])) {
    return 'ask_revenue';
  }

  // 3. Unpaid / outstanding questions
  if (hasAny(text, [' unpaid ', ' outstanding ', ' baki ', ' pending payment ', ' udhar ', ' wasool ', ' dues '])) {
    return 'ask_unpaid';
  }

  // 4. Job creation — BEFORE schedule queries, so "Ramesh ka AC repair kal"
  //    is treated as a booking, not a question about tomorrow's jobs.
  //    Bare "schedule"/"add"/"create" are NOT booking verbs on their own
  //    ("schedule dikhao" is a query); only action phrases count.
  const hasBookingVerb = hasAny(text, [
    ' book ', ' book karo ', ' book kar ', ' schedule karo ', ' schedule kar ',
    ' add karo ', ' add kar ', ' create karo ', ' naya kaam ', ' kaam hai ',
    ' repair karna ', ' fix karna ', ' bhejo ', ' bhej do ', ' lagwana ',
  ]);
  const hasService = extractServiceTitle(raw) !== null;
  const hasWho = extractCustomerName(raw) !== null || extractPhone(raw) !== null;
  if (hasBookingVerb || (hasService && hasWho && !isQuestion)) {
    return 'create_job';
  }

  // 5a. Customer count / list questions ("mere kitne customers hain?", "customer list dikhao")
  const mentionsCustomer = hasAny(text, [' customer ', ' customers ', ' client ', ' clients ', ' grahak ']);
  const wantsCountOrList = isQuestion || hasAny(text, [' kitne ', ' kitna ', ' kitni ', ' how many ', ' list ', ' dikhao ', ' batao ']);
  if (mentionsCustomer && wantsCountOrList && !extractPhone(raw)) {
    return 'ask_customers';
  }

  // 5b. Customer lookup
  if (
    mentionsCustomer ||
    (/ number /.test(text) && / ka /.test(text)) ||
    / find /.test(text)
  ) {
    return 'find_customer';
  }

  // 6. Schedule questions
  if (
    hasAny(text, [' schedule ', ' aaj ', ' ajj ', ' aj ', ' kal ', ' parso ', ' jobs ', ' appointments ', ' kaam '])
  ) {
    return 'ask_schedule';
  }

  // 7. Help
  if (hasAny(text, [' help ', ' madad ', ' kya kar sakte ', ' what can you do '])) {
    return 'help';
  }

  // Default: question-ish -> schedule overview, else help
  if (isQuestion) return 'ask_schedule';
  return 'help';
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

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export async function runCopilot(
  businessId: string,
  _userId: string,
  message: string
): Promise<CopilotResult> {
  const biz = await prisma.business.findUnique({ where: { id: businessId }, select: { currency: true } });
  const currency = biz?.currency ?? 'INR';
  const intent = detectIntent(message);
  const todayStr = toISODateLocal(new Date());

  switch (intent) {
    case 'create_job': {
      const draft: JobDraft = {
        title: extractServiceTitle(message) ?? 'General Service',
        date: extractDate(message) ?? todayStr,
        time: extractTime(message),
        customerName: extractCustomerName(message) ?? '',
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
      if (matched) lines.push('', `Note: ${matched.name} aapke customers mein pehle se hai.`);
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
    case 'unknown':
    default:
      return { intent: 'help', reply: HELP_TEXT };
  }
}
