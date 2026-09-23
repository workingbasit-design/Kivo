/**
 * Unit tests for the quote add-ons feature area:
 * - src/lib/quotes.ts — add-on total computation (base + selected only)
 * - src/lib/esign.ts — canonical doc-hash input builder with/without
 *   add-ons (backward compatibility: no add-ons → byte-identical payload)
 * - src/lib/routes.ts — Google Maps multi-stop URL builder (encoding,
 *   empty-address skipping)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { addonQuoteTotal } from '../quotes.ts';
import { signatureDocPayload, signatureDocHash } from '../esign.ts';
import { googleMapsRouteUrl } from '../routes.ts';

/* ---------------- add-on total computation ---------------- */

test('addonQuoteTotal: base total with no add-ons', () => {
  assert.equal(addonQuoteTotal(189.99, []), 189.99);
});

test('addonQuoteTotal: only selected add-ons add to the total', () => {
  const total = addonQuoteTotal(200, [
    { price: 49.99, selected: true },
    { price: 100, selected: false },
    { price: 25, selected: true },
  ]);
  assert.equal(total, 274.99);
});

test('addonQuoteTotal: rounds to cents', () => {
  // 0.1 + 0.2 style float drift must not leak into money display.
  const total = addonQuoteTotal(10, [
    { price: 0.1, selected: true },
    { price: 0.2, selected: true },
  ]);
  assert.equal(total, 10.3);
});

test('addonQuoteTotal: zero-price add-on does not change the total', () => {
  assert.equal(
    addonQuoteTotal(150, [{ price: 0, selected: true }]),
    150
  );
});

/* ---------------- canonical doc-hash input builder ---------------- */

const QUOTE = {
  id: 'quote-1',
  number: 'Q-1042',
  title: 'Furnace tune-up',
  total: 189.99,
  customerId: 'cust-1',
  businessId: 'biz-a',
};

const LEGACY_PAYLOAD = {
  quoteId: 'quote-1',
  number: 'Q-1042',
  title: 'Furnace tune-up',
  total: 189.99,
  customerId: 'cust-1',
  businessId: 'biz-a',
};

test('signatureDocPayload: quote without add-ons keeps the legacy shape', () => {
  assert.deepEqual(signatureDocPayload(QUOTE), LEGACY_PAYLOAD);
  assert.deepEqual(signatureDocPayload({ ...QUOTE, addons: [] }), LEGACY_PAYLOAD);
  assert.deepEqual(
    signatureDocPayload({
      ...QUOTE,
      addons: [{ title: 'Rush service', price: 49, selected: false }],
    }),
    LEGACY_PAYLOAD
  );
});

test('signatureDocHash: old signatures still verify when no add-ons selected', () => {
  // The exact hash a pre-add-on release stored for this quote.
  const legacyHash = createHash('sha256')
    .update(JSON.stringify(LEGACY_PAYLOAD), 'utf8')
    .digest('hex');
  assert.equal(signatureDocHash(QUOTE), legacyHash);
  assert.equal(
    signatureDocHash({ ...QUOTE, addons: [] }),
    legacyHash,
    'empty add-ons list must not change the hash'
  );
});

test('signatureDocPayload: includes only SELECTED add-ons, canonically ordered', () => {
  const payload = signatureDocPayload({
    ...QUOTE,
    addons: [
      { title: 'Zebra warranty', price: 99, selected: true },
      { title: 'Rush service', price: 49, selected: false },
      { title: 'Annual tune-up', price: 79, selected: true },
    ],
  });
  assert.deepEqual(payload.addons, [
    { title: 'Annual tune-up', price: 79 },
    { title: 'Zebra warranty', price: 99 },
  ]);
  assert.ok(!('selected' in (payload.addons?.[0] ?? {})), 'no selected flag leaks in');
});

test('signatureDocPayload: add-on order in input does not change the payload or hash', () => {
  const inputA = [
    { title: 'B', price: 20, selected: true },
    { title: 'A', price: 10, selected: true },
  ];
  const inputB = [
    { title: 'A', price: 10, selected: true },
    { title: 'B', price: 20, selected: true },
  ];
  assert.deepEqual(
    signatureDocPayload({ ...QUOTE, addons: inputA }),
    signatureDocPayload({ ...QUOTE, addons: inputB })
  );
  assert.equal(
    signatureDocHash({ ...QUOTE, addons: inputA }),
    signatureDocHash({ ...QUOTE, addons: inputB })
  );
});

test('signatureDocHash: selected add-ons change the hash (tamper evidence)', () => {
  const without = signatureDocHash(QUOTE);
  const withAddon = signatureDocHash({
    ...QUOTE,
    addons: [{ title: 'Rush service', price: 49, selected: true }],
  });
  assert.notEqual(withAddon, without);
  // Editing the price after selection also changes the hash.
  const edited = signatureDocHash({
    ...QUOTE,
    addons: [{ title: 'Rush service', price: 59, selected: true }],
  });
  assert.notEqual(edited, withAddon);
});

/* ---------------- Google Maps multi-stop URL builder ---------------- */

test('googleMapsRouteUrl: null when no stop has an address', () => {
  assert.equal(googleMapsRouteUrl([]), null);
  assert.equal(
    googleMapsRouteUrl([{ address: null }, { address: '  ' }, { address: '' }]),
    null
  );
});

test('googleMapsRouteUrl: single address becomes a destination link', () => {
  const url = googleMapsRouteUrl([{ address: '123 Main St, Toronto ON' }]);
  assert.equal(
    url,
    'https://www.google.com/maps/dir/?api=1&destination=123%20Main%20St%2C%20Toronto%20ON'
  );
});

test('googleMapsRouteUrl: multiple stops get origin, destination and waypoints', () => {
  const url = googleMapsRouteUrl([
    { address: '10 King St W, Toronto' },
    { address: null }, // skipped — no address on this job
    { address: '200 Queen St E, Toronto' },
    { address: '  ' }, // blank addresses are skipped too
    { address: '350 Bloor St W, Toronto' },
  ]);
  assert.equal(
    url,
    'https://www.google.com/maps/dir/?api=1' +
      '&origin=10%20King%20St%20W%2C%20Toronto' +
      '&destination=350%20Bloor%20St%20W%2C%20Toronto' +
      '&waypoints=200%20Queen%20St%20E%2C%20Toronto'
  );
});

test('googleMapsRouteUrl: two stops have no waypoints param', () => {
  const url = googleMapsRouteUrl([
    { address: '1 First Ave' },
    { address: '2 Second Ave' },
  ]);
  assert.ok(url?.includes('origin=1%20First%20Ave'));
  assert.ok(url?.includes('destination=2%20Second%20Ave'));
  assert.ok(!url?.includes('waypoints='));
});

test('googleMapsRouteUrl: encodes accents and special characters', () => {
  const url = googleMapsRouteUrl([
    { address: '1250 Rue Sainte-Catherine O, Montréal QC' },
    { address: '500 & Main #12, Québec' },
  ]);
  assert.ok(
    url?.includes('destination=500%20%26%20Main%20%2312%2C%20Qu%C3%A9bec'),
    `got: ${url}`
  );
  assert.ok(
    url?.includes('origin=1250%20Rue%20Sainte-Catherine%20O%2C%20Montr%C3%A9al%20QC'),
    `got: ${url}`
  );
});
