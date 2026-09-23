/**
 * Track 9 — CASL consent guardrails and inbound STOP/HELP detection.
 *
 * Pure, testable TypeScript: no DB, no network, no Next.js imports.
 * Under CASL, express consent is required for commercial electronic
 * messages; these helpers decide whether a message may be sent and
 * whether an inbound reply is an opt-out (STOP) or help request.
 */

export type MessageChannel = 'WHATSAPP' | 'EMAIL';

/**
 * True ONLY when consent === true AND a contact address exists.
 * A null/undefined consent is treated as no consent (fail closed).
 */
export function canSendMessage(opts: {
  consent: boolean | null | undefined;
  channel: MessageChannel;
  hasContact: boolean;
}): boolean {
  return opts.consent === true && opts.hasContact === true;
}

/**
 * Lowercase, trim, strip accents/diacritics, collapse inner whitespace.
 */
export function normalizeInboundText(text: string | null | undefined): string {
  if (text === null || text === undefined) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Maximum length (chars) of a message that may carry an embedded
 * keyword. Keeps long conversational replies from false-positiving
 * on words like "stop".
 */
const SHORT_MESSAGE_MAX = 30;

/**
 * Match a normalized keyword list: exact match, or the keyword found
 * on a word boundary inside a short message (<30 chars).
 */
function matchesKeywords(text: string, keywords: string[]): boolean {
  if (text === '') return false;
  // Hyphens/underscores become spaces so "opt-out" matches "opt out".
  const work = text.replace(/[-_]+/g, ' ');
  for (const keyword of keywords) {
    if (work === keyword) return true;
    if (work.length < SHORT_MESSAGE_MAX) {
      const pattern = new RegExp(
        `(^|[^a-z])${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`
      );
      if (pattern.test(work)) return true;
    }
  }
  return false;
}

const STOP_KEYWORDS = [
  'stop',
  'stoppe',
  'stopper',
  'arrete', // arrête
  'arret', // arrêt
  'arreter', // arrêter
  'unsubscribe',
  'unsub',
  'opt out',
  'ne plus',
  'desinscrire', // désinscrire
  'retirer',
  'ne veux plus',
];

/**
 * True when the reply is an opt-out: the keyword alone, or embedded
 * in a short message (<30 chars) to avoid false positives in long
 * conversational replies.
 */
export function isStopText(text: string | null | undefined): boolean {
  return matchesKeywords(normalizeInboundText(text), STOP_KEYWORDS);
}

const HELP_KEYWORDS = [
  'help',
  'aide',
  'aidez moi', // aidez-moi
  'info',
  'infos',
  'heures',
  'hours',
];

/**
 * True when the reply is a help request (incl. business-hours
 * questions): the keyword alone, or embedded in a short message
 * (<30 chars).
 */
export function isHelpText(text: string | null | undefined): boolean {
  return matchesKeywords(normalizeInboundText(text), HELP_KEYWORDS);
}
