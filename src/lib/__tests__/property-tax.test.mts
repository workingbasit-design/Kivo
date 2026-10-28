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
