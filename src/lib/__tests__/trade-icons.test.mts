import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TRADE_KEYS,
  TRADE_ICON_COMPONENTS,
  isTradeKey,
  tradeKeyForService,
} from '../trade-icons.ts';

test('trade-icons: every trade key has an icon component mapping', () => {
  for (const key of TRADE_KEYS) {
    assert.ok(
      TRADE_ICON_COMPONENTS[key],
      `missing icon component for trade "${key}"`
    );
  }
});

test('trade-icons: isTradeKey validates the fixed key set', () => {
  assert.equal(isTradeKey('cleaning'), true);
  assert.equal(isTradeKey('general'), true);
  assert.equal(isTradeKey('plumbing'), true);
  assert.equal(isTradeKey('nope'), false);
  assert.equal(isTradeKey(''), false);
  assert.equal(isTradeKey(null), false);
});

test('trade-icons: owner override wins over auto-detection', () => {
  assert.equal(
    tradeKeyForService({ name: 'Furnace tune-up', iconKey: 'windows' }),
    'windows'
  );
  // Invalid override falls back to auto-detection, never throws.
  assert.equal(
    tradeKeyForService({ name: 'Furnace tune-up', iconKey: 'bogus' }),
    'furnace'
  );
});

test('trade-icons: keyword auto-detection (EN + FR)', () => {
  const cases: Array<[string, string]> = [
    ['Deep clean, 3 bedroom', 'cleaning'],
    ['Nettoyage après construction', 'cleaning'],
    ['Gutter cleaning', 'gutters'],
    ['Nettoyage de gouttières', 'gutters'],
    ['Furnace tune-up', 'furnace'],
    ['Mise au point de fournaise', 'furnace'],
    ['Window washing', 'windows'],
    ['Lavage de vitres', 'windows'],
    ['Plumbing leak fix', 'plumbing'],
    ['Réparation de plomberie', 'plumbing'],
    ['Electrical panel upgrade', 'electrical'],
    ['Lawn mowing', 'landscaping'],
    ['Snow removal', 'snow'],
    ['Déneigement entrée', 'snow'],
    ['Interior painting', 'painting'],
    ['Drywall repair', 'painting'],
  ];
  for (const [name, expected] of cases) {
    assert.equal(tradeKeyForService({ name }), expected, name);
  }
});

test('trade-icons: unknown names fall back to general (handyman)', () => {
  assert.equal(tradeKeyForService({ name: 'Mystery service xyz' }), 'general');
  assert.equal(tradeKeyForService({ name: '' }), 'general');
});

test('trade-icons: category and French name feed detection', () => {
  assert.equal(
    tradeKeyForService({ name: 'Visit', category: 'Plumbing' }),
    'plumbing'
  );
  assert.equal(
    tradeKeyForService({ name: 'Visite', nameFr: 'Lavage de vitres' }),
    'windows'
  );
});
