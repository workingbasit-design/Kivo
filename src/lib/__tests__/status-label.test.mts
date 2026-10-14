/**
 * Regression (2026-10-11 morning QA): FR locale spot-check found English
 * leakage in status badges - the FR dashboard showed "SCHEDULED" and the FR
 * invoices page showed "ALL/UNPAID/PARTIALLY PAID/PAID" tabs. StatusBadge now
 * localizes via statusLabel() + the `statuses` dictionary section.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { statusLabel } from '../utils.ts';

const CASES: Array<[string, string, string]> = [
  ['SCHEDULED', 'en', 'Scheduled'],
  ['SCHEDULED', 'fr', 'Planifié'],
  ['PAID', 'en', 'Paid'],
  ['PAID', 'fr', 'Payé'],
  ['UNPAID', 'en', 'Unpaid'],
  ['UNPAID', 'fr', 'Impayé'],
  ['PARTIALLY PAID', 'en', 'Partially paid'],
  ['PARTIALLY PAID', 'fr', 'Partiellement payé'],
  ['IN PROGRESS', 'fr', 'En cours'],
  ['COMPLETED', 'fr', 'Terminé'],
  ['OVERDUE', 'fr', 'En retard'],
  ['ALL', 'fr', 'Tous'],
  ['DRAFT', 'fr', 'Brouillon'],
];

for (const [status, locale, expected] of CASES) {
  test(`statusLabel("${status}", "${locale}") is "${expected}"`, () => {
    assert.equal(statusLabel(status, locale as 'en' | 'fr'), expected);
  });
}

test('statusLabel falls back to the raw status for unknown values', () => {
  assert.equal(statusLabel('SOMETHING_NEW', 'fr'), 'SOMETHING_NEW');
  assert.equal(statusLabel('SOMETHING_NEW', 'en'), 'SOMETHING_NEW');
});

test('statusLabel never returns a raw i18n key path', () => {
  for (const [status, locale] of CASES.map(([s, l]) => [s, l] as const)) {
    const label = statusLabel(status, locale as 'en' | 'fr');
    assert.ok(!label.includes('statuses.'), `label "${label}" leaks a key path`);
  }
});
