/**
 * Unit tests for the public-form bot checks (src/lib/bot-check.ts).
 * Run: node --test src/lib/__tests__/bot-check.test.mts
 *
 * Both public forms — the directory quote-request form and the /book/[slug]
 * booking form — carry the same two hidden fields, and their server actions
 * enforce these checks before any database work:
 *   - honeypot field must be empty (bots fill every field)
 *   - hidden start timestamp must show a human-speed fill time
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { botCheckFailed, HONEYPOT_FIELD, FORM_STARTED_FIELD } from '../bot-check.ts';

function form(entries: [string, string][]): FormData {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

/** A plausible human submission: empty honeypot, 5s fill time. */
function humanForm(): FormData {
  return form([
    [HONEYPOT_FIELD, ''],
    [FORM_STARTED_FIELD, String(Date.now() - 5000)],
  ]);
}

test('exports the field names the public forms render', () => {
  assert.equal(typeof HONEYPOT_FIELD, 'string');
  assert.equal(typeof FORM_STARTED_FIELD, 'string');
  assert.ok(HONEYPOT_FIELD.length > 0);
  assert.ok(FORM_STARTED_FIELD.length > 0);
  assert.notEqual(HONEYPOT_FIELD, FORM_STARTED_FIELD);
});

test('accepts a human-speed submission with an empty honeypot', () => {
  assert.equal(botCheckFailed(humanForm()), null);
});

test('rejects a filled honeypot', () => {
  const fd = humanForm();
  fd.set(HONEYPOT_FIELD, 'https://spam.example');
  assert.equal(botCheckFailed(fd), 'honeypot');
});

test('treats a whitespace-only honeypot as empty', () => {
  const fd = humanForm();
  fd.set(HONEYPOT_FIELD, '   ');
  assert.equal(botCheckFailed(fd), null);
});

test('rejects a missing start timestamp', () => {
  assert.equal(botCheckFailed(form([[HONEYPOT_FIELD, '']])), 'missing-timestamp');
});

test('rejects a non-numeric start timestamp', () => {
  const fd = form([
    [HONEYPOT_FIELD, ''],
    [FORM_STARTED_FIELD, 'not-a-number'],
  ]);
  assert.equal(botCheckFailed(fd), 'missing-timestamp');
});

test('rejects an impossibly fast submission', () => {
  const fd = form([
    [HONEYPOT_FIELD, ''],
    [FORM_STARTED_FIELD, String(Date.now())],
  ]);
  assert.equal(botCheckFailed(fd), 'too-fast');
});

test('rejects a stale submission (form left open for hours)', () => {
  const fd = form([
    [HONEYPOT_FIELD, ''],
    [FORM_STARTED_FIELD, String(Date.now() - 7 * 60 * 60 * 1000)],
  ]);
  assert.equal(botCheckFailed(fd), 'stale');
});

test('honeypot wins over a bad timestamp', () => {
  const fd = form([
    [HONEYPOT_FIELD, 'bot'],
    // no timestamp at all
  ]);
  assert.equal(botCheckFailed(fd), 'honeypot');
});
