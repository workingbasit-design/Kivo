/**
 * Customer tag helpers. Tags are stored on Customer.tags as a single
 * comma-separated string (e.g. "vip,senior,dog-friendly").
 *
 * Pure functions — no I/O, safe to import from server actions and node:test.
 */

/** Maximum number of tags stored per customer. */
export const MAX_TAGS = 10;

/** Maximum length of a single tag (longer input is truncated). */
export const MAX_TAG_LENGTH = 30;

/**
 * Normalize a raw tags input (comma-separated string) into a clean list:
 * lowercase, trimmed, empty entries dropped, de-duplicated, at most
 * MAX_TAGS tags, each at most MAX_TAG_LENGTH characters.
 */
export function normalizeTags(raw: unknown): string[] {
  const parts = String(raw ?? '')
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const tag = part.slice(0, MAX_TAG_LENGTH);
    if (!seen.has(tag)) {
      seen.add(tag);
      out.push(tag);
    }
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

/** Normalize a raw tags input into the DB string form, or null when empty. */
export function tagsToDb(raw: unknown): string | null {
  const tags = normalizeTags(raw);
  return tags.length > 0 ? tags.join(',') : null;
}
