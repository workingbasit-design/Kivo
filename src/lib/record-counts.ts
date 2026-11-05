/**
 * Human-readable summary of a customer's linked records, for dialogs that
 * must say WHAT blocks an action (e.g. the archived-customer delete dialog).
 *
 * Zero-count kinds are omitted; an all-zero input yields '' (the caller then
 * uses the "no records" copy instead of the blocked copy). Nouns are the
 * same ones the delete-dialog copy already uses (job/emploi, invoice/facture,
 * quote/devis); only 1 stays singular in both languages.
 */
export type RecordCounts = {
  jobs: number;
  invoices: number;
  quotes: number;
};

const NOUNS: Record<'en' | 'fr', Record<keyof RecordCounts, [string, string]>> = {
  en: {
    jobs: ['job', 'jobs'],
    invoices: ['invoice', 'invoices'],
    quotes: ['quote', 'quotes'],
  },
  fr: {
    jobs: ['emploi', 'emplois'],
    invoices: ['facture', 'factures'],
    quotes: ['devis', 'devis'],
  },
};

export function formatRecordCounts(counts: RecordCounts, locale: 'en' | 'fr'): string {
  const nouns = NOUNS[locale] ?? NOUNS.en;
  const parts: string[] = [];
  (Object.keys(counts) as (keyof RecordCounts)[]).forEach((kind) => {
    const n = counts[kind];
    if (n <= 0) return;
    const [singular, plural] = nouns[kind];
    parts.push(`${n} ${n === 1 ? singular : plural}`);
  });
  return parts.join(', ');
}
