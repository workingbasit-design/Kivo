/**
 * Reminder queue + missed-call text-back + booking availability: pure,
 * testable helpers. No DB, no network, no Next.js imports — safe for
 * node:test (see src/lib/__tests__/reminders.test.mts).
 *
 * HARD RULE, restated: EveryJob NEVER sends a message automatically.
 * These helpers only build draft text and deep links (wa.me / sms: /
 * mailto:) that the business owner taps and sends from their own apps.
 */

import { parseTimeToMinutes } from './routes.ts';
import { parseWorkingHours, type DayKey } from './working-hours.ts';

export type Locale = 'en' | 'fr';

/* ------------------------------------------------------------------ */
/* Phone normalization + one-tap links                                  */
/* ------------------------------------------------------------------ */

/** Default country calling code — Canada-only (NANP). */
export const DEFAULT_COUNTRY_CODE = '1';

/**
 * Normalize a phone number to wa.me digits: strip every non-digit; when the
 * result is a 10-digit local (NANP) number, prepend the country code "1".
 */
export function normalizeWaDigits(phone: string | null | undefined): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length === 10 && !digits.startsWith(DEFAULT_COUNTRY_CODE)) {
    return DEFAULT_COUNTRY_CODE + digits;
  }
  return digits;
}

/**
 * WhatsApp click-to-chat deep link with a prefilled message.
 * Empty string when there is no usable phone number.
 */
export function waChatLink(
  phone: string | null | undefined,
  message: string
): string {
  const digits = normalizeWaDigits(phone);
  if (!digits) return '';
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/**
 * SMS draft link using the cross-platform `?&body=` form: iOS reads
 * `sms:<n>&body=…`, Android reads `sms:<n>?body=…`, and `?&` satisfies both.
 * Empty string when there is no usable phone number.
 */
export function smsDraftLink(
  phone: string | null | undefined,
  body: string
): string {
  const digits = normalizeWaDigits(phone);
  if (!digits) return '';
  return `sms:${digits}?&body=${encodeURIComponent(body)}`;
}

/** mailto: draft link. Empty string when there is no email address. */
export function mailtoDraftLink(
  email: string | null | undefined,
  subject: string,
  body: string
): string {
  const addr = (email ?? '').trim();
  if (!addr) return '';
  return `mailto:${encodeURIComponent(addr)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/* ------------------------------------------------------------------ */
/* Time formatting                                                      */
/* ------------------------------------------------------------------ */

/** "09:30" -> minutes since midnight. */
export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** minutes since midnight -> "HH:MM" (24h, zero-padded). */
export function minutesToHhmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** "09:30" -> "9:30 AM" (en) or "9 h 30" (fr, Canadian style). */
export function formatSlotLabel(hhmm: string, locale: Locale): string {
  const [h, m] = hhmm.split(':').map(Number);
  const mm = String(m).padStart(2, '0');
  if (locale === 'fr') return `${h} h ${mm}`;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mm} ${suffix}`;
}

const EN_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const EN_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FR_MONTHS = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
];
const FR_DAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

/**
 * Human "when" label for a draft, e.g. "Thu, Sep 24 at 10:00 AM"
 * or "jeu. 24 sept. à 10 h 00". Falls back to the date alone when the
 * stored time isn't a parseable clock time (legacy free-text times).
 */
export function formatWhenLabel(
  date: Date,
  time: string | null | undefined,
  locale: Locale
): string {
  const d = new Date(date);
  const dayIdx = d.getDay();
  const datePart =
    locale === 'fr'
      ? `${FR_DAYS[dayIdx]} ${d.getDate()} ${FR_MONTHS[d.getMonth()]}`
      : `${EN_DAYS[dayIdx]}, ${EN_MONTHS[d.getMonth()]} ${d.getDate()}`;
  const mins = parseTimeToMinutes(time ?? null);
  if (mins === null) return datePart;
  const clock = formatSlotLabel(minutesToHhmm(mins), locale);
  return locale === 'fr' ? `${datePart} à ${clock}` : `${datePart} at ${clock}`;
}

/* ------------------------------------------------------------------ */
/* Draft text builders (bilingual)                                      */
/* ------------------------------------------------------------------ */

export interface JobReminderInput {
  locale: Locale;
  businessName: string;
  customerName: string;
  jobTitle: string;
  whenLabel: string;
}

/** Polite job-reminder draft the owner sends themselves. */
export function buildJobReminderDraft({
  locale,
  businessName,
  customerName,
  jobTitle,
  whenLabel,
}: JobReminderInput): string {
  if (locale === 'fr') {
    return (
      `Bonjour ${customerName}, petit rappel de ${businessName} : ` +
      `votre « ${jobTitle} » est prévu ${whenLabel}. ` +
      `Répondez à ce message si vous devez reporter le rendez-vous. Merci!`
    );
  }
  return (
    `Hi ${customerName}, this is a friendly reminder from ${businessName}: ` +
    `your "${jobTitle}" is scheduled for ${whenLabel}. ` +
    `Reply to this message if you need to reschedule. Thank you!`
  );
}

export interface InvoiceFollowupInput {
  locale: Locale;
  businessName: string;
  customerName: string;
  invoiceNumber: string;
  amountLabel: string;
  /** Interac e-Transfer email; when set, the draft mentions it (text only). */
  interacEmail?: string | null;
}

/** Polite invoice follow-up draft the owner sends themselves. */
export function buildInvoiceFollowupDraft({
  locale,
  businessName,
  customerName,
  invoiceNumber,
  amountLabel,
  interacEmail,
}: InvoiceFollowupInput): string {
  const interac =
    interacEmail && interacEmail.trim()
      ? locale === 'fr'
        ? ` Vous pouvez payer par Virement Interac à ${interacEmail.trim()}.`
        : ` You can pay by Interac e-Transfer to ${interacEmail.trim()}.`
      : '';
  if (locale === 'fr') {
    return (
      `Bonjour ${customerName}, petit rappel de ${businessName} : ` +
      `la facture ${invoiceNumber} de ${amountLabel} est toujours impayée.${interac} Merci!`
    );
  }
  return (
    `Hi ${customerName}, this is a gentle reminder from ${businessName} ` +
    `that invoice ${invoiceNumber} for ${amountLabel} is still pending.${interac} ` +
    `Thank you!`
  );
}

export interface MissedCallInput {
  locale: Locale;
  businessName: string;
  customerName: string;
}

/**
 * Manual "sorry I missed your call" text-back draft. This is a quick-draft
 * the owner sends themselves — EveryJob has no telephony integration and
 * detects nothing automatically.
 */
export function buildMissedCallDraft({
  locale,
  businessName,
  customerName,
}: MissedCallInput): string {
  if (locale === 'fr') {
    return (
      `Bonjour ${customerName}, désolé d'avoir manqué votre appel — ` +
      `ici ${businessName}. Comment puis-je vous aider?`
    );
  }
  return (
    `Hi ${customerName}, sorry I missed your call — this is ${businessName}. ` +
    `How can I help?`
  );
}

/* ------------------------------------------------------------------ */
/* Booking slot availability                                            */
/* ------------------------------------------------------------------ */

export const SLOT_MINUTES = 30;
/** Assumed length of an existing job when checking slot overlap. */
export const DEFAULT_JOB_MINUTES = 60;

export interface DaySlot {
  /** "HH:MM" 24h start. */
  start: string;
  /** "HH:MM" 24h end. */
  end: string;
  startMinutes: number;
  endMinutes: number;
}

export type SlotGeneration =
  | { closed: true; hoursNotSet: false }
  | { closed: false; hoursNotSet: true }
  | { closed: false; hoursNotSet: false; slots: DaySlot[] };

/**
 * Generate bookable slots for a calendar day from the business's working
 * hours. `dateStr` is "YYYY-MM-DD" (business-local).
 *
 * - `closed` when the business is shut that weekday.
 * - `hoursNotSet` when working hours were never configured (the caller can
 *   fall back to a date-only request instead of blocking booking).
 */
export function generateDaySlots(
  workingHoursJson: string | null | undefined,
  dateStr: string,
  slotMinutes: number = SLOT_MINUTES
): SlotGeneration {
  const hours = parseWorkingHours(workingHoursJson);
  if (!hours) return { closed: false, hoursNotSet: true };

  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return { closed: false, hoursNotSet: true };
  const date = new Date(y, m - 1, d);
  const key = (['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const)[date.getDay()] as DayKey;
  const dayHours = hours[key];
  if (!dayHours) return { closed: true, hoursNotSet: false };

  const open = hhmmToMinutes(dayHours[0]);
  const close = hhmmToMinutes(dayHours[1]);
  const slots: DaySlot[] = [];
  for (let s = open; s + slotMinutes <= close; s += slotMinutes) {
    slots.push({
      start: minutesToHhmm(s),
      end: minutesToHhmm(s + slotMinutes),
      startMinutes: s,
      endMinutes: s + slotMinutes,
    });
  }
  return { closed: false, hoursNotSet: false, slots };
}

export interface ExistingBooking {
  /** Parsed start minutes, or null when the job has no parseable time. */
  startMinutes: number | null;
  durationMinutes?: number;
}

export interface SlotWithAvailability extends DaySlot {
  available: boolean;
}

/**
 * Mark slots unavailable when they overlap an existing job. A job occupies
 * [start, start + duration). Jobs without a parseable time don't block any
 * specific slot — they're counted so the UI can note the uncertainty.
 */
export function computeSlotAvailability(
  slots: DaySlot[],
  bookings: ExistingBooking[]
): { slots: SlotWithAvailability[]; unscheduledCount: number } {
  const busy: { startMinutes: number; durationMinutes?: number }[] = [];
  let unscheduledCount = 0;
  for (const b of bookings) {
    if (b.startMinutes === null) {
      unscheduledCount++;
    } else {
      busy.push({ startMinutes: b.startMinutes, durationMinutes: b.durationMinutes });
    }
  }
  const withAvailability = slots.map((slot) => {
    const overlaps = busy.some((b) => {
      const dur = b.durationMinutes ?? DEFAULT_JOB_MINUTES;
      const jobStart = b.startMinutes;
      const jobEnd = jobStart + dur;
      return slot.startMinutes < jobEnd && jobStart < slot.endMinutes;
    });
    return { ...slot, available: !overlaps };
  });
  return { slots: withAvailability, unscheduledCount };
}

/**
 * Server-side check used at booking confirm time: is the requested slot
 * ("HH:MM") still free given the day's existing jobs? Rejects unknown or
 * overlapping times so a stale/double-submitted form can't double-book.
 */
export function isSlotStillAvailable(
  requestedStart: string,
  slots: SlotWithAvailability[]
): boolean {
  const slot = slots.find((s) => s.start === requestedStart);
  return slot?.available === true;
}

/** Day key ("mon".."sun") for a "YYYY-MM-DD" date. Exported for tests. */
export function dayKeyForDate(dateStr: string): DayKey | null {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return (['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const)[date.getDay()] as DayKey;
}
