/**
 * Email header injection guard (Prompt 3, B5.5).
 *
 * Names and subjects that flow into email headers (or the Resend API's
 * from/subject fields) must not contain CR/LF characters - otherwise a
 * business name like "Acme\r\nBcc: evil@x.com" could inject extra headers
 * (or extra API fields) into the outgoing message. This strips carriage
 * returns, line feeds, and their URL-encoded forms, and collapses the
 * result. Pure; runs under plain node:test.
 */
export function sanitizeHeader(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replace(/%0d/gi, '')
    .replace(/%0a/gi, '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}
