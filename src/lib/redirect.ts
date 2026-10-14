/**
 * Open-redirect guard (Prompt 3, B7.7).
 *
 * `safeNext()` validates a `?next=` redirect target: only relative in-app
 * paths are allowed. Absolute URLs, protocol-relative URLs, and backslash
 * tricks (`/\evil.com`, which some browsers normalize to `//evil.com`) are
 * rejected. Pure; runs under plain node:test.
 */
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v.startsWith('/')) return null;
  if (v.startsWith('//')) return null;
  if (v.includes('\\')) return null;
  return v;
}
