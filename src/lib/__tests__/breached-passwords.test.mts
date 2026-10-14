/** B7.3a HIBP k-anonymity tests (stubbed fetch - no network). */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isPasswordBreached } from '../breached-passwords.ts';

// SHA-1("password") = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
const BREACHED_SUFFIX = '1E4C9B93F3F0682250B6CF8331B7EE68FD8';

function stubFetch(body: string) {
  return (async () => ({ ok: true, text: async () => body })) as unknown as typeof fetch;
}

describe('isPasswordBreached', () => {
  it('detects a known-breached password via k-anonymity', async () => {
    const r = await isPasswordBreached('password', stubFetch(`${BREACHED_SUFFIX}:100\nABCDEF123:2\n`));
    assert.equal(r.breached, true);
  });
  it('only sends the 5-char prefix, never the password', async () => {
    let seenUrl = '';
    const spy = (async (url: string) => {
      seenUrl = url;
      return { ok: true, text: async () => 'ABCDEF:1\n' };
    }) as unknown as typeof fetch;
    const r = await isPasswordBreached('s3cret-p@ssw0rd!', spy);
    assert.equal(r.breached, false);
    assert.ok(seenUrl.startsWith('https://api.pwnedpasswords.com/range/'), seenUrl);
    const prefix = seenUrl.split('/range/')[1];
    assert.equal(prefix.length, 5);
    assert.ok(!seenUrl.toLowerCase().includes('s3cret'), 'password must not leak into the URL');
  });
  it('fails open on network error', async () => {
    const failing = (async () => {
      throw new Error('boom');
    }) as unknown as typeof fetch;
    const r = await isPasswordBreached('anything', failing);
    assert.equal(r.breached, false);
    assert.ok(r.error, 'outage is reported, not thrown');
  });
  it('fails open on HIBP HTTP error', async () => {
    const bad = (async () => ({ ok: false, status: 503 })) as unknown as typeof fetch;
    const r = await isPasswordBreached('anything', bad);
    assert.equal(r.breached, false);
  });
});
