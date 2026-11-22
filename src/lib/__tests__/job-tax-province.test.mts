/**
 * Job tax follows the place of supply (2026-11-22 deep test).
 *
 * The job detail page used to tax every job at the BUSINESS province, so
 * an Ontario business doing a $100 job for a Quebec customer showed
 * $113.00 of Ontario HST instead of $114.98 (GST $5.00 + QST $9.98).
 * The page now resolves the province exactly like the invoice paths do
 * (slice 2): service property province, else customer province, else
 * business region. These tests pin the composition the page uses —
 * resolveTaxProvince + getTaxConfig + calcTaxCents — on the reported
 * numbers, including the QST-on-price-excluding-GST rule.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getTaxConfig, calcTaxCents } from '../tax.ts';
import { resolveTaxProvince } from '../property-tax.ts';

/** Mirror of the job detail page's money block (integer cents). */
function jobTaxTotalCents(
  priceCents: number,
  opts: {
    propertyProvince?: string | null;
    customerProvince?: string | null;
    businessTaxRegion?: string | null;
  }
): { taxCents: number; totalCents: number; label: string } {
  const province = resolveTaxProvince({
    propertyProvince: opts.propertyProvince,
    customerProvince: opts.customerProvince,
    businessTaxRegion: opts.businessTaxRegion,
  });
  const taxConfig = getTaxConfig('CA', province);
  const taxRates = taxConfig.taxes.map((tx) => ({
    taxType: tx.name,
    rateBps: Math.round(tx.rate * 1000),
  }));
  const { taxCents } = calcTaxCents(priceCents, taxRates);
  return { taxCents, totalCents: priceCents + taxCents, label: taxConfig.label };
}

describe('job tax follows the place of supply', () => {
  it('Quebec customer, Ontario business, $100 job totals $114.98 (the reported defect)', () => {
    const { taxCents, totalCents, label } = jobTaxTotalCents(10000, {
      propertyProvince: null,
      customerProvince: 'QC',
      businessTaxRegion: 'ON',
    });
    assert.equal(label, 'GST 5% + QST 9.975%');
    assert.equal(taxCents, 1498);
    assert.equal(totalCents, 11498);
  });

  it('Ontario customer, Ontario business, $200 job totals $226.00', () => {
    const { taxCents, totalCents, label } = jobTaxTotalCents(20000, {
      propertyProvince: null,
      customerProvince: 'ON',
      businessTaxRegion: 'ON',
    });
    assert.equal(label, 'HST 13%');
    assert.equal(taxCents, 2600);
    assert.equal(totalCents, 22600);
  });

  it('service property province wins over the customer province', () => {
    const { taxCents, totalCents, label } = jobTaxTotalCents(10000, {
      propertyProvince: 'ON',
      customerProvince: 'QC',
      businessTaxRegion: 'ON',
    });
    assert.equal(label, 'HST 13%');
    assert.equal(taxCents, 1300);
    assert.equal(totalCents, 11300);
  });

  it('Quebec property beats an Ontario customer and business', () => {
    const { taxCents, totalCents } = jobTaxTotalCents(10000, {
      propertyProvince: 'QC',
      customerProvince: 'ON',
      businessTaxRegion: 'ON',
    });
    assert.equal(taxCents, 1498);
    assert.equal(totalCents, 11498);
  });

  it('no property and no customer province falls back to the business region', () => {
    const { taxCents, totalCents, label } = jobTaxTotalCents(10000, {
      propertyProvince: null,
      customerProvince: null,
      businessTaxRegion: 'BC',
    });
    assert.equal(label, 'GST 5% + PST 7%');
    assert.equal(taxCents, 1200);
    assert.equal(totalCents, 11200);
  });

  it('QST is 9.975% of the price excluding GST, never of the GST-inclusive price', () => {
    const province = resolveTaxProvince({
      customerProvince: 'QC',
      businessTaxRegion: 'ON',
    });
    const taxConfig = getTaxConfig('CA', province);
    const { breakdown } = calcTaxCents(
      10000,
      taxConfig.taxes.map((tx) => ({
        taxType: tx.name,
        rateBps: Math.round(tx.rate * 1000),
      }))
    );
    const qst = breakdown.find((b) => b.taxType === 'QST')!;
    // 9.975% of $100.00 = $9.98 (998c). The pre-2013 GST-inclusive base
    // ($105.00) would give $10.47 (1047c) — that rule is obsolete.
    assert.equal(qst.amountCents, 998);
    assert.notEqual(qst.amountCents, 1047);
  });
});
