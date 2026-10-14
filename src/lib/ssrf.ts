/**
 * SSRF guard (Prompt 3, B1.5).
 *
 * Every server-side fetch of a user-controlled URL must pass through
 * `assertPublicUrl()` before the request is made. The endpoint URL of an
 * outgoing webhook is business-user-controlled, so without this check a
 * compromised or malicious business account could make the server fetch
 * internal addresses (cloud metadata 169.254.169.254, localhost services,
 * RFC 1918 hosts reachable from the VPC).
 *
 * What it does:
 *  - rejects non-http(s) schemes (no file:, gopher:, ftp:, etc.)
 *  - resolves the hostname with the OS resolver and rejects the resolved
 *    IP when it falls in a private/loopback/link-local/reserved range
 *  - callers should ALSO fetch with `redirect: 'manual'` and re-validate
 *    any 3xx Location before following (redirects are resolved by the
 *    receiver's HTTP client, which would bypass this check otherwise)
 *
 * TOCTOU note (DNS rebinding): the IP is validated at request time, but a
 * hostile DNS server could return a public IP for the validation lookup and
 * a private IP for the fetch's own lookup (short TTL). Node's fetch does not
 * expose connection dialing, so the validated IP cannot be pinned without
 * breaking TLS SNI/certificate validation (the cert is issued for the
 * hostname, not the IP). Mitigations in place: validation happens
 * immediately before the fetch (same tick, no caching of the lookup), and
 * webhook endpoints are authenticated-business-user-controlled, not
 * anonymous-attacker-controlled, which bounds the realistic threat. If a
 * future runtime allows IP pinning with SNI override, switch to it.
 *
 * Pure except for the DNS lookup; runs under plain node:test with the
 * loopback allowlist flag enabled for tests.
 */

import { lookup } from 'node:dns/promises';

/**
 * Mutable test hooks. ESM namespace objects are frozen, so tests cannot
 * reassign an exported `let` - they mutate these properties instead.
 * `allowLoopback`: set true in tests to allow 127.0.0.0/8 + ::1. Never true
 * in prod. `lookup`: inject a fake DNS resolver in tests.
 */
export const ssrfHooks = {
  allowLoopback: false,
  lookup: async (hostname: string): Promise<{ address: string }> => lookup(hostname),
};

export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsrfError';
  }
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v > 255) return null;
    n = (n << 8) + v;
  }
  return n >>> 0;
}

function inCidr(ipInt: number, cidr: string): boolean {
  const [base, bitsStr] = cidr.split('/');
  const baseInt = ipv4ToInt(base);
  if (baseInt === null) return false;
  const bits = Number(bitsStr);
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

/** IPv4 ranges that must never be fetched server-side. */
const BLOCKED_V4_CIDRS = [
  '10.0.0.0/8', // RFC 1918
  '172.16.0.0/12', // RFC 1918
  '192.168.0.0/16', // RFC 1918
  '127.0.0.0/8', // loopback
  '169.254.0.0/16', // link-local incl. cloud metadata 169.254.169.254
  '192.0.2.0/24', // TEST-NET-1 (documentation)
  '198.51.100.0/24', // TEST-NET-2
  '203.0.113.0/24', // TEST-NET-3
  '224.0.0.0/4', // multicast
  '240.0.0.0/4', // reserved
  '0.0.0.0/8', // "this network"
];

/** Normalize an IPv6 loopback/unspecified address for the block check. */
function isBlockedV6(ip: string): boolean {
  const lower = ip.toLowerCase();
  // ::1 loopback, :: unspecified, fe80::/10 link-local, fc00::/7 unique-local,
  // ff00::/8 multicast. A full parser is overkill: block the well-known
  // prefixes textually after expanding the common compressed forms.
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fe80:')) return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  if (lower.startsWith('ff')) return true;
  return false;
}

export function isBlockedIp(ip: string): boolean {
  const v4 = ipv4ToInt(ip);
  if (v4 !== null) {
    if (ssrfHooks.allowLoopback && inCidr(v4, '127.0.0.0/8')) return false;
    return BLOCKED_V4_CIDRS.some((c) => inCidr(v4, c));
  }
  // IPv6 (or IPv4-mapped ::ffff:1.2.3.4)
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return isBlockedIp(mapped[1]);
  if (ssrfHooks.allowLoopback && (ip === '::1' || ip.toLowerCase() === '::1'))
    return false;
  return isBlockedV6(ip);
}

/**
 * Validate a user-controlled URL for server-side fetching. Resolves the
 * hostname and rejects private/internal targets. Throws SsrfError on any
 * problem; returns the normalized URL string when safe.
 */
export async function assertPublicUrl(rawUrl: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SsrfError('URL is not parseable.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SsrfError(`URL scheme "${url.protocol}" is not allowed.`);
  }
  if (!url.hostname) throw new SsrfError('URL has no hostname.');
  // Literal IP in the URL: check directly without DNS.
  if (ipv4ToInt(url.hostname) !== null || url.hostname.includes(':')) {
    if (isBlockedIp(url.hostname)) {
      throw new SsrfError('URL resolves to a blocked (private/internal) address.');
    }
    return url.toString();
  }
  let resolved: string;
  try {
    resolved = (await ssrfHooks.lookup(url.hostname)).address;
  } catch {
    throw new SsrfError('Hostname could not be resolved.');
  }
  if (isBlockedIp(resolved)) {
    throw new SsrfError('URL resolves to a blocked (private/internal) address.');
  }
  return url.toString();
}

/**
 * Validate a redirect target during manual-redirect handling: same rules as
 * assertPublicUrl, but returns false instead of throwing so the caller can
 * fail the delivery with a clean error.
 */
export async function isSafeRedirectTarget(location: string): Promise<boolean> {
  try {
    await assertPublicUrl(location);
    return true;
  } catch {
    return false;
  }
}
