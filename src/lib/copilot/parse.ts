/**
 * Copilot command parser — natural-language (English + Canadian French) text
 * into intents and booking entities. Canada-only.
 *
 * Explicit-confirm boundary lives in engine.ts: this module only PARSES,
 * it never creates records.
 */

import { toISODateLocal } from '@/lib/utils';

export type CopilotIntent =
  | 'create_job'
  | 'ask_schedule'
  | 'find_customer'
  | 'ask_customers'
  | 'ask_revenue'
  | 'ask_unpaid'
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

export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents so "après" matches "apres"
    .replace(/[।!?.,;:'"()\[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function hasAny(text: string, words: string[]): boolean {
  return words.some((w) => text.includes(w));
}

// ---------------------------------------------------------------------------
// Entity extraction (English + Canadian French)
// ---------------------------------------------------------------------------

const WEEKDAYS: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6,
};

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, janvier: 0,
  feb: 1, february: 1, fevrier: 1, fev: 1,
  mar: 2, march: 2, mars: 2,
  apr: 3, april: 3, avril: 3, avr: 3,
  may: 4, mai: 4,
  jun: 5, june: 5, juin: 5,
  jul: 6, july: 6, juillet: 6, juil: 6,
  aug: 7, august: 7, aout: 7,
  sep: 8, sept: 8, september: 8, septembre: 8,
  oct: 9, october: 9, octobre: 9,
  nov: 10, november: 10, novembre: 10,
  dec: 11, december: 11, decembre: 11,
};

/** Resolve relative English/French date words to YYYY-MM-DD (local). */
export function extractDate(raw: string): string | null {
  const text = norm(raw);
  const today = new Date();

  const addDays = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    return toISODateLocal(d);
  };

  if (/\b(today|aujourdhui)\b/.test(text)) return addDays(0);
  if (/\b(tomorrow|demain)\b/.test(text)) return addDays(1);
  if (/\b(day after tomorrow|apres demain|apres-demain)\b/.test(text)) return addDays(2);

  // weekday name -> next occurrence (if today, assume next week)
  for (const [name, dayIdx] of Object.entries(WEEKDAYS)) {
    if (new RegExp(`\\b${name}\\b`).test(text)) {
      let delta = (dayIdx - today.getDay() + 7) % 7;
      if (delta === 0) delta = 7;
      return addDays(delta);
    }
  }

  // "25", "25th" — bare day of month, this month if still ahead, otherwise
  // next month. Only when followed by "of"/"this month" is it unambiguous;
  // otherwise require an explicit cue so bare amounts don't clash with money.
  // (Date+month and ISO forms below cover the common explicit cases.)

  // "12 oct", "12 octobre", "5 jan"
  const md = text.match(
    /\b(\d{1,2})\s*(jan|january|janvier|feb|february|fevrier|fev|mar|march|mars|apr|april|avril|avr|may|mai|jun|june|juin|jul|july|juillet|juil|aug|august|aout|sep|sept|september|septembre|oct|october|octobre|nov|november|novembre|dec|december|decembre)\b/
  );
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

/** Extract a CAD amount: "$1,500", "1500$", "1500 dollars", "800 cad". */
export function extractMoney(raw: string): number | null {
  const text = raw.replace(/,/g, '');
  // Prefer currency-marked forms first.
  const marked = [
    /\$\s*(\d+(?:\.\d+)?)/,
    /(\d+(?:\.\d+)?)\s*\$/,
    /(\d+(?:\.\d+)?)\s*(?:dollars?|cad|bucks)\b/i,
  ];
  for (const p of marked) {
    const m = text.match(p);
    if (m) {
      const v = Number(m[1]);
      if (v > 0 && v < 10000000) return Math.round(v);
    }
  }
  // "2 thousand" — spoken English.
  const mK = text.match(/(\d+(?:\.\d+)?)\s*(?:thousand|k)\b/i);
  if (mK) {
    const v = Number(mK[1]) * 1000;
    if (v > 0 && v < 10000000) return Math.round(v);
  }
  // Bare 3-5 digit number in a booking context is a price ("plumbing for
  // Sarah tomorrow 800"). 1-2 digit numbers are dates, 10-digit numbers
  // are phones — neither can match this shape. The booking preview always
  // asks for confirmation, so a wrong guess is cheap and correctable.
  const bare = text.match(/\b(\d{3,5})\b/);
  if (bare) {
    const v = Number(bare[1]);
    if (v > 0 && v < 10000000) return Math.round(v);
  }
  return null;
}

/** Extract a 10-digit NANP number (optional leading 1 / +1 / spaces / dashes). */
export function extractPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  // Strip a single leading country code 1.
  const d = digits.replace(/^1(?=\d{10}$)/, '');
  const m = d.match(/^([2-9]\d{2}[2-9]\d{6})$/);
  if (m) return m[1];
  return null;
}

/**
 * Extract a time hint: "3pm", "3:30", "15h", "15h30", "tomorrow morning",
 * "demain matin", "Friday evening".
 */
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

  // French "15h", "15h30".
  m = text.match(/\b(\d{1,2})h(?:(\d{2}))?\b/);
  if (m) {
    const h = Number(m[1]);
    const min = m[2] ?? '00';
    if (h > 23) return null;
    return `${String(h).padStart(2, '0')}:${min}`;
  }

  // "3pm", "3 pm", "3 in the afternoon".
  // The meridiem word (am/pm/afternoon...) is REQUIRED so bare numbers
  // (e.g. digits inside a phone number) never match.
  m = text.match(
    /\b(morning|matin|afternoon|apres midi|evening|soir|soiree|night|nuit)?\s*(\d{1,2})\s*(am|pm)\b/
  );
  if (m) {
    let h = Number(m[2]);
    const isPM = m[3] === 'pm';
    const isAM = m[3] === 'am';
    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;
    if (h > 23) return null;
    return `${String(h).padStart(2, '0')}:00`;
  }
  m = text.match(/\b(\d{1,2})\s*(?:in the )?(morning|afternoon|evening|night|matin|apres midi|soir|soiree|nuit)\b/);
  if (m) {
    let h = Number(m[1]);
    const period = m[2];
    if ((period === 'afternoon' || period === 'evening' || period === 'apres midi' || period === 'soir' || period === 'soiree') && h < 12) h += 12;
    if (h > 23) return null;
    return `${String(h).padStart(2, '0')}:00`;
  }

  // Bare period words with no hour ("tomorrow morning", "demain soir").
  // Conventional defaults — the booking preview shows the time and the user
  // can change it before confirming, so a sensible default beats "TBD".
  if (/\b(morning|matin|matinee)\b/.test(text)) return '10:00';
  if (/\b(afternoon|apres midi)\b/.test(text)) return '14:00';
  if (/\b(evening|soir|soiree)\b/.test(text)) return '17:00';
  if (/\b(night|nuit)\b/.test(text)) return '20:00';

  return null;
}

/** Guess the service/job title from common trade keywords (en + fr). */
const SERVICE_KEYWORDS: Array<{ keys: string[]; title: string }> = [
  { keys: ['ac', 'air conditioner', 'climatisation', 'clim'], title: 'AC Service' },
  { keys: ['fridge', 'refrigerator', 'frigo', 'refrigerateur'], title: 'Fridge Repair' },
  { keys: ['washing machine', 'washer', 'laveuse', 'lave linge'], title: 'Washing Machine Repair' },
  { keys: ['plumb', 'plomberie', 'plombier', 'tap', 'robinet', 'pipe', 'tuyau', 'leak', 'fuite', 'drain'], title: 'Plumbing Work' },
  { keys: ['electric', 'electricien', 'electricite', 'wire', 'fil', 'switch', 'interrupteur', 'breaker', 'fan', 'ventilateur', 'light', 'lumiere', 'eclairage'], title: 'Electrical Work' },
  { keys: ['furnace', 'fournaise', 'heat pump', 'thermopompe'], title: 'HVAC Service' },
  { keys: ['pest', 'cockroach', 'termite', 'extermination'], title: 'Pest Control' },
  { keys: ['clean', 'nettoyage', 'menage'], title: 'Cleaning Service' },
  { keys: ['paint', 'peinture', 'peintre'], title: 'Painting Work' },
  { keys: ['carpenter', 'furniture', 'menuisier', 'ebeniste'], title: 'Carpentry Work' },
  { keys: ['roof', 'toit', 'toiture', 'couvreur'], title: 'Roofing Work' },
  { keys: ['lock', 'serrure', 'serrurier'], title: 'Locksmith' },
  { keys: ['tv', 'television', 'tele'], title: 'TV Repair' },
  { keys: ['microwave', 'oven', 'micro ondes', 'four'], title: 'Appliance Repair' },
  { keys: ['landscap', 'paysagiste', 'lawn', 'gazon', 'snow', 'neige', 'deneigement'], title: 'Yard & Snow Work' },
];

export function extractServiceTitle(raw: string): string | null {
  const text = norm(raw);
  for (const s of SERVICE_KEYWORDS) {
    if (hasAny(text, s.keys)) return s.title;
  }
  return null;
}

const NAME_STOPWORDS = new Set([
  // English fillers
  'job', 'repair', 'service', 'work', 'appointment', 'booking',
  'house', 'home', 'shop', 'office', 'place',
  'the', 'a', 'an', 'guy', 'man', 'woman', 'person', 'someone', 'anyone',
  'my', 'our', 'their', 'his', 'her',
  // French fillers
  'pour', 'chez', 'avec', 'sans', 'dans', 'sur', 'demain', 'aujourdhui',
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'mon', 'ma', 'mes', 'son', 'sa',
  'monsieur', 'madame', 'm', 'mme',
  // time words — so "for Priya tomorrow" doesn't become "Priya Tomorrow"
  'tomorrow', 'today', 'morning', 'evening', 'afternoon', 'night',
  'matin', 'soir', 'soiree', 'apres', 'midi', 'nuit',
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
  'dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi',
]);

/**
 * Trade/service tokens must NEVER be mistaken for a customer name
 * ("plumbing work for Sarah" -> customer must stay Sarah, never "Plumbing").
 * Built from the SERVICE_KEYWORDS above so the two lists can't drift.
 */
const SERVICE_TOKENS = new Set<string>();
for (const s of SERVICE_KEYWORDS) {
  for (const k of s.keys) for (const tok of k.split(/\s+/)) SERVICE_TOKENS.add(tok);
}
for (const t of SERVICE_TOKENS) NAME_STOPWORDS.add(t);

/** Honorifics that sit between a name and its cue ("Mr. Sharma", "M. Tremblay"). */
const HONORIFICS = ['mr', 'mrs', 'ms', 'miss', 'dr', 'monsieur', 'madame', 'm', 'mme', 'sir'];
const HONORIFIC_RE = new RegExp(`\\b(?:${HONORIFICS.join('|')})\\.?\\b`, 'gi');

function capitalizeWord(w: string): string {
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

/**
 * Guess a customer name from English/French booking text:
 *  - "for Priya" / "for Ramesh Kumar" / "pour Sarah Tremblay"
 *  - "customer: Priya" / "client: Sarah"
 *
 * Service/trade words ("plumbing", "plomberie", …) are stopwords and can
 * never be returned as a name. A name containing a filler word mid-phrase
 * (e.g. "Nonexistent Person XYZ") is rejected rather than truncated —
 * booking under a half-guessed name is worse than asking.
 */
export function extractCustomerName(raw: string): string | null {
  const text = raw.trim().replace(HONORIFIC_RE, ' ');

  // English "for Priya" / French "pour Sarah Tremblay" — up to three name
  // words; every token must look like a name part. Trailing time words as
  // in "for Priya tomorrow morning" are dropped, keeping "Priya".
  const mFor = text.match(
    /\b(?:for|pour)\s+([A-Za-z]{2,25}(?:\s+[A-Za-z]{2,25}){0,2})(?=[\s,]|$)/i
  );
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

  const m2 = text.match(
    /(?:customer|client)\s*[:\-]?\s*([A-Za-z][A-Za-z\s]{1,30}?)(?:\s*,|\s*\d|$)/i
  );
  if (m2) {
    const name = m2[1].trim().split(/\s+/).map(capitalizeWord).join(' ');
    const toks = name.split(' ');
    if (
      name.length >= 2 &&
      !/^(job|repair|service)$/i.test(name) &&
      !toks.some((t) => NAME_STOPWORDS.has(t.toLowerCase()))
    ) {
      return name;
    }
  }

  return null;
}

/** Address hints: "address: ...", "adresse: ...", "at ..." */
export function extractAddress(raw: string): string | null {
  const text = raw.trim();
  // Commas are allowed so "123 Main St, Toronto" is captured whole.
  // The confirmation preview lets the user correct over-capture.
  const m = text.match(/(?:address|adresse)\s*[:\-]\s*([^\n]{3,80})/i);
  if (m) return m[1].trim();
  return null;
}

/**
 * Minimal conversation context for pronoun follow-ups ("move it to tomorrow").
 * If the message uses a pronoun and names no customer explicitly, resolve it
 * to the most recently mentioned customer from the conversation history
 * (assistant preview lines carry "Customer: <name>").
 */
const FOLLOWUP_PRONOUNS = ['him', 'her', 'them', 'lui', 'elle', 'elles', 'ils'];

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
    if (name && name.length >= 2 && !/^(job|repair|service)$/i.test(name)) {
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
    ' cancel ', ' cancelled ', ' delete ', ' remove ',
    ' annuler ', ' annule ', ' annulation ', ' supprime ', ' supprimer ',
  ]);
}

export function detectIntent(raw: string, followUpName: string | null = null): CopilotIntent {
  const text = ' ' + norm(raw) + ' ';

  const isQuestion = /[?]/.test(raw) || hasAny(text, [
    ' how much ', ' how many ', ' what ', ' when ', ' show ', ' list ', ' check ',
    ' combien ', ' quand ', ' quoi ', ' qui ', ' montre ', ' montre moi ',
    ' affiche ', ' afficher ', ' liste ',
  ]);

  // 1. Payment reminder drafting
  if (hasAny(text, [' reminder ', ' payment reminder ', ' rappel ', ' rappel de paiement ', ' relance '])) {
    return 'draft_reminder';
  }

  // 2. Revenue questions
  if (hasAny(text, [' revenue ', ' earning ', ' earnings ', ' income ', ' collection ', ' revenu ', ' revenus ', ' gains ', ' chiffre '])) {
    return 'ask_revenue';
  }

  // 3. Unpaid / outstanding questions
  if (hasAny(text, [' unpaid ', ' outstanding ', ' pending payment ', ' dues ', ' impaye ', ' impayes ', ' non paye ', ' en retard '])) {
    return 'ask_unpaid';
  }

  // 4. Job creation — BEFORE schedule queries, so "AC repair for Sarah
  //    tomorrow" is treated as a booking, not a question about tomorrow's
  //    jobs. Booking verbs ("book", "create", "schedule", "add", "réserver",
  //    "planifier", "ajouter", "créer") combined with a service, a
  //    customer, or a date. Bare "schedule"/"add" alone are NOT booking
  //    verbs ("show schedule" is a query); cancellations never book.
  const hasBookingVerb = hasAny(text, [
    ' book ', ' booked ', ' create ', ' schedule ', ' scheduling ', ' add ',
    ' arrange ', ' new job ', ' new booking ',
    ' reserver ', ' reserve ', ' reservation ', ' planifier ', ' planifie ',
    ' ajouter ', ' ajoute ', ' creer ', ' cree ', ' nouveau travail ',
  ]);
  const hasService = extractServiceTitle(raw) !== null;
  const hasWho = extractCustomerName(raw) !== null || extractPhone(raw) !== null || !!followUpName;
  const hasWhen = extractDate(raw) !== null;
  // Pronoun follow-up to an earlier booking discussion ("move it to tomorrow").
  const followUpBooking =
    !!followUpName &&
    hasAny(text, [
      ' move ', ' change ', ' book ', ' schedule ', ' reschedule ',
      ' deplacer ', ' reporter ', ' tomorrow ', ' demain ',
    ]);
  if (
    !isCancellation(text) &&
    ((hasBookingVerb && !isQuestion) ||
      followUpBooking ||
      (hasService && hasWho && !isQuestion) ||
      // "plumbing for Sarah tomorrow" — a service + a date with no question
      // is a booking, not a schedule query. Confirmation is always required,
      // so a wrong guess here is cheap and correctable.
      (hasService && hasWhen && !isQuestion))
  ) {
    return 'create_job';
  }

  // 5a. Customer count / list questions ("how many customers?", "liste des clients")
  const mentionsCustomer = hasAny(text, [' customer ', ' customers ', ' client ', ' clients ', ' clientele ']);
  const wantsCountOrList = isQuestion || hasAny(text, [' how many ', ' list ', ' combien ', ' liste ']);
  if (mentionsCustomer && wantsCountOrList && !extractPhone(raw)) {
    return 'ask_customers';
  }

  // 5b. Customer lookup
  if (
    mentionsCustomer ||
    /\bfind\b/.test(text) ||
    /\btrouver\b/.test(text)
  ) {
    return 'find_customer';
  }

  // 6. Schedule questions
  if (
    hasAny(text, [' schedule ', ' horaire ', ' jobs ', ' appointments ', ' rendez vous ', ' rendezvous ', ' today ', ' tomorrow ', ' aujourdhui ', ' demain ', ' this week ', ' cette semaine '])
  ) {
    return 'ask_schedule';
  }

  // 7. Help
  if (hasAny(text, [' help ', ' what can you do ', ' aide ', ' que peux tu faire ', ' que fais tu '])) {
    return 'help';
  }

  // Default: question-ish -> schedule overview, otherwise unknown (the
  // caller asks a clarifying question — never silence, never a wrong guess).
  if (isQuestion) return 'ask_schedule';
  return 'unknown';
}
