/** B9 error-log tests: PII scrubbing, fingerprinting, alert thresholds. Pure parts only. */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scrubText, fingerprintFor, evaluateThresholds } from '../error-log.ts';

describe('scrubText', () => {
  it('redacts emails', () => {
    assert.equal(scrubText('failed for user bob@example.ca'), 'failed for user [email]');
  });
  it('redacts Stripe-style secrets', () => {
    assert.ok(!scrubText('key sk_test_fake123 leaked').includes('sk_test_'));
    assert.ok(!scrubText('whsec_abc123def456').includes('whsec_'));
  });
  it('redacts bearer tokens', () => {
    const out = scrubText('auth failed: Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig');
    assert.ok(!out.includes('eyJhbGci'), 'bearer token must be redacted');
  });
  it('redacts very long opaque blobs but keeps short ids', () => {
    const long = 'a'.repeat(64);
    assert.ok(scrubText(`token ${long}`).includes('[blob]'));
    assert.ok(scrubText('id cm123abc').includes('cm123abc'), 'short ids are kept for debugging');
  });
  it('leaves ordinary messages intact', () => {
    assert.equal(scrubText('Database connection failed'), 'Database connection failed');
  });
});

describe('fingerprintFor', () => {
  it('is stable for the same error', () => {
    const a = fingerprintFor('boom', 'Error: boom\n at foo (/app/x.ts:10:5)');
    const b = fingerprintFor('boom', 'Error: boom\n at foo (/app/x.ts:99:2)');
    assert.equal(a, b, 'line numbers must not split the fingerprint');
  });
  it('differs for different errors', () => {
    assert.notEqual(fingerprintFor('boom-a'), fingerprintFor('boom-b'));
  });
});

describe('evaluateThresholds', () => {
  it('fires on an error spike', () => {
    const alerts = evaluateThresholds({
      errorsLast10Min: 11,
      loginFailuresByIp: [],
      webhookEndpointFailures: [],
      exportCountsByBusiness: [],
    });
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].key, 'error-spike');
  });
  it('stays quiet under the thresholds', () => {
    const alerts = evaluateThresholds({
      errorsLast10Min: 10,
      loginFailuresByIp: [{ ip: '1.2.3.4', count: 20 }],
      webhookEndpointFailures: [{ endpointId: 'e1', businessId: 'b1', consecutiveFailures: 2 }],
      exportCountsByBusiness: [{ businessId: 'b1', count: 3 }],
    });
    assert.equal(alerts.length, 0);
  });
  it('fires per-IP login, webhook, and export alerts', () => {
    const alerts = evaluateThresholds({
      errorsLast10Min: 0,
      loginFailuresByIp: [{ ip: '9.9.9.9', count: 21 }],
      webhookEndpointFailures: [{ endpointId: 'e9', businessId: 'b9', consecutiveFailures: 3 }],
      exportCountsByBusiness: [{ businessId: 'b9', count: 4 }],
    });
    assert.equal(alerts.length, 3);
    assert.ok(alerts.some((a) => a.key === 'login-failures:9.9.9.9'));
    assert.ok(alerts.some((a) => a.key === 'webhook-failures:e9'));
    assert.ok(alerts.some((a) => a.key === 'export-volume:b9'));
  });
});
