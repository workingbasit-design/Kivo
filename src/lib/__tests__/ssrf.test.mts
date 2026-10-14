/**
 * B1.5 SSRF tests. The DNS resolver is stubbed via the mutable `ssrfHooks`
 * object so no real DNS happens; literal IPs exercise the no-DNS path.
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { assertPublicUrl, isBlockedIp, isSafeRedirectTarget, SsrfError, ssrfHooks } from '../ssrf.ts';

const PUBLIC_IP = '142.250.72.14';

function stubResolver(map: Record<string, string>) {
  ssrfHooks.lookup = async (hostname: string) => {
    const address = map[hostname];
    if (!address) throw new Error('ENOTFOUND');
    return { address };
  };
}

describe('isBlockedIp', () => {
  it('blocks RFC 1918, loopback, link-local, metadata, multicast, reserved', () => {
    for (const ip of [
      '10.0.0.1',
      '172.16.5.4',
      '192.168.1.1',
      '127.0.0.1',
      '169.254.169.254',
      '169.254.10.20',
      '224.0.0.1',
      '240.0.0.0/4'.split('/')[0],
      '0.0.0.0',
      '::1',
      'fe80::1',
      'fc00::1',
      '::ffff:10.0.0.1',
    ]) {
      assert.equal(isBlockedIp(ip), true, `${ip} should be blocked`);
    }
  });

  it('allows public IPs', () => {
    for (const ip of [PUBLIC_IP, '8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']) {
      assert.equal(isBlockedIp(ip), false, `${ip} should be allowed`);
    }
  });
});

describe('assertPublicUrl', () => {
  beforeEach(() => {
    ssrfHooks.allowLoopback = false;
    stubResolver({ 'hooks.zapier.com': PUBLIC_IP, 'internal.corp': '10.1.2.3' });
  });
  afterEach(() => {
    ssrfHooks.allowLoopback = false;
  });

  it('allows a public webhook URL', async () => {
    const out = await assertPublicUrl('https://hooks.zapier.com/abc?x=1');
    assert.ok(out.startsWith('https://hooks.zapier.com/'));
  });

  it('rejects cloud metadata IP', async () => {
    await assert.rejects(assertPublicUrl('http://169.254.169.254/latest/meta-data/'), SsrfError);
  });

  it('rejects localhost', async () => {
    await assert.rejects(assertPublicUrl('http://localhost:3000/hook'), SsrfError);
    await assert.rejects(assertPublicUrl('http://127.0.0.1:3000/hook'), SsrfError);
  });

  it('rejects a hostname resolving to RFC 1918', async () => {
    await assert.rejects(assertPublicUrl('https://internal.corp/hook'), SsrfError);
  });

  it('rejects non-http(s) schemes', async () => {
    await assert.rejects(assertPublicUrl('file:///etc/passwd'), SsrfError);
    await assert.rejects(assertPublicUrl('ftp://hooks.zapier.com/x'), SsrfError);
    await assert.rejects(assertPublicUrl('gopher://hooks.zapier.com/x'), SsrfError);
  });

  it('rejects unresolvable hostnames', async () => {
    await assert.rejects(assertPublicUrl('https://no-such-host.invalid/hook'), SsrfError);
  });

  it('rejects garbage input', async () => {
    await assert.rejects(assertPublicUrl('not a url'), SsrfError);
  });

  it('test allowlist flag permits loopback when explicitly enabled', async () => {
    ssrfHooks.allowLoopback = true;
    stubResolver({ localhost: '127.0.0.1' });
    const out = await assertPublicUrl('http://localhost:3000/hook');
    assert.ok(out.includes('localhost'));
  });

  it('isSafeRedirectTarget mirrors the same rules without throwing', async () => {
    assert.equal(await isSafeRedirectTarget('https://hooks.zapier.com/ok'), true);
    assert.equal(await isSafeRedirectTarget('http://169.254.169.254/x'), false);
  });
});
