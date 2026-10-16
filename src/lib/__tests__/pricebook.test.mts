/**
 * F6 Price Book — unit tests for pure helpers (src/lib/pricebook.ts).
 *
 * F6-001: margin calc (incl. null cost → hidden).
 * F6-002: tax category → correct tax lines via calcTax.
 * Plus: displayName/displayDescription bilingual fallback, i18n parity.
 * No DB, no network.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  applicableTaxes,
  calcMargin,
  displayDescription,
  displayName,
  PRICEBOOK_KINDS,
  PRICEBOOK_TAX_CATEGORIES,
  PRICEBOOK_UNITS,
} from '../pricebook.ts';
import { calcTax } from '../tax.ts';
import fragment from '../i18n/fragments/pricebook.ts';

describe('F6-001: calcMargin', () => {
  test('computes amount and percent', () => {
    const m = calcMargin(14900, 5600);
    assert.ok(m);
    assert.equal(m.amountCents, 9300);
    assert.ok(Math.abs(m.percent - 62.416) < 0.01);
  });

  test('null cost → null (margin hidden, never 100%)', () => {
    assert.equal(calcMargin(14900, null), null);
    assert.equal(calcMargin(14900, undefined), null);
  });

  test('zero price → 0% (no division by zero)', () => {
    const m = calcMargin(0, 0);
    assert.ok(m);
    assert.equal(m.percent, 0);
    assert.equal(m.amountCents, 0);
  });

  test('cost above price → negative margin', () => {
    const m = calcMargin(10000, 12000);
    assert.ok(m);
    assert.equal(m.amountCents, -2000);
    assert.ok(m.percent < 0);
  });

  test('accepts BigInt cents (Prisma shape)', () => {
    const m = calcMargin(BigInt(14900), BigInt(5600));
    assert.ok(m);
    assert.equal(m.amountCents, 9300);
  });

  test('zero cost → 100% margin', () => {
    const m = calcMargin(14900, 0);
    assert.ok(m);
    assert.equal(m.percent, 100);
  });
});

describe('F6-002: tax category → tax lines via calcTax', () => {
  // Ontario config: HST 13%. Quebec: GST 5% + QST 9.975%. BC: GST 5% + PST 7%.
  const onTaxes = [{ name: 'HST', rate: 13 }];
  const qcTaxes = [
    { name: 'GST', rate: 5 },
    { name: 'QST', rate: 9.975 },
  ];
  const bcTaxes = [
    { name: 'GST', rate: 5 },
    { name: 'PST', rate: 7 },
  ];

  test('TAXABLE_GST_HST in Ontario → HST only', () => {
    const lines = applicableTaxes('TAXABLE_GST_HST', onTaxes);
    assert.deepEqual(lines.map((l) => l.name), ['HST']);
    const { taxAmount } = calcTax(100, { taxes: lines });
    assert.equal(taxAmount, 13);
  });

  test('TAXABLE_GST_HST in BC → GST only (PST excluded)', () => {
    const lines = applicableTaxes('TAXABLE_GST_HST', bcTaxes);
    assert.deepEqual(lines.map((l) => l.name), ['GST']);
  });

  test('TAXABLE_PST in BC → PST only', () => {
    const lines = applicableTaxes('TAXABLE_PST', bcTaxes);
    assert.deepEqual(lines.map((l) => l.name), ['PST']);
    const { taxAmount } = calcTax(100, { taxes: lines });
    assert.equal(taxAmount, 7);
  });

  test('TAXABLE_QST in Quebec → QST only (stacks on GST at doc level)', () => {
    const lines = applicableTaxes('TAXABLE_QST', qcTaxes);
    assert.deepEqual(lines.map((l) => l.name), ['QST']);
    const { taxAmount } = calcTax(100, { taxes: lines });
    assert.equal(taxAmount, 9.98); // 9.975 rounded to cents
  });

  test('EXEMPT → no tax lines', () => {
    for (const taxes of [onTaxes, qcTaxes, bcTaxes]) {
      assert.deepEqual(applicableTaxes('EXEMPT', taxes), []);
    }
    const { taxAmount } = calcTax(100, { taxes: [] });
    assert.equal(taxAmount, 0);
  });

  test('unknown category → no lines (fail-closed)', () => {
    assert.deepEqual(applicableTaxes('BOGUS', onTaxes), []);
  });
});

describe('F6: bilingual display fallback', () => {
  test('fr with nameFr → French name, no flag', () => {
    const d = displayName({ name: 'Drain cleaning', nameFr: 'Nettoyage de drain' }, 'fr');
    assert.deepEqual(d, { text: 'Nettoyage de drain', needsTranslation: false });
  });

  test('fr without nameFr → English fallback + needsTranslation', () => {
    const d = displayName({ name: 'Drain cleaning', nameFr: null }, 'fr');
    assert.deepEqual(d, { text: 'Drain cleaning', needsTranslation: true });
  });

  test('fr with blank nameFr → fallback + flag', () => {
    const d = displayName({ name: 'Drain cleaning', nameFr: '  ' }, 'fr');
    assert.deepEqual(d, { text: 'Drain cleaning', needsTranslation: true });
  });

  test('en always → English, never flagged', () => {
    const d = displayName({ name: 'Drain cleaning', nameFr: 'Nettoyage de drain' }, 'en');
    assert.deepEqual(d, { text: 'Drain cleaning', needsTranslation: false });
  });

  test('displayDescription fr fallback', () => {
    assert.equal(
      displayDescription({ description: 'Clears drains', descriptionFr: null }, 'fr'),
      'Clears drains'
    );
    assert.equal(
      displayDescription(
        { description: 'Clears drains', descriptionFr: 'Débouche les drains' },
        'fr'
      ),
      'Débouche les drains'
    );
    assert.equal(
      displayDescription({ description: null, descriptionFr: null }, 'en'),
      null
    );
  });
});

describe('F6: constants', () => {
  test('kinds, units, tax categories match spec', () => {
    assert.deepEqual([...PRICEBOOK_KINDS], ['SERVICE', 'PRODUCT']);
    assert.deepEqual([...PRICEBOOK_UNITS], ['each', 'hour', 'job', 'sqft']);
    assert.deepEqual([...PRICEBOOK_TAX_CATEGORIES], [
      'TAXABLE_GST_HST',
      'TAXABLE_PST',
      'TAXABLE_QST',
      'EXEMPT',
    ]);
  });
});

describe('F6: i18n fragment parity (en + fr)', () => {
  test('every en key exists in fr and vice versa', () => {
    const enKeys = Object.keys(fragment.en.pricebook ?? {}).sort();
    const frKeys = Object.keys(fragment.fr.pricebook ?? {}).sort();
    assert.ok(enKeys.length > 20, `expected 20+ keys, got ${enKeys.length}`);
    assert.deepEqual(frKeys, enKeys);
    for (const k of enKeys) {
      const v = (fragment.fr.pricebook as Record<string, unknown>)[k];
      assert.ok(typeof v === 'string' && v.length > 0, `fr.pricebook.${k} missing/empty`);
    }
  });
});
