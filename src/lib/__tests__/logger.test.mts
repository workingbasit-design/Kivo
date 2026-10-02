/**
 * Unit tests for the structured JSON logger (playbook layer 13a).
 *
 * Proves: JSON shape, level filtering, redaction of sensitive fields
 * (including nested), bearer-token redaction, Error serialization,
 * debug-off-in-production, and child() context binding.
 *
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/logger.test.mts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./register-loader.mjs', import.meta.url);

const { logger, redactForLog } = await import('../logger.ts');

type Captured = { stream: string; entry: Record<string, unknown> };

function capture(fn: () => void): Captured[] {
  const out: Captured[] = [];
  const origLog = console.log;
  const origErr = console.error;
  console.log = (s: string) => out.push({ stream: 'log', entry: JSON.parse(s) });
  console.error = (s: string) => out.push({ stream: 'error', entry: JSON.parse(s) });
  try {
    fn();
  } finally {
    console.log = origLog;
    console.error = origErr;
  }
  return out;
}

function withEnv(env: Record<string, string | undefined>, fn: () => void): void {
  const saved: Record<string, string | undefined> = {};
  for (const k of Object.keys(env)) {
    saved[k] = process.env[k];
    if (env[k] === undefined) delete process.env[k];
    else process.env[k] = env[k];
  }
  try {
    fn();
  } finally {
    for (const k of Object.keys(env)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

test('JSON shape: timestamp, level, message, context fields', () => {
  const lines = capture(() =>
    logger.info('job created', { businessId: 'biz_1', userId: 'u_1', requestId: 'r_1' })
  );
  assert.equal(lines.length, 1);
  const e = lines[0].entry;
  assert.equal(e.level, 'info');
  assert.equal(e.message, 'job created');
  assert.equal(e.businessId, 'biz_1');
  assert.equal(e.userId, 'u_1');
  assert.equal(e.requestId, 'r_1');
  assert.match(String(e.timestamp), /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(lines[0].stream, 'log');
});

test('error and warn go to stderr, info and debug to stdout', () => {
  const lines = capture(() => {
    logger.error('boom');
    logger.warn('careful');
    logger.info('note');
  });
  assert.deepEqual(
    lines.map((l) => l.stream),
    ['error', 'error', 'log']
  );
});

test('redacts sensitive fields at top level', () => {
  const redacted = redactForLog({
    password: 'hunter2',
    token: 'abc',
    secret: 's3cr3t',
    apiKey: 'key-123',
    clientSecret: 'cs-1',
    authorization: 'Bearer xyz',
    accessKey: 'ak',
    normal: 'visible',
  }) as Record<string, unknown>;
  for (const k of ['password', 'token', 'secret', 'apiKey', 'clientSecret', 'authorization', 'accessKey']) {
    assert.equal(redacted[k], '[REDACTED]', k);
  }
  assert.equal(redacted.normal, 'visible');
});

test('redacts sensitive fields in nested objects and arrays', () => {
  const redacted = redactForLog({
    user: { name: 'Asha', password: 'hunter2', profile: { apiKey: 'k' } },
    items: [{ token: 't1' }, { ok: 1 }],
  }) as Record<string, unknown>;
  const user = redacted.user as Record<string, unknown>;
  assert.equal(user.password, '[REDACTED]');
  assert.equal(user.name, 'Asha');
  assert.equal((user.profile as Record<string, unknown>).apiKey, '[REDACTED]');
  const items = redacted.items as Record<string, unknown>[];
  assert.equal(items[0].token, '[REDACTED]');
  assert.equal(items[1].ok, 1);
});

test('redacts bearer-token values even under innocent key names', () => {
  const redacted = redactForLog({ header: 'Bearer abcDEF123-_.' }) as Record<string, unknown>;
  assert.equal(redacted.header, '[REDACTED]');
});

test('does not redact ordinary values', () => {
  const redacted = redactForLog({ businessId: 'biz_1', amount: 299, note: 'Bearer of good news' });
  assert.deepEqual(redacted, { businessId: 'biz_1', amount: 299, note: 'Bearer of good news' });
});

test('serializes Error objects without dropping message/stack', () => {
  const lines = capture(() => logger.error('failed', { error: new Error('boom') }));
  const err = lines[0].entry.error as Record<string, unknown>;
  assert.equal(err.name, 'Error');
  assert.equal(err.message, 'boom');
  assert.equal(typeof err.stack, 'string');
});

test('circular structures do not throw', () => {
  const a: Record<string, unknown> = {};
  a.self = a;
  const redacted = redactForLog(a) as Record<string, unknown>;
  assert.equal(redacted.self, '[Circular]');
});

test('debug is disabled in production', () => {
  withEnv({ NODE_ENV: 'production', LOG_LEVEL: undefined }, () => {
    const lines = capture(() => {
      logger.debug('nope');
      logger.info('yes');
    });
    assert.equal(lines.length, 1);
    assert.equal(lines[0].entry.level, 'info');
  });
});

test('debug is enabled outside production', () => {
  withEnv({ NODE_ENV: 'test', LOG_LEVEL: undefined }, () => {
    const lines = capture(() => logger.debug('yes'));
    assert.equal(lines.length, 1);
    assert.equal(lines[0].entry.level, 'debug');
  });
});

test('LOG_LEVEL env overrides the minimum level', () => {
  withEnv({ NODE_ENV: 'test', LOG_LEVEL: 'warn' }, () => {
    const lines = capture(() => {
      logger.info('nope');
      logger.warn('yes');
      logger.error('yes');
    });
    assert.deepEqual(lines.map((l) => l.entry.level), ['warn', 'error']);
  });
});

test('child() binds context to every call', () => {
  const lines = capture(() => {
    const req = logger.child({ requestId: 'r-9', businessId: 'biz_9' });
    req.info('hello', { extra: 1 });
  });
  assert.equal(lines.length, 1);
  const e = lines[0].entry;
  assert.equal(e.requestId, 'r-9');
  assert.equal(e.businessId, 'biz_9');
  assert.equal(e.extra, 1);
});
