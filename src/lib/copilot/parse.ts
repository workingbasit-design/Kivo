/**
 * Copilot command parser — natural-language (English + Canadian French) text
 * into intents and booking entities. Canada-only.
 *
 * Explicit-confirm boundary lives in engine.ts: this module only PARSES,
 * it never creates records.
 */

import { toISODateLocal } from '@/lib/utils';
import type { TradeKey } from '../certifications';

export type CopilotIntent =
  | 'create_job'
  | 'create_customer'
  | 'ask_schedule'
  | 'find_customer'
  | 'ask_customers'
  | 'ask_revenue'
  | 'ask_booked_revenue'
  | 'ask_unpaid'
  | 'ask_certification'
  | 'ask_compare'
  | 'out_of_scope'
  | 'draft_reminder'
  | 'help'
  | 'calculate'
  | 'refuse_destructive'
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

/** Draft for adding a brand-new customer — always previewed, never silent. */
export interface CustomerDraft {
  name: string;
  phone: string | null;
  address: string | null;
}

export interface CopilotResult {
  intent: CopilotIntent;
  reply: string;
  preview?: JobDraft | CustomerDraft;
  /** Which kind of record the preview would create. */
  previewKind?: 'job' | 'customer';
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

/** Build a YYYY-MM-DD for day+month, rolling to next year if already passed. */
function dayMonthToISO(day: number, month: number, today: Date): string {
  let year = today.getFullYear();
  const candidate = new Date(year, month, day);
  if (candidate < new Date(toISODateLocal(today))) year += 1; // roll to next year if passed
  return toISODateLocal(new Date(year, month, day));
}
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

  // "12 oct", "12 octobre", "5 jan", "29th october" — ordinal suffixes ok
  const md = text.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s*(jan|january|janvier|feb|february|fevrier|fev|mar|march|mars|apr|april|avril|avr|may|mai|jun|june|juin|jul|july|juillet|juil|aug|august|aout|sep|sept|september|septembre|oct|october|octobre|nov|november|novembre|dec|december|decembre)\b/
  );
  if (md) {
    return dayMonthToISO(Number(md[1]), MONTHS[md[2]], today);
  }

  // "october 29th", "oct 12" — month first, ordinal suffixes ok
  const dm = text.match(
    /\b(jan|january|janvier|feb|february|fevrier|fev|mar|march|mars|apr|april|avril|avr|may|mai|jun|june|juin|jul|july|juillet|juil|aug|august|aout|sep|sept|september|septembre|oct|october|octobre|nov|november|novembre|dec|december|decembre)\s*(\d{1,2})(?:st|nd|rd|th)?\b/
  );
  if (dm) {
    return dayMonthToISO(Number(dm[2]), MONTHS[dm[1]], today);
  }

  // ISO YYYY-MM-DD
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  return null;
}

/**
 * Detect the language of the user's message itself. The app is EN + Canadian
 * French: when the user writes French, the reply should be French even if the
 * business's UI locale is English (and vice versa). Returns null when the
 * message gives no clear signal — the caller then falls back to the locale.
 */
export function detectMessageLang(raw: string): 'fr' | 'en' | null {
  const text = ' ' + norm(raw) + ' ';
  const frMarkers = [
    ' combien ', ' facture ', ' factures ', ' impaye ', ' impayee ', ' impayes ', ' impayees ',
    ' merci ', ' bonjour ', ' bonsoir ', ' salut ', ' veuillez ', ' quel ', ' quelle ', ' quels ', ' quelles ',
    ' quand ', ' pourquoi ', ' comment ', " s il ", ' etes ', ' suis ', ' aujourd hui ', ' tache ', ' taches ',
    ' devis ', ' paiement ', ' paiements ', ' horaire ', ' revenu ', ' revenus ', ' gagne ', ' dois ',
    ' rendez vous ', ' plomberie ', ' plombier ', ' fournaise ', ' rappel ', ' rappelle ',
    // NOTE: 'client'/'clients' deliberately excluded — English speakers use
    // them too, so they are not reliable French signals.
  ];
  const enMarkers = [
    ' the ', ' what ', ' how ', ' my ', ' your ', ' today ', ' tomorrow ', ' schedule ',
    ' jobs ', ' customer ', ' customers ', ' invoice ', ' invoices ', ' payment ', ' payments ',
    ' revenue ', ' thanks ', ' please ', ' can you ', ' do i ', ' does ',
  ];
  let fr = 0;
  let en = 0;
  for (const m of frMarkers) if (text.includes(m)) fr++;
  for (const m of enMarkers) if (text.includes(m)) en++;
  if (fr > 0 && fr >= en) return 'fr';
  if (en > 0) return 'en';
  return null;
}

/** Phone-number-shaped digit runs — never a price ("416-555-0100" ≠ $416). */
const PHONE_LIKE_RE = /(\+?1[\s\-.]?)?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}/g;

/** Date-like digit runs — never a price ("09/28/2026" ≠ $2026). */
const NUMERIC_DATE_RE = /\b(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2})\b/g;

/** Written dates — never a price ("September 28 2026" ≠ $2026). */
const MONTHS_RE =
  'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec';
const WRITTEN_DATE_RE = new RegExp(
  `\\b(?:${MONTHS_RE})\\s+\\d{1,2}(?:st|nd|rd|th)?\\s*,?\\s*\\d{4}\\b`,
  'gi'
);

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
  // are phones — neither can match this shape. Phone-number and date runs
  // are stripped first so "416-555-0100" can never yield a $416 price and
  // "09/28/2026" can never yield a $2026 price. As a final guard, a bare
  // number in the year range 1900-2100 is never a price either.
  // The booking preview always asks for confirmation, so a wrong guess is
  // cheap and correctable.
  const bare = text
    .replace(PHONE_LIKE_RE, ' ')
    .replace(NUMERIC_DATE_RE, ' ')
    .replace(WRITTEN_DATE_RE, ' ')
    .match(/\b(\d{3,5})\b/);
  if (bare) {
    const v = Number(bare[1]);
    if (v >= 1900 && v <= 2100) return null;
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
    for (const k of s.keys) {
      if (k.length <= 2) {
        // Short keys ("ac", "tv") must match whole words — "McTestface"
        // contains "ac" but is not an air conditioner.
        if (new RegExp(`\\b${k}\\b`).test(text)) return s.title;
      } else if (text.includes(k)) {
        return s.title;
      }
    }
  }
  // No keyword matched — try to extract a custom title from the message.
  // E.g. "Book E2E3 Copilot Job for tomorrow" -> "E2E3 Copilot Job".
  // (extractCustomTitle is defined below, after NAME_STOPWORDS.)
  return extractCustomTitle(raw);
}

const NAME_STOPWORDS = new Set([
  // English fillers
  'job', 'repair', 'service', 'work', 'appointment', 'booking',
  'house', 'home', 'shop', 'office', 'place',
  'the', 'a', 'an', 'guy', 'man', 'woman', 'person', 'someone', 'anyone',
  'my', 'our', 'their', 'his', 'her',
  // Vague placeholders — never a real service ("schedule something" -> ask, don't invent "Something")
  'something', 'anything', 'thing', 'things', 'stuff',
  // French fillers
  'pour', 'chez', 'avec', 'sans', 'dans', 'sur', 'demain', 'aujourdhui',
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'mon', 'ma', 'mes', 'son', 'sa',
  'monsieur', 'madame', 'm', 'mme',
  // time words — so "for Priya tomorrow" doesn't become "Priya Tomorrow"
  'tomorrow', 'today', 'morning', 'evening', 'afternoon', 'night',
  'matin', 'soir', 'soiree', 'apres', 'midi', 'nuit',
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
  'dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi',
  // pronouns — so "schedule it for tomorrow" never books customer "It"
  'it', 'this', 'that', 'these', 'those', 'him', 'her', 'them', 'us', 'me', 'you', 'we', 'they', 'he', 'she',
  // prepositions / determiners — so "for Priya on 25 oct" doesn't become
  // "Priya On" and "for next Monday" doesn't become "Next"
  'on', 'at', 'in', 'into', 'by', 'from', 'with', 'a', 'au', 'aux', 'en', 'vers',
  'next', 'last', 'this',
  // question words — so "what's on my schedule tomorrow?" never yields "What"
  'what', 'when', 'where', 'which', 'who', 'whom', 'whose', 'why', 'how',
  'quoi', 'quand', 'qui', 'que', 'quel', 'quelle', 'quels', 'quelles',
  'comment', 'pourquoi', 'combien', 'est', 'ce', 'ces', 'ca',
  // conjunctions / cue words — never part of a name
  'and', 'et', 'or', 'ou', 'for', 'pour',
  // gerunds / trade nouns that are never a person's name
  'cleaning', 'painting', 'plumbing', 'wiring', 'roofing', 'mowing', 'entretien', 'reparation',
  // name-cue verbs — never part of a name ("named Testy" -> "Testy")
  'named', 'nomme', 'nommee', 'appele', 'appelle',
]);

/** Month names can never be a customer name ("book Sarah for dec 5"). */
for (const m of Object.keys(MONTHS)) NAME_STOPWORDS.add(m);

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

/** Booking verbs — never part of a customer name ("schedule Sarah's" -> "Sarah"). */
const BOOKING_VERBS = new Set([
  'schedule', 'scheduling', 'book', 'booking', 'booked', 'create', 'add',
  'plan', 'arrange', 'reserver', 'reserve', 'reservation', 'planifier',
  'planifie', 'ajouter', 'ajoute', 'creer', 'cree',
  'cancel', 'cancelled', 'delete', 'remove', 'annuler', 'annule', 'supprimer',
]);

/**
 * Extract a custom job title when no service keyword matches.
 * Only applies to clear booking intents (starts with book/schedule/etc).
 * Strips booking verbs, date/time expressions, and customer info,
 * returning the remaining meaningful text.
 * E.g. "Book E2E3 Copilot Job for tomorrow" -> "E2E3 Copilot Job".
 */
function extractCustomTitle(raw: string): string | null {
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  
  // Must start with a booking verb — otherwise it's not a job title request
  // (e.g. "A new customer named..." should return null, not a title)
  const verbMatch = trimmed.match(/^(book|schedule|create|add|make|set up|set|plan)\s+/i);
  if (!verbMatch) return null;
  
  // Guard: customer-creation intents ("Add a new customer named...") are not jobs
  if (/\b(customer|client)s?\b/i.test(trimmed)) return null;
  
  let text = trimmed.slice(verbMatch[0].length);
  
  // Remove trailing time expressions ("at 10am", "10:30 pm")
  text = text.replace(/\s+(at\s+)?\d{1,2}(:\d{2})?\s*(am|pm)\b.*$/i, '');
  // Remove date words wherever they trail ("tomorrow", "for Sarah tomorrow",
  // "E2E3 Copilot Job for tomorrow") — the preposition is optional so a
  // customer name between "for" and the date doesn't block the strip.
  text = text.replace(/\s+(for|on|at)?\s*(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|this week)\b.*$/i, '');
  
  // Remove "for [customer]" pattern at the end
  text = text.replace(/\s+for\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)?$/i, '');
  
  text = text.trim();
  
  // Must be meaningful (2+ chars, not just stopwords)
  if (text.length < 2) return null;
  const words = text.toLowerCase().split(/\s+/);
  const meaningful = words.filter(
    (w) => !NAME_STOPWORDS.has(w) && !/^\d+$/.test(w) && !/^\d+(st|nd|rd|th)$/.test(w)
  );
  if (meaningful.length === 0) return null;

  // Preserve user's capitalization (E2E3 stays E2E3); only title-case ALL-CAPS words
  return text.split(/\s+/).map(capitalizeWord).join(' ');
}

function capitalizeWord(w: string): string {
  // All-caps input is title-cased ("SARAH" -> "Sarah"); otherwise the user's
  // own capitalization is preserved ("McTestface" stays "McTestface").
  if (w === w.toUpperCase()) return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  return w.charAt(0).toUpperCase() + w.slice(1);
}

/**
 * Words that may legitimately follow a name in a "for <name> ..." capture
 * without invalidating it ("for Sarah tomorrow at 3pm" -> "Sarah").
 * Anything else mid-phrase ("for Nonexistent Person XYZ") means the capture
 * is unreliable and the whole name is rejected rather than truncated.
 */
const DATE_TIME_WORDS = new Set<string>([
  'today', 'tomorrow', 'morning', 'evening', 'afternoon', 'night',
  'matin', 'soir', 'soiree', 'apres', 'midi', 'nuit',
  'week', 'semaine', 'weekend', 'next', 'last', 'this',
  ...Object.keys(WEEKDAYS),
  ...Object.keys(MONTHS),
]);

/**
 * Turn raw captured words into a plausible name: drop trailing fillers
 * ("for Priya on 25 oct" -> "Priya"), keep the leading run of name-like
 * words ("for Sarah tomorrow at 3pm" -> "Sarah"), but reject the capture
 * when a non-date/time filler appears mid-phrase ("for Nonexistent Person
 * XYZ" -> null: booking under a half-guessed name is worse than asking).
 */
function leadingName(rawToks: string[]): string | null {
  const toks = rawToks.map((t) => t.trim()).filter((t) => t.length >= 2);
  while (toks.length > 1 && NAME_STOPWORDS.has(toks[toks.length - 1].toLowerCase())) {
    toks.pop();
  }
  const name: string[] = [];
  let i = 0;
  for (; i < toks.length; i++) {
    if (NAME_STOPWORDS.has(toks[i].toLowerCase())) break;
    name.push(toks[i]);
  }
  if (name.length === 0) return null;
  const remainder = toks.slice(i);
  if (
    remainder.length > 0 &&
    !remainder.every((t) => DATE_TIME_WORDS.has(t.toLowerCase()))
  ) {
    return null;
  }
  return name.map(capitalizeWord).join(' ');
}

/**
 * Guess a customer name from English/French booking text:
 *  - "for Sarah" / "for Martin Roy" / "pour Sarah Tremblay"
 *  - "named Testy McTestface" / "nommé Sarah Tremblay"
 *  - "schedule a Jon for 29th October" / "book Sarah for tomorrow" (name
 *    BEFORE the "for"/"pour" cue, anchored on a booking verb)
 *  - "customer: Liam" / "client: Sarah"
 *
 * Service/trade words ("plumbing", "plomberie", …) are stopwords and can
 * never be returned as a name. A name containing a filler word mid-phrase
 * (e.g. "Nonexistent Person XYZ") is rejected rather than truncated —
 * booking under a half-guessed name is worse than asking.
 */
export function extractCustomerName(raw: string): string | null {
  const text = raw.trim().replace(HONORIFIC_RE, ' ');

  // English "for Priya" / French "pour Sarah Tremblay" — up to three name
  // words. Trailing fillers are dropped and only the leading name-like run
  // is kept, so "for Priya on 25 oct" -> "Priya" and "for Sarah tomorrow
  // at 3pm" -> "Sarah".
  const mFor = text.match(
    /\b(?:for|pour)\s+([A-Za-z]{2,25}(?:\s+[A-Za-z]{2,25}){0,2})(?=[\s,]|$)/i
  );
  if (mFor) {
    const name = leadingName(mFor[1].split(/\s+/));
    if (name) return name;
  }

  // "named Testy McTestface" / "nommé Sarah Tremblay" / "s'appelle Jon".
  // The name-cue verbs are stopwords themselves, so a trailing "named"
  // never leaks into the result.
  const mNamed = text.match(
    /\b(?:named|nomme|nommee|appele|appelle|s\s*appelle)\s+([A-Za-z]{2,25}(?:\s+[A-Za-z]{2,25}){0,2})/i
  );
  if (mNamed) {
    const name = leadingName(mNamed[1].split(/\s+/));
    if (name) return name;
  }

  // Possessive: "schedule Sarah's AC repair for tomorrow" -> "Sarah".
  // A possessive almost always marks the customer; fillers ("tomorrow's",
  // "it's") are rejected by the stopword check.
  const mPoss = text.match(
    /\b([A-Za-z]{2,25}(?:\s+[A-Za-z]{2,25}){0,1})['\u2019]s\b/i
  );
  if (mPoss) {
    // A leading booking verb is not part of the name ("schedule Sarah's"
    // must yield "Sarah", never "Schedule Sarah").
    const rawToks = mPoss[1].split(/\s+/);
    while (rawToks.length > 1 && BOOKING_VERBS.has(rawToks[0].toLowerCase())) {
      rawToks.shift();
    }
    const name = leadingName(rawToks);
    if (name) return name;
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

  // "Add customer John Smith with phone +14165550123" / "Add customer
  // John Smith, phone 416-555-0123" — the name sits between "customer"
  // and a "with"/"phone"/number cue. The m2 pattern above can't handle the
  // "with phone +..." tail, so capture up to that cue explicitly.
  const m2b = text.match(
    /(?:customer|client)\s+([A-Za-z]{2,25}(?:\s+[A-Za-z]{2,25}){0,2})\s+(?:with\s+)?(?:phone|tel|telephone|mobile|cell)?\s*\+?[\d][\d\s\-.()]{5,17}/i
  );
  if (m2b) {
    const name = leadingName(m2b[1].split(/\s+/));
    if (name) return name;
  }

  // "schedule a Jon for 29th October" / "book Sarah for tomorrow" /
  // "book Sarah 4165551234 for tomorrow" / "planifier Jon pour demain" —
  // the name sits BEFORE the "for"/"pour" cue, anchored on a booking verb
  // so "looking for X" or "I need it for tomorrow" never match. An optional
  // phone chunk may sit between the name and "for". Tried after the
  // explicit patterns above: a "for <name>" always wins.
  const mForBefore = text.match(
    /\b(?:schedule|scheduling|book|booking|booked|create|add|plan|arrange|reserver|reserve|reservation|planifier|planifie|ajouter|ajoute|creer|cree)\s+(?:(?:a|an|the|un|une|le|la|les|des|du)\s+)?([A-Za-z]{2,25}(?:\s+[A-Za-z]{2,25}){0,1})(?:\s+\+?[\d][\d\s\-.()]{5,17})?\s+(?:for|pour)\b/i
  );
  if (mForBefore) {
    const name = leadingName(mForBefore[1].split(/\s+/));
    if (name) return name;
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

/**
 * Mass-destructive requests: "delete all my customers", "remove all jobs",
 * "cancel all invoices", etc. These get an explicit refusal, not the generic
 * unknown fallback. Matches a destruction verb + "all" (or equivalent).
 */
function isMassDestructive(text: string): boolean {
  const hasDestroyVerb = hasAny(text, [
    ' delete ', ' remove ', ' cancel ', ' destroy ', ' erase ', ' wipe ',
    ' supprimer ', ' supprime ', ' effacer ', ' annuler ',
  ]);
  if (!hasDestroyVerb) return false;
  return hasAny(text, [
    ' all ', ' every ', ' entire ',
    ' tout ', ' toute ', ' tous ', ' toutes ',
  ]);
}

/** Map free-text trade mentions to our certification roadmap trade keys. */
const TRADE_WORDS: Array<{ keys: string[]; trade: TradeKey }> = [
  { keys: ['plumber', 'plumbing', 'plombier', 'plomberie', 'pipefitter', 'tuyau'], trade: 'plumbing' },
  { keys: ['electrician', 'electricien', 'electrical', 'electricite'], trade: 'electrical' },
  { keys: ['hvac', 'furnace', 'fournaise', 'heat pump', 'thermopompe', 'clim'], trade: 'hvac' },
  { keys: ['carpenter', 'carpentry', 'menuisier', 'ebeniste'], trade: 'carpentry' },
  { keys: ['painter', 'painting', 'peintre', 'peinture'], trade: 'painting' },
  { keys: ['landscap', 'paysagiste', 'lawn', 'gazon'], trade: 'landscaping' },
  { keys: ['cleaner', 'cleaning', 'nettoyage', 'menage'], trade: 'cleaning' },
  { keys: ['renovat'], trade: 'renovation' },
];

export function detectTrade(raw: string): TradeKey | null {
  const text = ' ' + norm(raw) + ' ';
  for (const t of TRADE_WORDS) {
    if (t.keys.some((k) => text.includes(k))) return t.trade;
  }
  return null;
}

/** Map free-text province mentions to two-letter CA province codes. */
const PROVINCE_WORDS: Array<{ keys: string[]; code: string }> = [
  { keys: ['ontario', 'ontarien'], code: 'ON' },
  { keys: ['quebec', 'quebecois'], code: 'QC' },
  { keys: ['british columbia', 'colombie britannique'], code: 'BC' },
  { keys: ['alberta', 'albertain'], code: 'AB' },
  { keys: ['saskatchewan'], code: 'SK' },
  { keys: ['manitoba'], code: 'MB' },
  { keys: ['nova scotia', 'nouvelle ecosse'], code: 'NS' },
  { keys: ['new brunswick', 'nouveau brunswick'], code: 'NB' },
  { keys: ['newfoundland', 'terre neuve', 'labrador'], code: 'NL' },
  { keys: ['prince edward', 'ile du prince'], code: 'PE' },
];

export function detectProvince(raw: string): string | null {
  const text = ' ' + norm(raw) + ' ';
  for (const p of PROVINCE_WORDS) {
    if (p.keys.some((k) => text.includes(k))) return p.code;
  }
  return null;
}

/**
 * Explicit customer-creation language ("add a new customer", "ajouter un
 * client") — must NEVER be treated as a job booking.
 */
const CREATE_CUSTOMER_RES = [
  /\badd\s+(?:(?:a|an|new)\s+)*customers?\b/,
  /\bcreate\s+(?:(?:a|new)\s+)*customers?\b/,
  /\bnew\s+customers?\b/,
  /\bajouter\s+(?:(?:un|une|nouveau|nouvelle)\s+)*clients?\b/,
  /\bcreer\s+(?:un\s+)?clients?\b/,
  /\bnouveau\s+clients?\b/,
  /\bnouvelle\s+cliente\b/,
];

/** Words that mark a question as being about the business's own domain. */
const DOMAIN_WORDS = [
  ' customer ', ' customers ', ' client ', ' clients ', ' clientele ',
  ' job ', ' jobs ', ' travail ', ' tache ', ' taches ',
  ' schedule ', ' horaire ', ' appointment ', ' rendez vous ',
  ' invoice ', ' invoices ', ' facture ', ' factures ',
  ' quote ', ' quotes ', ' devis ', ' soumission ', ' soumissions ',
  ' payment ', ' payments ', ' paiement ', ' paiements ',
  ' revenue ', ' revenu ', ' revenus ', ' earning ', ' earnings ', ' money ', ' argent ',
  ' reminder ', ' rappel ', ' booking ', ' bookings ', ' reservation ',
  ' business ', ' entreprise ', ' affaires ',
  ' certification ', ' licence ', ' license ', ' compare ', ' average ', ' benchmark ',
];

/** True when the message is a question about something the copilot covers. */
function hasDomainWords(raw: string): boolean {
  const text = ' ' + norm(raw) + ' ';
  if (DOMAIN_WORDS.some((w) => text.includes(w))) return true;
  if (extractServiceTitle(raw) !== null) return true;
  if (extractDate(raw) !== null || extractTime(raw) !== null) return true;
  return false;
}

/**
 * Extract a simple arithmetic expression: "149.99 + 19.99", "what is 5*3?",
 * "100-25". Returns { a, op, b } or null. Only handles a single binary
 * operation on two numbers (safe — no eval).
 */
export function extractArithmetic(raw: string): { a: number; op: string; b: number } | null {
  // Strip common question prefixes so "what is 149.99 + 19.99?" works.
  const text = raw
    .replace(/^(what is|what's|calculate|compute|how much is|combien (fait|font))\s+/i, '')
    .replace(/[×]/g, '*')
    .replace(/÷/g, '/')
    // "100 times 1.13" / "100 multiplied by 1.13" -> "100 * 1.13"
    .replace(/\s+(times|multiplied\s+by|x)\s+/gi, ' * ')
    .replace(/,/g, '')
    .trim()
    .replace(/[?.!]+$/, '')
    .trim();
  // Percentage: "10% of 500" / "10 percent of 500" -> 10 * 500 / 100.
  // Must run before the binary-op match below.
  const pct = text.match(/^(-?\d+(?:\.\d+)?)\s*%\s*(?:of|de)\s*(-?\d+(?:\.\d+)?)$/i)
    ?? text.match(/^(-?\d+(?:\.\d+)?)\s*percent\s*(?:of|de)\s*(-?\d+(?:\.\d+)?)$/i);
  if (pct) {
    const a = Number(pct[1]);
    const b = Number(pct[2]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    // Represent as a * (b / 100) so the reply reads "10 % of 500 = 50".
    return { a, op: '%of', b };
  }
  // The remaining text must be JUST the expression (prevents "2026-09-30"
  // or "book for 5-6 people" from matching).
  const m = text.match(/^(-?\d+(?:\.\d+)?)\s*([+\-*/])\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[3]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (m[2] === '/' && b === 0) return null;
  return { a, op: m[2], b };
}

/** Safely compute a binary arithmetic operation. */
export function computeArithmetic(a: number, op: string, b: number): number | null {
  let result: number;
  switch (op) {
    case '+': result = a + b; break;
    case '-': result = a - b; break;
    case '*': result = a * b; break;
    case '/': result = b !== 0 ? a / b : NaN; break;
    case '%of': result = (a / 100) * b; break;
    default: return null;
  }
  if (!Number.isFinite(result)) return null;
  // Round to 2 decimal places to avoid float artifacts (0.1+0.2=0.30000000000000004)
  return Math.round(result * 100) / 100;
}

/**
 * Detect an impossible calendar date in the message, e.g. "February 30",
 * "31 April". Returns the matched date string (e.g. "February 30") or null.
 * JavaScript's Date silently rolls these over (Feb 30 → Mar 2), so we must
 * flag them instead of booking the wrong day.
 */
export function extractInvalidDate(raw: string): string | null {
  const text = norm(raw);
  // Month-first: "february 30", "feb 31"
  const md = text.match(
    /\b(jan|january|janvier|feb|february|fevrier|fev|mar|march|mars|apr|april|avril|avr|may|mai|jun|june|juin|jul|july|juillet|juil|aug|august|aout|sep|sept|september|septembre|oct|october|octobre|nov|november|novembre|dec|december|decembre)\s*(\d{1,2})(?:st|nd|rd|th)?\b/
  );
  // Day-first: "30 february", "31st april"
  const dm =
    md === null
      ? text.match(
          /\b(\d{1,2})(?:st|nd|rd|th)?\s*(jan|january|janvier|feb|february|fevrier|fev|mar|march|mars|apr|april|avril|avr|may|mai|jun|june|juin|jul|july|juillet|juil|aug|august|aout|sep|sept|september|septembre|oct|october|octobre|nov|november|novembre|dec|december|decembre)\b/
        )
      : null;
  const m = md ?? dm;
  if (!m) return null;
  const monthName = md ? m[1] : m[2];
  const day = Number(md ? m[2] : m[1]);
  const month = MONTHS[monthName];
  if (month === undefined || !Number.isFinite(day)) return null;
  // Days in month (use a leap year for February so Feb 29 is allowed;
  // the engine can refine with the actual year if needed).
  const daysInMonth = new Date(2024, month + 1, 0).getDate();
  if (day < 1 || day > daysInMonth) {
    return m[0].trim();
  }
  return null;
}

export function detectIntent(raw: string, followUpName: string | null = null): CopilotIntent {
  const text = ' ' + norm(raw) + ' ';

  // Mass-destructive requests ("delete all my customers", "cancel all jobs")
  // get an explicit refusal — never the generic "didn't catch that".
  if (isMassDestructive(text)) return 'refuse_destructive';

  // Explicit cancellation — the copilot has no cancel capability, so a
  // cancellation must NEVER book and must not masquerade as a schedule
  // query either ("cancel tomorrow's job" contains "tomorrow"). Ask.
  if (isCancellation(text)) return 'unknown';

  // A message LED by a booking verb ("Book ...", "Schedule ...", "Planifie ...")
  // is a booking command, not a question — even if the job title contains the
  // word "check" (e.g. "Book schedule check for Alice tomorrow", 2026-09-28 QA).
  // The "check" question-word only applies when no booking verb leads.
  const startsWithBookingVerb =
    /^\s*(book|booked|booking|schedule|scheduling|create|add|plan|arrange|reserver|reserve|reservation|planifier|planifie|ajouter|ajoute|creer|cree)\b/i.test(
      raw
    );
  const isQuestion =
    /[?]/.test(raw) ||
    (!startsWithBookingVerb &&
      hasAny(text, [
        ' how much ',
        ' how many ',
        ' what ',
        ' when ',
        ' show ',
        ' list ',
        ' check ',
        ' combien ',
        ' quand ',
        ' quoi ',
        ' qui ',
        ' montre ',
        ' montre moi ',
        ' affiche ',
        ' afficher ',
        ' liste ',
      ]));

  // 0. Customer creation — BEFORE job creation, so "add a new customer"
  //    is never misread as a booking. Explicit creation language only.
  if (CREATE_CUSTOMER_RES.some((re) => re.test(norm(raw)))) {
    return 'create_customer';
  }

  // 0b. Invoice/quote creation — the copilot cannot create invoices or
  // quotes, so "create an invoice for $500" must NOT become a job preview
  // with invented service "An Invoice For $500" (2026-09-30 QA). Guide to
  // the right page instead.
  if (
    hasAny(text, [' invoice ', ' invoices ', ' facture ', ' factures ']) &&
    hasAny(text, [' create ', ' make ', ' new ', ' creer ', ' cree ', ' nouveau ', ' nouvelle '])
  ) {
    return 'out_of_scope';
  }
  if (
    hasAny(text, [' quote ', ' quotes ', ' devis ', ' soumission ', ' soumissions ']) &&
    hasAny(text, [' create ', ' make ', ' new ', ' creer ', ' cree ', ' nouveau ', ' nouvelle '])
  ) {
    return 'out_of_scope';
  }

  // 1. Payment reminder drafting
  if (hasAny(text, [' reminder ', ' remind ', ' payment reminder ', ' rappel ', ' rappelle ', ' rappeler ', ' relance '])) {
    return 'draft_reminder';
  }

  // 2. Revenue questions — "booked revenue" is its own metric (scheduled
  //    job value, excluding cancelled) distinct from cash collections.
  if (hasAny(text, [' revenue ', ' earning ', ' earnings ', ' earn ', ' earned ', ' income ', ' collection ', ' revenu ', ' revenus ', ' gains ', ' chiffre '])) {
    if (hasAny(text, [' booked ', ' reserve ', ' scheduled ', ' planifie '])) {
      return 'ask_booked_revenue';
    }
    return 'ask_revenue';
  }

  // 3. Unpaid / outstanding questions (masculine + feminine French forms)
  if (hasAny(text, [' unpaid ', ' outstanding ', ' pending payment ', ' dues ', ' impaye ', ' impayee ', ' impayes ', ' impayees ', ' non paye ', ' en retard '])) {
    return 'ask_unpaid';
  }

  // 3b. Certification / career-credential questions — answered from the
  // real certification roadmap (official programs only, never invented).
  if (hasAny(text, [
    ' certification ', ' certifications ', ' certify ', ' certified ', ' certifie ',
    ' licence ', ' license ', ' licensed ', ' permis ',
    ' red seal ', ' sceau rouge ',
    ' apprenticeship ', ' apprentissage ', ' apprentice ',
    ' ticket ', ' journeyman ', ' compagnon ',
    ' qualification ', ' credential ', ' designation ',
    ' cmmtq ', ' rbq ',
  ])) {
    return 'ask_certification';
  }

  // 3c. "How do I compare?" — answered honestly: no real peer data exists
  // yet, so offer clearly-labelled best-practice benchmarks instead.
  if (hasAny(text, [
    ' compare ', ' comparison ', ' comparaison ', ' comparer ',
    ' average ', ' moyenne ', ' benchmark ',
    ' other businesses ', ' autres entreprises ',
    ' how am i doing ', ' how is my business ',
  ])) {
    return 'ask_compare';
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
  // Bare "job" / "travail" as the booking noun ("job on 1st jan for Sarah",
  // "job for Sarah at 9:30 am", "travail pour Sarah demain"): with a customer
  // or a date and no question, this is a booking preview, not a query.
  // Cancellations are already excluded above; plural "jobs" stays a schedule
  // query ("jobs tomorrow" -> ask_schedule, unchanged).
  const hasJobNoun = hasAny(text, [' job ', ' travail ']);
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
      (hasService && hasWhen && !isQuestion) ||
      // "job on 1st jan for Sarah" — the bare job noun + a customer or a date
      // (time-only counts via the engine's "used today" date note) is a
      // booking preview with confirmation, never a silent guess.
      (hasJobNoun && (hasWho || hasWhen) && !isQuestion))
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

  // 7b. Simple arithmetic — "what is 149.99 + 19.99?", "100 - 25", "5*3".
  // A money-savvy assistant should handle basic math, not refuse it.
  if (extractArithmetic(raw) !== null) {
    return 'calculate';
  }

  // Default: a question about the business domain with no recognized
  // intent gets the schedule overview (previous behaviour); a question
  // about anything else gets an honest out-of-scope boundary instead of
  // an irrelevant jobs dump. Non-questions stay unknown (clarify).
  if (isQuestion) return hasDomainWords(raw) ? 'ask_schedule' : 'out_of_scope';
  return 'unknown';
}
