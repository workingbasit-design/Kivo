import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTaxProvince } from '../property-tax.ts';

test('resolveTaxProvince: service property province wins over business region', () => {
  assert.equal(
    resolveTaxProvince({ propertyProvince: 'QC', businessTaxRegion: 'ON' }),
    'QC'
  );
  assert.equal(
    resolveTaxProvince({ propertyProvince: 'BC', businessTaxRegion: 'QC' }),
    'BC'
  );
});

test('resolveTaxProvince: no property falls back to business region', () => {
  assert.equal(
    resolveTaxProvince({ propertyProvince: null, businessTaxRegion: 'BC' }),
    'BC'
  );
  assert.equal(
    resolveTaxProvince({ propertyProvince: '', businessTaxRegion: 'QC' }),
    'QC'
  );
  assert.equal(
    resolveTaxProvince({ propertyProvince: undefined, businessTaxRegion: 'MB' }),
    'MB'
  );
});

test('resolveTaxProvince: junk property code falls through, never mis-taxes', () => {
  assert.equal(
    resolveTaxProvince({ propertyProvince: 'XX', businessTaxRegion: 'ON' }),
    'ON'
  );
  assert.equal(
    resolveTaxProvince({ propertyProvince: 'ONT', businessTaxRegion: 'BC' }),
    'BC'
  );
});

test('resolveTaxProvince: junk everywhere falls back to ON', () => {
  assert.equal(
    resolveTaxProvince({ propertyProvince: 'XX', businessTaxRegion: 'ZZ' }),
    'ON'
  );
  assert.equal(
    resolveTaxProvince({ propertyProvince: null, businessTaxRegion: null }),
    'ON'
  );
  assert.equal(resolveTaxProvince({}), 'ON');
});

test('resolveTaxProvince: normalises case and whitespace', () => {
  assert.equal(
    resolveTaxProvince({ propertyProvince: ' qc ', businessTaxRegion: 'ON' }),
    'QC'
  );
  assert.equal(
    resolveTaxProvince({ propertyProvince: null, businessTaxRegion: ' bc' }),
    'BC'
  );
});

// 2026-11-06 deep test: a Quebec customer's batch invoice was charged
// Ontario HST 13% because the job had no service property and the resolver
// fell straight through to the business region. The customer province is
// now the fallback between property and business region.
test('resolveTaxProvince: customer province fills in when the job has no property', () => {
  assert.equal(
    resolveTaxProvince({ propertyProvince: null, customerProvince: 'QC', businessTaxRegion: 'ON' }),
    'QC'
  );
  assert.equal(
    resolveTaxProvince({ propertyProvince: '', customerProvince: 'BC', businessTaxRegion: 'ON' }),
    'BC'
  );
  assert.equal(
    resolveTaxProvince({ propertyProvince: undefined, customerProvince: 'NS', businessTaxRegion: null }),
    'NS'
  );
});

test('resolveTaxProvince: property still wins over customer province', () => {
  assert.equal(
    resolveTaxProvince({ propertyProvince: 'BC', customerProvince: 'QC', businessTaxRegion: 'ON' }),
    'BC'
  );
});

test('resolveTaxProvince: customer province wins over business region', () => {
  assert.equal(
    resolveTaxProvince({ propertyProvince: null, customerProvince: 'QC', businessTaxRegion: 'BC' }),
    'QC'
  );
});

test('resolveTaxProvince: junk customer code falls through to business region', () => {
  assert.equal(
    resolveTaxProvince({ propertyProvince: null, customerProvince: 'XX', businessTaxRegion: 'MB' }),
    'MB'
  );
  assert.equal(
    resolveTaxProvince({ propertyProvince: 'XX', customerProvince: 'Quebec', businessTaxRegion: 'ON' }),
    'ON'
  );
});
