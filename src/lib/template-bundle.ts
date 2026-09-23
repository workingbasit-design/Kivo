/**
 * Checklist-template "bundle" fields: each template can carry an optional
 * default price, duration (minutes) and notes, turning it into a reusable
 * service bundle that pre-fills the new-job form.
 *
 * Pure functions — no I/O, safe to import from server actions and node:test.
 */

/** Optional bundle fields stored on ChecklistTemplate. */
export interface TemplateBundleFields {
  price: number | null;
  durationMin: number | null;
  notes: string | null;
}

export type BundleParseResult =
  | { ok: true; data: TemplateBundleFields }
  | { ok: false; errorEn: string; errorFr: string };

const MAX_PRICE = 10_000_000;
const MAX_NOTES = 2000;

/** Parse an optional price input: blank -> null, else a number >= 0. */
export function parseOptionalPrice(raw: unknown): BundleParseResult {
  const s = String(raw ?? '').trim();
  if (s === '') return { ok: true, data: { price: null, durationMin: null, notes: null } };
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || n > MAX_PRICE) {
    return {
      ok: false,
      errorEn: `Enter a valid price (0 or more, up to $${MAX_PRICE.toLocaleString('en-CA')}).`,
      errorFr: `Entrez un prix valide (0 ou plus, jusqu'à ${MAX_PRICE.toLocaleString('fr-CA')} $).`,
    };
  }
  return { ok: true, data: { price: n, durationMin: null, notes: null } };
}

/** Parse an optional duration input (minutes): blank -> null, else 5–1440. */
export function parseOptionalDurationMin(raw: unknown): BundleParseResult {
  const s = String(raw ?? '').trim();
  if (s === '') return { ok: true, data: { price: null, durationMin: null, notes: null } };
  const n = Number(s);
  if (!Number.isInteger(n) || n < 5 || n > 1440) {
    return {
      ok: false,
      errorEn: 'Duration must be a whole number of minutes between 5 and 1440.',
      errorFr: 'La durée doit être un nombre entier de minutes entre 5 et 1440.',
    };
  }
  return { ok: true, data: { price: null, durationMin: n, notes: null } };
}

/** Parse an optional notes input: blank -> null, trimmed, capped at 2000 chars. */
export function parseOptionalNotes(raw: unknown): BundleParseResult {
  const s = String(raw ?? '').trim();
  if (s === '') return { ok: true, data: { price: null, durationMin: null, notes: null } };
  return {
    ok: true,
    data: { price: null, durationMin: null, notes: s.slice(0, MAX_NOTES) },
  };
}

/** Parse all three optional bundle fields from form values. */
export function parseTemplateBundleFields(raw: {
  price?: unknown;
  durationMin?: unknown;
  notes?: unknown;
}): BundleParseResult {
  const price = parseOptionalPrice(raw.price);
  if (!price.ok) return price;
  const duration = parseOptionalDurationMin(raw.durationMin);
  if (!duration.ok) return duration;
  const notes = parseOptionalNotes(raw.notes);
  if (!notes.ok) return notes;
  return {
    ok: true,
    data: {
      price: price.data.price,
      durationMin: duration.data.durationMin,
      notes: notes.data.notes,
    },
  };
}

export interface TemplateLike {
  name: string;
  price: number | null;
  notes: string | null;
}

export interface JobInitialLike {
  title: string;
  price?: number;
  notes?: string;
}

/**
 * Map a checklist template onto new-job form initial values: title from the
 * template name, price and notes pre-filled when the template has them.
 */
export function templateToJobInitial(t: TemplateLike): JobInitialLike {
  const initial: JobInitialLike = { title: t.name };
  if (typeof t.price === 'number' && Number.isFinite(t.price)) {
    initial.price = t.price;
  }
  if (t.notes && t.notes.trim().length > 0) {
    initial.notes = t.notes;
  }
  return initial;
}
