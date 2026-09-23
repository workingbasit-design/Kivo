/**
 * i18n fragments: lets parallel feature work add strings without editing
 * the shared en.ts / fr.ts (avoids merge conflicts).
 *
 * Each fragment is a new file under src/lib/i18n/fragments/<area>.ts exporting
 * a default { en, fr } pair. All keys must live under that area's unique
 * top-level namespace (e.g. `reminders.title`).
 */
import type { Dictionary } from './en.ts';

export interface I18nFragment {
  en: Dictionary;
  fr: Dictionary;
}

import reminders from './fragments/reminders.ts';
import jobops from './fragments/jobops.ts';
import quotes from './fragments/quotes.ts';
import homehero from './fragments/homehero.ts';
import homefaq from './fragments/homefaq.ts';

const FRAGMENTS: I18nFragment[] = [reminders, jobops, quotes, homehero, homefaq];

function deepMerge(target: Dictionary, src: Dictionary): Dictionary {
  for (const [k, v] of Object.entries(src)) {
    const tv = target[k];
    if (
      v !== null &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      tv !== null &&
      typeof tv === 'object' &&
      !Array.isArray(tv)
    ) {
      target[k] = deepMerge({ ...(tv as Dictionary) }, v as Dictionary);
    } else {
      target[k] = v;
    }
  }
  return target;
}

/** Return a copy of `base` with every fragment merged in for `locale`. */
export function applyFragments(base: Dictionary, locale: 'en' | 'fr'): Dictionary {
  const out: Dictionary = JSON.parse(JSON.stringify(base));
  for (const frag of FRAGMENTS) deepMerge(out, frag[locale]);
  return out;
}
