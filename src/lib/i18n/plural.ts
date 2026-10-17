/**
 * Plural-aware message rendering (Part A, dashboard rebuild).
 *
 * Messages with counts are stored as `{ one, other }` objects in the
 * dictionaries, e.g. `readyToInvoiceCount: { one: '{count} job ready to
 * bill', other: '{count} jobs ready to bill' }`. `tp()` picks the form with
 * `Intl.PluralRules`, so French treats 0 and 1 as singular, and renders
 * it with the given vars ("1 jobs" is impossible by construction).
 */
import { getDictionary, t, type Locale } from './index.ts';

export type PluralForms = { one: string; other: string };

/** 'one' | 'other' for the count in the locale. French: 0 and 1 are singular. */
export function pluralCategory(locale: Locale, count: number): 'one' | 'other' {
  const tag = locale === 'fr' ? 'fr-CA' : 'en-CA';
  return new Intl.PluralRules(tag).select(count) === 'one' ? 'one' : 'other';
}

function fill(template: string, vars: Record<string, string | number>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

function lookupPlural(locale: Locale, path: string): PluralForms | undefined {
  const parts = path.split('.');
  let cur: unknown = getDictionary(locale);
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in cur) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  if (
    cur &&
    typeof cur === 'object' &&
    typeof (cur as PluralForms).one === 'string' &&
    typeof (cur as PluralForms).other === 'string'
  ) {
    return cur as PluralForms;
  }
  return undefined;
}

/**
 * Render a plural message: pick the `one`/`other` form for `count` in the
 * locale and fill `{vars}` (`{count}` is always available). Falls back to
 * the plain `t()` lookup when the path is not a plural object.
 */
export function tp(
  locale: Locale,
  path: string,
  count: number,
  vars: Record<string, string | number> = {}
): string {
  const forms = lookupPlural(locale, path);
  if (!forms) return fill(t(locale, path), { count, ...vars });
  return fill(forms[pluralCategory(locale, count)], { count, ...vars });
}
