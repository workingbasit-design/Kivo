/**
 * JSON-LD embedded in a `<script type="application/ld+json">` block
 * (security audit F3, 2026-11-11).
 *
 * `JSON.stringify` does NOT escape `</script>`, so a business named
 * e.g. `X</script><script>alert(1)</script>` would terminate the JSON-LD
 * element and inject a script element on public pages. Escaping `<` as
 * `\u003c` (the standard JSON-in-`<script>` escape) keeps the JSON
 * identical after parsing while making breakout impossible.
 */
export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
