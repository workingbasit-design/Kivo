/**
 * "Get it done for me" concierge — pure logic (no DB, no network).
 *
 * The customer describes a job in plain language. We interpret the service
 * need with a deterministic keyword scan (no LLM, no external calls, $0),
 * match opted-in verified pros via findDirectoryMatches, show an exact
 * preview, and send only on the customer's explicit tap.
 *
 * Safety properties:
 * - Interpretation is keyword-based and explainable; unknown descriptions
 *   fall back to a generic label and still match by keyword.
 * - The exact message text is built once and shown in the preview; the send
 *   step transmits exactly that text — nothing is rewritten server-side.
 * - No SMS / WhatsApp / email is ever sent by this flow; requests land in
 *   EveryJob's internal inbox (QuoteRequest + Lead) only.
 */

export const CONCIERGE_MAX_PROS = 3;

/** Rate limit for concierge sends: 5 per customer per hour. */
export const CONCIERGE_RATE_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 };

export type ConciergeLocale = 'en' | 'fr';

type ServiceHint = {
  key: string;
  en: string;
  fr: string;
  keywords: string[];
};

/**
 * Keyword → service mapping. Keywords cover EN and FR spellings so a
 * French description ("mon robinet fuit") resolves the same way.
 * Order matters: first matching hint wins.
 */
const SERVICE_HINTS: ServiceHint[] = [
  {
    key: 'plumbing',
    en: 'Plumbing',
    fr: 'Plomberie',
    keywords: [
      'plumb', 'faucet', 'robinet', 'leak', 'fuit', 'fuite', 'drip', 'pipe', 'tuyau',
      'toilet', 'toilette', 'drain', 'clog', 'bouché', 'bouchon', 'water heater',
      'chauffe-eau', 'sink', 'évier', 'shower', 'douche',
    ],
  },
  {
    key: 'electrical',
    en: 'Electrical',
    fr: 'Électricité',
    keywords: [
      'electr', 'électr', 'wire', 'fil', 'outlet', 'prise', 'breaker', 'disjoncteur',
      'light', 'lumière', 'lamp', 'switch', 'interrupteur', 'panel', 'panneau',
    ],
  },
  {
    key: 'hvac',
    en: 'Heating & Cooling',
    fr: 'Chauffage et climatisation',
    keywords: [
      'hvac', 'furnace', 'fournaise', 'heater', 'chauffage', 'ac ', 'climatiseur',
      'climatisation', 'thermostat', 'heat pump', 'thermopompe', 'ventilation',
    ],
  },
  {
    key: 'cleaning',
    en: 'Cleaning',
    fr: 'Ménage',
    keywords: [
      'clean', 'nettoy', 'ménage', 'menage', 'maid', 'femme de ménage', 'dust',
      'poussière', 'move-out', 'déménagement',
    ],
  },
  {
    key: 'painting',
    en: 'Painting',
    fr: 'Peinture',
    keywords: ['paint', 'peint', 'wall', 'mur', 'ceiling', 'plafond', 'drywall', 'gypse'],
  },
  {
    key: 'landscaping',
    en: 'Landscaping',
    fr: 'Aménagement paysager',
    keywords: [
      'lawn', 'pelouse', 'gazon', 'garden', 'jardin', 'landscap', 'paysager',
      'snow', 'neige', 'déneig', 'mow', 'tondre', 'tree', 'arbre', 'hedge', 'haie',
    ],
  },
  {
    key: 'appliance',
    en: 'Appliance repair',
    fr: 'Réparation d’électroménagers',
    keywords: [
      'appliance', 'électroménager', 'electromenager', 'fridge', 'frigo',
      'réfrigérateur', 'stove', 'cuisinière', 'dishwasher', 'lave-vaisselle',
      'washer', 'laveuse', 'dryer', 'sécheuse', 'oven', 'four',
    ],
  },
  {
    key: 'carpentry',
    en: 'Carpentry',
    fr: 'Menuiserie',
    keywords: [
      'carpent', 'menuis', 'wood', 'bois', 'deck', 'terrasse', 'fence', 'clôture',
      'door', 'porte', 'cabinet', 'armoire',
    ],
  },
  {
    key: 'roofing',
    en: 'Roofing',
    fr: 'Toiture',
    keywords: ['roof', 'toit', 'toiture', 'shingle', 'bardeau', 'gutter', 'gouttière'],
  },
  {
    key: 'pest',
    en: 'Pest control',
    fr: 'Extermination',
    keywords: [
      'pest', 'parasite', 'extermin', 'mouse', 'souris', 'rat', 'ant', 'fourmi',
      'bed bug', 'punaise', 'wasp', 'guêpe',
    ],
  },
];

export type InterpretedNeed = {
  /** Stable key for matching; 'general' when nothing matched. */
  key: string;
  /** Human-readable service label in the customer's locale. */
  label: string;
  /** The raw keyword used for directory matching (label or key). */
  matchKeyword: string;
};

/**
 * Interpret a plain-language job description into a service need.
 * Deterministic keyword scan — explainable, no external calls.
 */
export function interpretServiceNeed(
  description: string,
  locale: ConciergeLocale = 'en'
): InterpretedNeed {
  const hay = ` ${description.toLowerCase().normalize('NFC')} `;
  for (const hint of SERVICE_HINTS) {
    if (hint.keywords.some((k) => hay.includes(k))) {
      return {
        key: hint.key,
        label: locale === 'fr' ? hint.fr : hint.en,
        matchKeyword: locale === 'fr' ? hint.fr : hint.en,
      };
    }
  }
  return {
    key: 'general',
    label: locale === 'fr' ? 'Service à domicile' : 'Home service',
    matchKeyword: description.trim().slice(0, 60),
  };
}

/** Keywords for a trade key — used for directory matching. Empty for unknown keys. */
export function serviceHintKeywords(key: string): string[] {
  return SERVICE_HINTS.find((h) => h.key === key)?.keywords ?? [];
}

export type ConciergeMessageInput = {
  serviceLabel: string;
  description: string;
  name: string;
  phone: string;
  city: string;
  locale: ConciergeLocale;
};

/**
 * Build the EXACT message the customer previews and that gets sent.
 * One builder, used by both the preview and the send step, so what the
 * customer approves is byte-for-byte what the pro receives.
 */
export function buildConciergeMessage(input: ConciergeMessageInput): string {
  const { serviceLabel, description, name, phone, city, locale } = input;
  const desc = description.trim();
  if (locale === 'fr') {
    return [
      `Demande de devis — ${serviceLabel}`,
      '',
      desc,
      '',
      `Nom : ${name.trim()}`,
      `Téléphone : ${phone.trim()}`,
      `Ville : ${city.trim()}`,
      '',
      'Envoyé via EveryJob — répondez dans l’application si ce travail vous intéresse.',
    ].join('\n');
  }
  return [
    `Quote request — ${serviceLabel}`,
    '',
    desc,
    '',
    `Name: ${name.trim()}`,
    `Phone: ${phone.trim()}`,
    `City: ${city.trim()}`,
    '',
    'Sent via EveryJob — reply in the app if you want this job.',
  ].join('\n');
}

/** Idempotency keys are client-generated UUIDs, max 128 chars. */
export function isValidIdempotencyKey(key: string): boolean {
  return (
    typeof key === 'string' &&
    key.length >= 8 &&
    key.length <= 128 &&
    /^[A-Za-z0-9_-]+$/.test(key)
  );
}
