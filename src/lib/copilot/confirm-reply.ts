/**
 * Deterministic booking-confirmation reply for the Copilot chat.
 * Extracted from the copilot API route so it can be unit-tested:
 * this is the reply that replaced the old hardcoded Hinglish strings,
 * so the French/English branches are locked by tests.
 * Pure — no DB, no network.
 */
import { formatDateShort } from '@/lib/utils.ts';
import { formatMoney } from '@/lib/money.ts';

export interface JobConfirmDraft {
  title: string;
  date: string;
  time?: string | null;
  price?: number | null;
}

export function buildConfirmReply(
  draft: JobConfirmDraft,
  customerName: string,
  duplicate: boolean,
  currency: string,
  fr: boolean
): string {
  const tr = (en: string, frText: string) => (fr ? frText : en);
  return (
    (duplicate
      ? tr(
          'This booking was already confirmed — no duplicate job was created.\n\n',
          'Cette réservation était déjà confirmée — aucun doublon n’a été créé.\n\n'
        )
      : tr('Job booked! ✓\n\n', 'Travail réservé! ✓\n\n')) +
    `${draft.title} — ${customerName}\n` +
    `${formatDateShort(draft.date)}${draft.time ? `, ${draft.time}` : ''}\n` +
    `${tr('Price', 'Prix')} : $${
      draft.price !== null && draft.price !== undefined
        ? formatMoney(draft.price, currency)
        : tr('TBD', 'À déterminer')
    }\n\n` +
    tr('You can see it on the Schedule page.', 'Vous pouvez le voir sur la page Horaire.')
  );
}
