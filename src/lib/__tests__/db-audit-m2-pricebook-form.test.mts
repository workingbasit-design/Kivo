/**
 * DB-audit m2 (2026-11-11 audit, implemented 2026-11-13).
 *
 * Service columns nameFr, descriptionFr, category, unit, kind, taxCategory,
 * costCents existed in the schema but no form ever wrote them — the
 * job-detail picker reads (nameFr/category) always returned null, and the
 * F6 i18n fragment (pricebook.*) was never imported into fragments.ts, so
 * its labels never resolved. Each test fails on the pre-fix code.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serviceSchema } from '../validations.ts';
import { t } from '../i18n/index.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const read = (rel: string) => readFileSync(`${root}${rel}`, 'utf8');
const readCode = (rel: string) =>
  read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const BASE = { name: 'Drain cleaning', price: 149 };

describe('m2 - serviceSchema accepts the price-book fields', () => {
  it('parses all seven new fields', () => {
    const parsed = serviceSchema.safeParse({
      ...BASE,
      nameFr: 'Nettoyage de drain',
      descriptionFr: 'Débouche les drains',
      category: 'Plumbing',
      unit: 'hour',
      kind: 'PRODUCT',
      taxCategory: 'TAXABLE_QST',
      cost: '56',
    });
    assert.equal(parsed.success, true, JSON.stringify(parsed.error?.issues));
    if (!parsed.success) return;
    assert.equal(parsed.data.nameFr, 'Nettoyage de drain');
    assert.equal(parsed.data.descriptionFr, 'Débouche les drains');
    assert.equal(parsed.data.category, 'Plumbing');
    assert.equal(parsed.data.unit, 'hour');
    assert.equal(parsed.data.kind, 'PRODUCT');
    assert.equal(parsed.data.taxCategory, 'TAXABLE_QST');
    assert.equal(parsed.data.cost, 56);
  });

  it('blank / missing new fields fall back to schema defaults', () => {
    const parsed = serviceSchema.safeParse(BASE);
    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    assert.equal(parsed.data.nameFr, '');
    assert.equal(parsed.data.descriptionFr, '');
    assert.equal(parsed.data.category, '');
    assert.equal(parsed.data.unit, 'each');
    assert.equal(parsed.data.kind, 'SERVICE');
    assert.equal(parsed.data.taxCategory, 'TAXABLE_GST_HST');
    assert.equal(parsed.data.cost, undefined);
  });

  it('rejects invalid enum values and a negative cost', () => {
    assert.equal(serviceSchema.safeParse({ ...BASE, unit: 'litre' }).success, false);
    assert.equal(serviceSchema.safeParse({ ...BASE, kind: 'LABOUR' }).success, false);
    assert.equal(
      serviceSchema.safeParse({ ...BASE, taxCategory: 'TAXABLE_HST' }).success,
      false
    );
    assert.equal(serviceSchema.safeParse({ ...BASE, cost: '-1' }).success, false);
    assert.equal(
      serviceSchema.safeParse({ ...BASE, nameFr: 'x'.repeat(201) }).success,
      false
    );
  });
});

describe('m2 - actions read and persist the fields', () => {
  it('createService and updateService take all seven fields from the form', () => {
    const action = readCode('src/app/actions/services.ts');
    for (const field of [
      'nameFr',
      'descriptionFr',
      'category',
      'unit',
      'kind',
      'taxCategory',
      'cost',
    ]) {
      assert.match(action, new RegExp(`formData\\.get\\('${field}'\\)`));
    }
    // Both writes persist them (create + update).
    const persistMatches = action.match(/nameFr: nullIfBlank\(data\.nameFr\)/g) ?? [];
    assert.equal(persistMatches.length, 2, 'nameFr persisted in create + update');
    assert.match(action, /costCents: data\.cost === undefined \? null/);
    assert.match(action, /unit: data\.unit/);
    assert.match(action, /kind: data\.kind/);
    assert.match(action, /taxCategory: data\.taxCategory/);
  });
});

describe('m2 - price-book page selects the fields', () => {
  it('the page query selects all seven columns and maps them to the client', () => {
    const page = readCode('src/app/(app)/pricebook/page.tsx');
    for (const col of [
      'nameFr',
      'descriptionFr',
      'category',
      'unit',
      'kind',
      'taxCategory',
      'costCents',
    ]) {
      assert.match(page, new RegExp(`${col}: true`));
    }
    assert.match(page, /cost: s\.costCents == null \? null : centsToDollars\(s\.costCents\)/);
    assert.match(page, /nameFr: s\.nameFr/);
    assert.match(page, /category: s\.category/);
  });
});

describe('m2 - price-book client renders and submits the fields', () => {
  it('the add/edit sheet has inputs for every field', () => {
    const client = readCode('src/components/PriceBookClient.tsx');
    assert.match(client, /value=\{nameFr\}/);
    assert.match(client, /value=\{descriptionFr\}/);
    assert.match(client, /value=\{category\}/);
    assert.match(client, /name="kind"/);
    assert.match(client, /name="unit"/);
    assert.match(client, /name="taxCategory"/);
    assert.match(client, /value=\{cost\}/);
    // Native kit selects (controlled) so Playwright selectOption works.
    assert.match(client, /<Select/);
    // Submit sends them all.
    for (const field of [
      'nameFr',
      'descriptionFr',
      'category',
      'unit',
      'kind',
      'taxCategory',
      'cost',
    ]) {
      assert.match(client, new RegExp(`fd\\.append\\('${field}', ${field}\\)`));
    }
  });

  it('the card shows the localized name, category and margin', () => {
    const client = readCode('src/components/PriceBookClient.tsx');
    assert.match(client, /displayName\(service, loc\)/);
    assert.match(client, /displayDescription\(service, loc\)/);
    assert.match(client, /needsTranslation/);
    assert.match(client, /service\.category/);
    assert.match(client, /calcMargin\(Math\.round\(service\.price \* 100\)/);
    assert.match(client, /marginLabel/);
  });
});

describe('m2 - F6 i18n fragment is wired in (no longer orphaned)', () => {
  it('fragments.ts imports the pricebook fragment', () => {
    const fragments = readCode('src/lib/i18n/fragments.ts');
    assert.match(fragments, /import pricebook from '\.\/fragments\/pricebook\.ts'/);
    assert.match(fragments, /errorsFrag, pricebook\]/);
  });

  it('every label the client uses resolves in both locales', () => {
    const keys = [
      'pricebook.nameFrLabel',
      'pricebook.nameFrPlaceholder',
      'pricebook.nameFrHint',
      'pricebook.descriptionFrLabel',
      'pricebook.kindLabel',
      'pricebook.kindService',
      'pricebook.kindProduct',
      'pricebook.unitLabel',
      'pricebook.unitEach',
      'pricebook.unitHour',
      'pricebook.unitJob',
      'pricebook.unitSqft',
      'pricebook.costLabel',
      'pricebook.costHint',
      'pricebook.taxCategoryLabel',
      'pricebook.taxGstHst',
      'pricebook.taxPst',
      'pricebook.taxQst',
      'pricebook.taxExempt',
      'pricebook.categoryLabel',
      'pricebook.categoryPlaceholder',
      'pricebook.categoryHint',
      'pricebook.marginLabel',
      'pricebook.needsTranslation',
    ];
    for (const locale of ['en', 'fr'] as const) {
      for (const key of keys) {
        const value = t(locale, key);
        assert.notEqual(value, key, `${locale}.${key} did not resolve`);
        assert.ok(value.length > 0, `${locale}.${key} is empty`);
      }
    }
  });
});
