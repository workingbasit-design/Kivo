/**
 * Kivo copilot — pure parsing layer (no database, no network).
 *
 * Deterministic intent detection + Hinglish entity extraction.
 * Kept free of Prisma imports so it can be unit-tested in isolation.
 */

import { toISODateLocal } from '@/lib/utils';

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

export function norm(s: string): string {
  return s.toLowerCase().replace(/[।!?.,;:'"()\[\]{}]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function hasAny(text: string, words: string[]): boolean {
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
  // NOTE: checked AFTER "day after tomorrow" (which contains "tomorrow").
  if (/\btomorrow\b/.test(text)) return addDays(1);

  // weekday name -> next occurrence (if today, assume next week)
  for (const [name, dayIdx] of Object.entries(WEEKDAYS)) {
    if (new RegExp(`\\b${name}\\b`).test(text)) {
      let delta = (dayIdx - today.getDay() + 7) % 7;
      if (delta === 0) delta = 7;
      return addDays(delta);
    }
  }

  // "25 ko", "25 tarikh ko", "25 tarik" — day of month, this month if still
  // ahead, otherwise next month.
  const dom = text.match(/\b(\d{1,2})\s*(?:ko|tarikh|tarik)\b/);
  if (dom) {
    const day = Number(dom[1]);
    if (day >= 1 && day <= 31) {
      const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      let cand = new Date(today.getFullYear(), today.getMonth(), day);
      if (cand < todayMid) cand = new Date(today.getFullYear(), today.getMonth() + 1, day);
      // getDate() !== day means the day rolled over (e.g. Feb 30) — invalid.
      if (cand.getDate() === day) return toISODateLocal(cand);
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

/** Extract an INR amount: "₹1,500", "1500 rs", "500 rupees", "rs 500",
 *  "2000 me", "2 hazaar", "1.5 lakh". */
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
  // "2 hazaar", "1.5 lakh" — spoken Indian denominations.
  const mHaz = text.match(/(\d+(?:\.\d+)?)\s*(hazaar|hazar|thousand)\b/i);
  if (mHaz) {
    const v = Number(mHaz[1]) * 1000;
    if (v > 0 && v < 10000000) return Math.round(v);
  }
  const mLakh = text.match(/(\d+(?:\.\d+)?)\s*(lakh|lac)\b/i);
  if (mLakh) {
    const v = Number(mLakh[1]) * 100000;
    if (v > 0 && v < 10000000) return Math.round(v);
  }
  // "2000 me / mein" — a 3-5 digit amount with the postposition is a price
  // in booking context ("2000 me kar do"). Phone numbers (10 digits) and
  // day-dates ("25 ko") can't match this shape.
  const mMe = text.match(/\b(\d{3,5})\s*(?:mein|me)\b/i);
  if (mMe) {
    const v = Number(mMe[1]);
    if (v > 0 && v < 10000000) return Math.round(v);
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

  // Bare period words with no hour ("tomorrow morning", "shaam ko").
  // Conventional defaults — the booking preview shows the time and the user
  // can change it before confirming, so a sensible default beats "TBD".
  if (/\b(subah|savere|morning)\b/.test(text)) return '10:00';
  if (/\b(dopahar|afternoon)\b/.test(text)) return '14:00';
  if (/\b(shaam|sham|evening)\b/.test(text)) return '17:00';
  if (/\b(raat|night)\b/.test(text)) return '20:00';

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
  // English fillers that show up in "for the guy" style fragments
  'the', 'a', 'an', 'guy', 'man', 'person', 'someone', 'anyone',
  // time words — so "for Priya tomorrow" doesn't become "Priya Tomorrow"
  'tomorrow', 'today', 'morning', 'evening', 'afternoon', 'night',
  'subah', 'shaam', 'sham', 'dopahar', 'raat', 'savere',
]);

/**
 * Trade/service tokens must NEVER be mistaken for a customer name
 * ("bijli ka kaam" -> customer "Bijli" was a real mis-parse).
 * Built from the SERVICE_KEYWORDS above so the two lists can't drift.
 */
const SERVICE_TOKENS = new Set<string>();
for (const s of SERVICE_KEYWORDS) {
  for (const k of s.keys) for (const tok of k.split(/\s+/)) SERVICE_TOKENS.add(tok);
}
for (const t of SERVICE_TOKENS) NAME_STOPWORDS.add(t);

/** Honorifics that sit between a name and its postposition ("Sharma ji ke liye"). */
const HONORIFICS = ['ji', 'sahab', 'sahabji', 'sir', 'bhai', 'bhaiya', 'didi'];
const HONORIFIC_RE = new RegExp(`\\b(?:${HONORIFICS.join('|')})\\b`, 'gi');

function capitalizeWord(w: string): string {
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

/**
 * Guess a customer name. Heuristics for Hinglish WhatsApp text:
 *  - "Sharma ji ke liye" (honorific between name and postposition)
 *  - "Ramesh ka AC repair" / "Ramesh ke ghar" (word right before ka/ke/ki,
 *    stopword-filtered so "AC ka" / "bijli ka" / "ghar ka" don't match)
 *  - "for Priya" / "for Ramesh Kumar" (English)
 *  - "customer: Ramesh Kumar" / "naam Ramesh hai"
 *
 * Service/trade words ("bijli", "nal", …) are stopwords and can never be
 * returned as a name.
 */
export function extractCustomerName(raw: string): string | null {
  const text = raw.trim();

  // "Sharma ji ke liye", "Ramesh sahab ka kaam"
  const mh = text.match(
    /\b([A-Za-z]{2,25})\s+(?:ji|sahab|sahabji|sir|bhai|bhaiya|didi)\s+(?:ke\s+liye|ka|ke|ki)\b/i
  );
  if (mh && !NAME_STOPWORDS.has(mh[1].toLowerCase())) {
    return capitalizeWord(mh[1]);
  }

  // Strip honorifics, then the plain "X ka/ke/ki" pattern.
  const cleaned = text.replace(HONORIFIC_RE, ' ');
  const m1 = cleaned.match(/\b([A-Za-z]{2,25})\s+(?:ka|ke|ki)\b/);
  if (m1 && !NAME_STOPWORDS.has(m1[1].toLowerCase())) {
    return capitalizeWord(m1[1]);
  }

  // English "for Priya" / "for Ramesh Kumar" — every token must look like a
  // name part ("for the guy" is rejected via stopwords; a trailing time word
  // as in "for Priya tomorrow" is dropped, keeping "Priya").
  const mFor = text.match(/\bfor\s+([A-Za-z]{2,25}(?:\s+[A-Za-z]{2,25})?)(?=[\s,]|$)/i);
  if (mFor) {
    const toks = mFor[1].trim().split(/\s+/);
    while (toks.length > 1 && NAME_STOPWORDS.has(toks[toks.length - 1].toLowerCase())) {
      toks.pop();
    }
    if (
      toks.length > 0 &&
      toks.every((t) => t.length >= 2 && !NAME_STOPWORDS.has(t.toLowerCase()))
    ) {
      return toks.map(capitalizeWord).join(' ');
    }
  }

  const m2 = text.match(/(?:customer|client|grahak|naam|name)\s*[:\-]?\s*([A-Za-z][A-Za-z\s]{1,30}?)(?:\s*,|\s+ka\b|\s+ke\b|\s+ki\b|\s+hai\b|\s*₹|\s*\d|$)/i);
  if (m2) {
    const name = m2[1].trim().split(/\s+/).map(capitalizeWord).join(' ');
    const toks = name.split(' ');
    if (
      name.length >= 2 &&
      !/^(kaam|job|repair|service)$/i.test(name) &&
      !toks.some((t) => NAME_STOPWORDS.has(t.toLowerCase()))
    ) {
      return name;
    }
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

/**
 * Minimal conversation context for pronoun follow-ups ("usko kal kar do").
 * If the message uses a pronoun and names no customer explicitly, resolve it
 * to the most recently mentioned customer from the conversation history
 * (assistant preview lines carry "Customer: <name>").
 */
const FOLLOWUP_PRONOUNS = [
  'usko', 'uska', 'uski', 'uske', 'use',
  'unko', 'unka', 'unki', 'unhe',
  'isko', 'iska', 'iski', 'iske', 'ise',
  'inko', 'inhe', 'inhi', 'unhi',
  'him', 'her', 'them',
];

export interface CopilotHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export function resolveFollowUpName(
  raw: string,
  history: CopilotHistoryItem[]
): string | null {
  const text = norm(raw);
  const hasPronoun = FOLLOWUP_PRONOUNS.some((p) =>
    new RegExp(`\\b${p}\\b`).test(text)
  );
  if (!hasPronoun) return null;
  if (extractCustomerName(raw)) return null; // an explicit name always wins
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    let name: string | null = null;
    if (h.role === 'assistant') {
      const m = h.content.match(/Customer:\s*([A-Za-z][A-Za-z ]{1,30})/);
      if (m) name = m[1].trim();
    } else {
      name = extractCustomerName(h.content);
    }
    if (name && name.length >= 2 && !/^(kaam|job|naam nahi mila)/i.test(name)) {
      return name;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Intent detection
// ---------------------------------------------------------------------------

/** Explicit cancellation — must never be mistaken for a booking. */
function isCancellation(text: string): boolean {
  return hasAny(text, [
    ' cancel ', ' cancelled ', ' delete ', ' hatao ', ' hatado ', ' remove ',
  ]);
}

export function detectIntent(raw: string, followUpName: string | null = null): CopilotIntent {
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
  //
  //    Language-agnostic: Hinglish action phrases ("book karo", "kaam hai",
  //    "kar do") plus English verbs ("create", "book", "schedule", "add")
  //    combined with a service, a customer, or a date. Bare
  //    "schedule"/"add"/"create" alone are NOT booking verbs ("schedule
  //    dikhao" is a query); cancellations never book.
  const hasStrongBookingVerb = hasAny(text, [
    ' book ', ' book karo ', ' book kar ', ' schedule karo ', ' schedule kar ',
    ' add karo ', ' add kar ', ' create karo ', ' naya kaam ', ' kaam hai ',
    ' kaam karna ', ' repair karna ', ' fix karna ', ' karwana ', ' karva do ',
    ' bhejo ', ' bhej do ', ' lagwana ',
  ]);
  const hasEnglishBookingVerb = hasAny(text, [
    ' create ', ' book ', ' booked ', ' schedule ', ' scheduling ', ' add ', ' arrange ',
  ]);
  // "kar do" is a weaker booking verb ("25 ko bijli ka kaam kar do") — it
  // only signals a booking when a service or a date is also present, so
  // "message kar do" doesn't become a job. Cancellation text is excluded
  // up-front by isCancellation.
  const hasKarDo = text.includes(' kar do ');
  const hasService = extractServiceTitle(raw) !== null;
  const hasWho = extractCustomerName(raw) !== null || extractPhone(raw) !== null || !!followUpName;
  const hasWhen = extractDate(raw) !== null;
  // Pronoun follow-up to an earlier booking discussion ("usko kal kar do").
  const followUpBooking =
    !!followUpName &&
    hasAny(text, [
      ' kar do ', ' karo ', ' karva ', ' book ', ' schedule ',
      ' kal ', ' parso ', ' aaj ', ' ajj ', ' tomorrow ',
    ]);
  if (
    !isCancellation(text) &&
    (hasStrongBookingVerb ||
      followUpBooking ||
      (hasKarDo && (hasService || hasWhen)) ||
      (hasEnglishBookingVerb && (hasService || hasWho || hasWhen) && !isQuestion) ||
      (hasService && hasWho && !isQuestion))
  ) {
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

  // Default: question-ish -> schedule overview, otherwise unknown (the
  // caller asks a clarifying question — never silence, never a wrong guess).
  if (isQuestion) return 'ask_schedule';
  return 'unknown';
}

