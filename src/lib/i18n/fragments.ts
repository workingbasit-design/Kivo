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
import notifications from './fragments/notifications.ts';
import track9 from './fragments/track9.ts';
import googleReviews from './fragments/google-reviews.ts';
import attachments from './fragments/attachments.ts';
import imports from './fragments/imports.ts';
import googleAuth from './fragments/google-auth.ts';
import track8 from './fragments/track8.ts';
import billing from './fragments/billing.ts';
import customerExtras from './fragments/customer-extras.ts';
import quoteItems from './fragments/quote-items.ts';
import track10work from './fragments/track10-work.ts';
import track10money from './fragments/track10-money.ts';
import track10misc from './fragments/track10-misc.ts';
import exportsFrag from './fragments/exports.ts';

const FRAGMENTS: I18nFragment[] = [reminders, jobops, quotes, homehero, homefaq, notifications, track9, googleReviews, attachments, imports, googleAuth, track8, billing, customerExtras, quoteItems, track10work, track10money, track10misc, exportsFrag];

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
