/**
 * Breached-password check (Prompt 3, B7.3a). Have I Been Pwned k-anonymity:
 * only the first 5 hex chars of the SHA-1 hash leave the server - the full
 * password never does. Fail-open on availability (network error -> allow +
 * warn), never fail-closed: a down HIBP must not lock users out.
 *
 * Pure except for fetch; `fetchFn` is injectable for tests.
 */
import { createHash } from 'node:crypto';

export async function isPasswordBreached(
  password: string,
  fetchFn: typeof fetch = fetch
): Promise<{ breached: boolean; error?: string }> {
  const sha1 = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  let res: Response;
  try {
    res = await fetchFn(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'User-Agent': 'EveryJob-Security-Check' },
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    return { breached: false, error: err instanceof Error ? err.message : 'network error' };
  }
  if (!res.ok) return { breached: false, error: `HIBP HTTP ${res.status}` };
  const body = await res.text();
  // Each line is "SUFFIX:count". Compare suffixes only.
  for (const line of body.split('\n')) {
    const [hashSuffix] = line.trim().split(':');
    if (hashSuffix && hashSuffix.toUpperCase() === suffix) return { breached: true };
  }
  return { breached: false };
}
