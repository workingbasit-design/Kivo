/**
 * Unit tests for Web Push (PWA workstream): pure helpers in src/lib/webpush.ts
 * plus en/fr parity of the pwa i18n fragment. No HTTP, no DB, no network —
 * the unconfigured path is exercised without touching the push service.
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/webpush.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPushPayload,
  getVapidPublicKey,
  isPushConfigured,
  sendPushNotification,
  __resetVapidForTests,
} from '@/lib/webpush.ts';
import fragment from '../i18n/fragments/pwa.ts';

const EN = fragment.en as Record<string, unknown>;
const FR = fragment.fr as Record<string, unknown>;

function keyPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...keyPaths(v as Record<string, unknown>, path));
    } else {
      out.push(path);
    }
  }
  return out;
}

function getPath(obj: Record<string, unknown>, path: string): unknown {
  let cur: unknown = obj;
  for (const p of path.split('.')) {
    if (cur && typeof cur === 'object' && p in cur) cur = (cur as Record<string, unknown>)[p];
    else return undefined;
  }
  return cur;
}

/* ---------------- payload building ---------------- */

test('buildPushPayload applies safe defaults', () => {
  const p = JSON.parse(buildPushPayload({ title: 'Hi', body: 'There' }));
  assert.equal(p.title, 'Hi');
  assert.equal(p.body, 'There');
  assert.equal(p.url, '/dashboard');
  assert.equal(p.icon, '/icons/icon-192.png');
  assert.equal(p.tag, 'everyjob');
});

test('buildPushPayload keeps valid deep-link urls', () => {
  const p = JSON.parse(buildPushPayload({ title: 't', body: 'b', url: '/jobs/abc123', tag: 'job' }));
  assert.equal(p.url, '/jobs/abc123');
  assert.equal(p.tag, 'job');
});

test('buildPushPayload rejects absolute/external urls (open-redirect guard)', () => {
  for (const bad of ['https://evil.example/x', 'http://x', '//evil.example', '']) {
    const p = JSON.parse(buildPushPayload({ title: 't', body: 'b', url: bad }));
    assert.equal(p.url, '/dashboard', bad || '(empty)');
  }
});

/* ---------------- env / configuration ---------------- */

const ENV_KEYS = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'] as const;

function saveEnv(): Record<string, string | undefined> {
  const saved: Record<string, string | undefined> = {};
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  return saved;
}

function restoreEnv(saved: Record<string, string | undefined>): void {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  __resetVapidForTests();
}

test('isPushConfigured is false when any key is missing', () => {
  const saved = saveEnv();
  try {
    for (const k of ENV_KEYS) delete process.env[k];
    assert.equal(isPushConfigured(), false);
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    assert.equal(isPushConfigured(), false, 'subject still missing');
    process.env.VAPID_SUBJECT = 'mailto:test@example.com';
    assert.equal(isPushConfigured(), true);
    process.env.VAPID_SUBJECT = '   ';
    assert.equal(isPushConfigured(), false, 'blank subject counts as missing');
  } finally {
    restoreEnv(saved);
  }
});

test('getVapidPublicKey returns trimmed key or null', () => {
  const saved = saveEnv();
  try {
    delete process.env.VAPID_PUBLIC_KEY;
    assert.equal(getVapidPublicKey(), null);
    process.env.VAPID_PUBLIC_KEY = '  pubkey123  ';
    assert.equal(getVapidPublicKey(), 'pubkey123');
  } finally {
    restoreEnv(saved);
  }
});

test('sendPushNotification is a graceful no-op when unconfigured (no network)', async () => {
  const saved = saveEnv();
  try {
    for (const k of ENV_KEYS) delete process.env[k];
    __resetVapidForTests();
    const res = await sendPushNotification(
      { endpoint: 'https://push.example/x', p256dh: 'a', auth: 'b' },
      { title: 't', body: 'b' }
    );
    assert.equal(res.ok, false);
    assert.equal((res as { skipped?: boolean }).skipped, true);
    assert.equal((res as { reason?: string }).reason, 'push-not-configured');
  } finally {
    restoreEnv(saved);
  }
});

/* ---------------- i18n fragment parity ---------------- */

test('pwa fragment: every en key exists in fr and vice versa', () => {
  const enKeys = keyPaths(EN).sort();
  const frKeys = keyPaths(FR).sort();
  assert.deepEqual(frKeys, enKeys, 'en/fr key sets must match exactly');
});

test('pwa fragment: all leaf values are non-empty strings', () => {
  for (const dict of [EN, FR]) {
    for (const path of keyPaths(dict)) {
      const v = getPath(dict, path);
      assert.equal(typeof v, 'string', path);
      assert.ok((v as string).length > 0, path);
    }
  }
});

test('pwa fragment: keys live under the pwa namespace only', () => {
  const tops = new Set(keyPaths(EN).map((p) => p.split('.')[0]));
  assert.deepEqual([...tops].sort(), ['pwa']);
});
