/**
 * Unit tests for import/export pure helpers added 2026-09-24:
 *  - customerDedupeKey / excelRowsToStrings (src/lib/csv.ts)
 *  - escapeCsvCell (src/lib/costing.ts), used by the export CSV builder
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/spreadsheet-io.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { customerDedupeKey, excelRowsToStrings } from '../csv.ts';
import { escapeCsvCell } from '../costing.ts';

test('customerDedupeKey matches on normalized email when present', () => {
  assert.equal(
    customerDedupeKey('Marie Tremblay', '514-555-0100', 'Marie@Example.ca'),
    'email:marie@example.ca'
  );
  // Same person, different phone/name still collides on email.
  assert.equal(
    customerDedupeKey('M. Tremblay', '438-555-9999', '  MARIE@example.ca '),
    'email:marie@example.ca'
  );
});

test('customerDedupeKey falls back to normalized name+digits of phone', () => {
  assert.equal(
    customerDedupeKey('Jean Côté', '(514) 555-0123', null),
    'np:jean côté|5145550123'
  );
  // Different email-less rows with same name+phone collide.
  assert.equal(
    customerDedupeKey('  jean CÔTÉ ', '5145550123', ''),
    'np:jean côté|5145550123'
  );
});

test('customerDedupeKey keeps email and email-less rows distinct', () => {
  const withEmail = customerDedupeKey('Marie Tremblay', '514-555-0100', 'marie@example.ca');
  const withoutEmail = customerDedupeKey('Marie Tremblay', '514-555-0100', null);
  assert.notEqual(withEmail, withoutEmail);
});

test('excelRowsToStrings trims, stringifies and drops blank rows', () => {
  assert.deepEqual(
    excelRowsToStrings([
      ['name', 'price', 'email'],
      ['  Drain cleaning ', 120, null],
      ['', '', ''],
      ['Leak repair', 99.5, 'a@b.ca'],
      [],
    ]),
    [
      ['name', 'price', 'email'],
      ['Drain cleaning', '120', ''],
      ['Leak repair', '99.5', 'a@b.ca'],
    ]
  );
});

test('escapeCsvCell quotes only when needed', () => {
  assert.equal(escapeCsvCell('simple'), 'simple');
  assert.equal(escapeCsvCell('with, comma'), '"with, comma"');
  assert.equal(escapeCsvCell('say "hi"'), '"say ""hi"""');
  assert.equal(escapeCsvCell('line\nbreak'), '"line\nbreak"');
  assert.equal(escapeCsvCell(null), '');
  assert.equal(escapeCsvCell(250.5), '250.5');
});
