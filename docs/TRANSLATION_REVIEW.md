# Translation Review — French (fr-CA)

**Status: needs native review.** Every French string in the app must be checked by a Quebec French speaker before it is treated as final. This file lists what changed in Part D, the vocabulary rules applied, the highest-risk strings, and where the full list lives.

- Dictionaries: `src/lib/i18n/en.ts` + `src/lib/i18n/fr.ts` (base) and `src/lib/i18n/fragments/*.ts` (per-feature).
- Merged key count: **3,279 keys in en, 3,279 keys in fr, 0 missing in either direction, 0 empty** (verified by `scripts/check-i18n-parity.mjs`, also run in CI).
- Full list of all 3,279 French strings: [`docs/TRANSLATION_REVIEW_FULL.md`](TRANSLATION_REVIEW_FULL.md) — every line there is marked "needs native review".

## Strings changed in Part D (25 total: 20 French, 5 English)

### French — "job/jobs" borrowing → "travail/travaux" (18)

The app's own navigation uses **Travaux** for Jobs, but several screens used the English borrowing "job/jobs". All now use travail/travaux for consistency:

| Key | Before | After |
|---|---|---|
| `attention.category.jobs` | Jobs | Travaux |
| `digest.jobCount` | {count} jobs | {count} travaux |
| `digest.weekJobs` | {count} jobs planifiés | {count} travaux planifiés |
| `digest.openJob` | Ouvrir le job | Ouvrir le travail |
| `projects.jobs` | Jobs | Travaux |
| `projects.deleteConfirm` | Supprimer ce projet? Ses jobs restent dans votre liste. | Supprimer ce projet? Ses travaux restent dans votre liste. |
| `projects.noJobs` | Aucun job lié pour l’instant. | Aucun travail lié pour l’instant. |
| `projects.attachJob` | Lier un job | Lier un travail |
| `projects.attachJobHint` | Choisissez un de vos jobs à lier à ce projet. | Choisissez un de vos travaux à lier à ce projet. |
| `projects.noProjectsDesc` | Regroupez les jobs liés en phases - rénovations, constructions, travail en plusieurs visites. | Regroupez les travaux liés en phases - rénovations, constructions, travail en plusieurs visites. |
| `projects.spent` | Valeur des jobs | Valeur des travaux |
| `crews.jobs` | {count} jobs | {count} travaux |
| `crews.deleteConfirm` | Supprimer cette équipe? Les jobs conservent leurs données - leur lien d’équipe est effacé. | Supprimer cette équipe? Les travaux conservent leurs données - leur lien d’équipe est effacé. |
| `reports.type.jobs` | Jobs | Travaux |
| `bookkeeping.subtitle` | Profits et pertes à partir de vos vrais jobs, factures et dépenses. | Profits et pertes à partir de vos vrais travaux, factures et dépenses. |
| `t10work.schedOverdueTitle` | Jobs en retard | Travaux en retard |
| `t10work.schedOverdueDesc` | Ces jobs ont dépassé leur date prévue et sont encore ouverts. Replanifiez-les ou terminez-les. | Ces travaux ont dépassé leur date prévue et sont encore ouverts. Replanifiez-les ou terminez-les. |
| `t10money.money.unbilledDesc` | Jobs terminés sans facture. Facturez-les avant de les oublier. | Travaux terminés sans facture. Facturez-les avant de les oublier. |

### French — other (2)

| Key | Before | After | Why |
|---|---|---|---|
| `agent.keys.active` | Active | Actif | Masculine default for a key status label (was English-identical). |
| `t10misc.voice.langEn` | English (Canada) | Anglais (Canada) | Language name must be in the UI language. |

### English — Canadian spelling / wrong-language text (5)

| Key | Before | After | Why |
|---|---|---|---|
| `crews.color` | Color | Colour | Canadian spelling. |
| `support.helpTitle` | Help center | Help Centre | Canadian spelling. |
| `support.backToHelp` | Back to help center | Back to help centre | Canadian spelling. |
| `support.inboxSub` | Tickets sent from the help center. … | Tickets sent from the help centre. … | Canadian spelling. |
| `t10misc.profile.headlineFrHint` | p. ex. Plomberie fiable, bien faite | e.g. Reliable plumbing, done right | The English dictionary contained French hint text. |

Notes on spelling choices: `-ize` endings (Organize, Optimize, personalize) were **kept** — they are correct Canadian English per the Canadian Oxford Dictionary. "Licence" (noun) was already correct Canadian spelling. Verb "Check" usages ("Check the details") are correct in Canadian English.

## Quebec vocabulary rules (applied across the dictionaries)

- Quote → **soumission** (never "devis" alone in customer-facing copy where "soumission" fits; existing "Devis" labels in nav/filters were kept where they are the established in-app term — reviewer: confirm).
- Invoice → **facture**.
- Email → **courriel** (user-facing copy; `{email}` interpolation placeholders are keys, not display text).
- GST → **TPS**, QST → **TVQ**, HST → **TVH**. Verified: no `GST`/`HST`/`PST`/`QST` strings remain in any French value.
- Jobs → **travaux** (see table above). The `{job}` / `{jobId}` interpolation placeholders are keys, not display text, and were left unchanged.
- Money, numbers, dates, times go through `Intl` with **`fr-CA`** (never `fr` or `fr-FR`): `src/lib/money.ts` formats French money with `Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' })` → "1 234,56 $". Date/money locale mapping lives in `src/lib/utils.ts` (`localeDateTag` → `fr-CA`, `localeMoneyTag` → `fr` which `formatMoney` maps to `fr-CA`).

## Format fixes in Part D (5 sites)

| Site | Before | After |
|---|---|---|
| `directory-reports/report-row.tsx` | `toLocaleString()` (runtime default locale) | `toLocaleString('fr-CA' / 'en-CA', { dateStyle: 'medium', timeStyle: 'short' })` |
| `directory-requests/demand-row.tsx` | `toLocaleString()` | Same locale-aware fix |
| `directory-claims/claim-row.tsx` | `toLocaleString()` | Same locale-aware fix |
| `customer/requests/[id]/page.tsx` | `toLocaleString()` | Same locale-aware fix (server component, locale already in scope) |
| `api/integrations/quickbooks/sync/route.ts` | `` `Payment $${p.amount.toFixed(2)}` `` | `` `Payment ${formatMoney(p.amount, 'CAD', 'en')}` `` (Intl-based; sync route has no UI locale) |

All other `Intl` call sites were audited: `en-CA` is used for timezone-safe ISO date parts (correct — locale-independent digits), and every user-facing French format resolves to `fr-CA`.

## Highest-risk strings for the native reviewer

These are the strings most likely to still be wrong. Check them first:

1. **97 French strings identical to English** (down from 105 before Part D). Most are legitimate cognates ("Total", "Service", "Description", "Profit", "Budget"), brand names ("WhatsApp", "SMS", "Stripe Connect", "Google"), numbers, or placeholders. Run `node scripts/check-i18n-parity.mjs` to print the full list. The ones to scrutinize: `nav.digest` → "Briefing" (Quebec borrowing — is "Briefing du matin" better in nav?), `nav.marketing` → "Marketing", `t10misc.marketing.title` → "Marketing", `integrations.webhooksTitle` → "Webhooks", `t10misc.teamreport.admin` → "Admin".
2. **Remaining "job" borrowings in French sentences** — Part D fixed the headers/labels and the clearest sentence cases. The reviewer should confirm whether colloquial "job" is acceptable anywhere it remains (search the full list for "job" — only `{job}` placeholders should remain).
3. **"Devis" vs "soumission"** — nav and several labels use "Devis". Confirm whether customer-facing copy should say "soumission" everywhere.
4. **Formal vs informal address** — the app mixes "vous" (most copy) with occasional informal phrasing. Confirm one voice throughout.
5. **Currency spacing** — fr-CA uses a narrow no-break space before `$` ("1 234,56 $"). Confirm rendered output looks right on device, especially in the invoice PDF/email templates.

## How to review the full list

1. Open [`docs/TRANSLATION_REVIEW_FULL.md`](TRANSLATION_REVIEW_FULL.md) (3,279 rows: key, English, French).
2. Or regenerate it: the dump is produced from the merged dictionaries (`getDictionary('fr')` + `getDictionary('en')`).
3. Mark each reviewed row, or send corrections as key → corrected French text.
4. Re-run `node --experimental-strip-types scripts/check-i18n-parity.mjs` after any edit — CI fails on missing/empty keys.

## Out of scope / known limitation

Hardcoded English strings inside components (outside the i18n dictionaries) were **not** exhaustively audited in Part D — the dictionary surface (3,279 keys) is fully covered, but a component-level sweep for inline English literals is still open work. Flag any untranslated text found in the French UI during review.
