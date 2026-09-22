/**
 * Display helpers for invoice notes.
 *
 * Line items used to live inside `notes` as structured text (either the
 * "Items:\n- desc × qty @ rate = total" block the app generated, or the
 * legacy seed format "AC Deep Service x1 — ₹1,499"). They now live in the
 * InvoiceLineItem table; this strips the migrated item text so the notes
 * section doesn't duplicate the line-item table.
 */

/** A line that looks like a migrated line item ("desc x2 — ₹2,999" etc). */
const LEGACY_ITEM_LINE =
  /^(.+?)\s*(?:[x×]\s*[\d.]+)?\s*[—–-]\s*[₹$]?\s*[\d,]+(?:\.\d{1,2})?$/;

/**
 * The user-written part of the notes, with migrated line-item text removed.
 * Returns '' when nothing user-written remains.
 */
export function displayNotes(
  notes: string | null | undefined,
  hasLineItems: boolean
): string {
  if (!notes) return '';
  let text = notes;
  const marker = 'Items:\n';
  const idx = text.indexOf(marker);
  if (idx !== -1) {
    text = text.slice(0, idx);
  } else if (hasLineItems) {
    // Legacy seed format: if every line parses as an item line, it was all migrated.
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length > 0 && lines.every((l) => LEGACY_ITEM_LINE.test(l))) {
      return '';
    }
  }
  return text.trim();
}
