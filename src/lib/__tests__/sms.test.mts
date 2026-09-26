/**
 * Unit tests for the free SMS deep-link helpers (src/lib/sms.ts).
 * Run: node --test src/lib/__tests__/sms.test.mts
 *
 * These links are user-controlled (they open the phone's SMS app) —
 * nothing is ever sent automatically, so tests only assert link shape.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { smsLink } from '../sms.ts';

test('returns empty string when there is no phone number', () => {
  assert.equal(smsLink(null, 'hi'), '');
  assert.equal(smsLink(undefined, 'hi'), '');
  assert.equal(smsLink('', 'hi'), '');
  assert.equal(smsLink('   ', 'hi'), '');
});

test('prepends the Canadian country code to 10-digit local numbers', () => {
  const link = smsLink('(416) 555-0123', 'hi');
  assert.ok(link.startsWith('sms:+14165550123?body='));
});

test('Android shape uses ?body=', () => {
  const link = smsLink('4165550123', 'hello there', null, false);
  assert.equal(link, 'sms:+14165550123?body=hello%20there');
});

test('iOS shape uses &body=', () => {
  const link = smsLink('4165550123', 'hello there', null, true);
  assert.equal(link, 'sms:+14165550123&body=hello%20there');
});

test('keeps an explicit country code untouched', () => {
  const link = smsLink('+1 416-555-0123', 'hi');
  assert.ok(link.startsWith('sms:+14165550123?body='));
});

test('URL-encodes the message body (unicode, ampersands, newlines)', () => {
  const link = smsLink('4165550123', 'Café & croissants\nÀ demain!');
  assert.ok(
    link.includes('body=' + encodeURIComponent('Café & croissants\nÀ demain!'))
  );
  assert.ok(!link.includes(' '));
});
