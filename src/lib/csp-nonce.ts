/**
 * CSP nonce reader (Prompt 3, B2.1).
 *
 * The proxy (src/proxy.ts) stamps a per-request nonce on the `x-nonce` request header.
 * Server components call `getCspNonce()` and pass it to their inline
 * `<script nonce={...}>` tags so the nonce-based Content-Security-Policy
 * allows them. Returns undefined when the middleware did not run (tests,
 * static export) - the script then renders without a nonce, which is fine
 * outside the CSP-enforcing runtime.
 */
import { headers } from 'next/headers';

export async function getCspNonce(): Promise<string | undefined> {
  try {
    const h = await headers();
    return h.get('x-nonce') ?? undefined;
  } catch {
    return undefined;
  }
}
