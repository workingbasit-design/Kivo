/**
 * Unit tests for the platform transactional email helper
 * (src/lib/messaging/platform-email.ts).
 * Run: node --test src/lib/__tests__/platform-email.test.mts
 *
 * Zero live provider calls: fetch is always injected. RESEND_API_KEY is
 * saved/restored around each test that touches it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { sendPlatformEmail } from '../messaging/platform-email.ts';

const KEY = 'RESEND_API_KEY';

function withKey(value: string | undefined, fn: () => Promise<void>) {
  return async () => {
    const prev = process.env[KEY];
    try {
      if (value === undefined) delete process.env[KEY];
      else process.env[KEY] = value;
      await fn();
    } finally {
      if (prev === undefined) delete process.env[KEY];
      else process.env[KEY] = prev;
    }
  };
}

function okFetch(expected: { url: string; apiKey: string; to: string }) {
  return async (url: string, init: { headers: Record<string, string>; body: string }) => {
    assert.equal(url, expected.url);
    assert.equal(init.headers['Authorization'], `Bearer ${expected.apiKey}`);
    const body = JSON.parse(init.body);
    assert.deepEqual(body.to, [expected.to]);
    assert.ok(typeof body.subject === 'string' && body.subject.length > 0);
    assert.ok(typeof body.text === 'string' && body.text.length > 0);
    assert.ok(typeof body.from === 'string' && body.from.includes('everyjob.ca'));
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: 'msg_123' }),
    } as unknown as Response;
  };
}

test(
  'missing RESEND_API_KEY: honest skip, fetch never called',
  withKey(undefined, async () => {
    let called = false;
    const result = await sendPlatformEmail(
      'a@b.ca',
      'Subject',
      'Body',
      {
        fetchFn: (async () => {
          called = true;
          throw new Error('must not be called');
        }) as typeof fetch,
      }
    );
    assert.equal(result.ok, false);
    assert.equal(result.notConfigured, true);
    assert.equal(result.error, 'Email is not configured yet.');
    assert.equal(called, false);
  })
);

test(
  'sends via Resend with the platform key and returns ok',
  withKey('re_test_key', async () => {
    const result = await sendPlatformEmail('a@b.ca', 'Hi', 'Hello', {
      fetchFn: okFetch({
        url: 'https://api.resend.com/emails',
        apiKey: 're_test_key',
        to: 'a@b.ca',
      }),
    });
    assert.equal(result.ok, true);
  })
);

test(
  'Resend API failure: honest error, never throws',
  withKey('re_test_key', async () => {
    const result = await sendPlatformEmail('a@b.ca', 'Hi', 'Hello', {
      fetchFn: (async () => ({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Invalid API key' }),
      })) as unknown as typeof fetch,
    });
    assert.equal(result.ok, false);
    assert.ok((result.error ?? '').includes('Invalid API key'));
  })
);

test(
  'network failure: honest error, never throws',
  withKey('re_test_key', async () => {
    const result = await sendPlatformEmail('a@b.ca', 'Hi', 'Hello', {
      fetchFn: (async () => {
        throw new Error('boom');
      }) as unknown as typeof fetch,
    });
    assert.equal(result.ok, false);
  })
);
