/**
 * Tests for the report builder intent parser (src/lib/reports.ts).
 * Pure functions only — parseReportPrompt(Detailed) and resolveDateRange.
 * runReport hits the DB and is covered by integration checks, not unit tests.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseReportPrompt,
  parseReportPromptDetailed,
  resolveDateRange,
} from '../reports.ts';

test('EN: revenue by month, last 30 days', () => {
  const c = parseReportPrompt('Revenue by month for the last 30 days');
  assert.equal(c.type, 'revenue');
  assert.equal(c.groupBy, 'month');
  assert.equal(c.dateRange, 'last_30');
  assert.equal(c.metric, 'total');
});

test('EN: expenses by category this year', () => {
  const c = parseReportPrompt('Expenses by category this year');
  assert.equal(c.type, 'expenses');
  assert.equal(c.groupBy, 'category');
  assert.equal(c.dateRange, 'this_year');
});

test('EN: jobs by status this month', () => {
  const c = parseReportPrompt('Jobs by status this month');
  assert.equal(c.type, 'jobs');
  assert.equal(c.groupBy, 'status');
  assert.equal(c.dateRange, 'this_month');
});

test('EN: "how many quotes" -> quotes, count metric', () => {
  const c = parseReportPrompt('How many quotes did we send last month?');
  assert.equal(c.type, 'quotes');
  assert.equal(c.metric, 'count');
  assert.equal(c.dateRange, 'last_month');
  assert.equal(c.groupBy, 'status'); // natural default for quotes
});

test('EN: average job value', () => {
  const c = parseReportPrompt('Average job value this year');
  assert.equal(c.type, 'jobs');
  assert.equal(c.metric, 'average');
  assert.equal(c.dateRange, 'this_year');
});

test('EN: invoices default to status grouping', () => {
  const c = parseReportPrompt('invoices from last month');
  assert.equal(c.type, 'invoices');
  assert.equal(c.groupBy, 'status');
});

test('FR: revenus par mois (accents stripped)', () => {
  const c = parseReportPrompt('Revenus par mois pour les 30 derniers jours');
  assert.equal(c.type, 'revenue');
  assert.equal(c.groupBy, 'month');
  assert.equal(c.dateRange, 'last_30');
});

test('FR: dépenses par catégorie cette année', () => {
  const c = parseReportPrompt('Dépenses par catégorie cette année');
  assert.equal(c.type, 'expenses');
  assert.equal(c.groupBy, 'category');
  assert.equal(c.dateRange, 'this_year');
});

test('FR: jobs par statut ce mois-ci', () => {
  const c = parseReportPrompt('Jobs par statut ce mois-ci');
  assert.equal(c.type, 'jobs');
  assert.equal(c.groupBy, 'status');
  assert.equal(c.dateRange, 'this_month');
});

test('FR: combien de devis le mois dernier', () => {
  const c = parseReportPrompt('Combien de devis avons-nous envoyés le mois dernier ?');
  assert.equal(c.type, 'quotes');
  assert.equal(c.metric, 'count');
  assert.equal(c.dateRange, 'last_month');
});

test('FR: factures impayées -> invoices', () => {
  const c = parseReportPrompt('factures impayées');
  assert.equal(c.type, 'invoices');
});

test('vague prompt defaults to revenue/month/last_30 and flags defaulted', () => {
  const { config, defaulted } = parseReportPromptDetailed('show me stuff');
  assert.equal(defaulted, true);
  assert.equal(config.type, 'revenue');
  assert.equal(config.groupBy, 'month');
  assert.equal(config.dateRange, 'last_30');
  assert.equal(config.metric, 'total');
});

test('detailed: detected type is not defaulted', () => {
  const { defaulted } = parseReportPromptDetailed('expenses by month');
  assert.equal(defaulted, false);
});

test('incompatible groupBy falls back to the natural default', () => {
  // categories only make sense for expenses
  const c = parseReportPrompt('revenue by category this month');
  assert.equal(c.type, 'revenue');
  assert.equal(c.groupBy, 'month');
});

test('customers default to the count metric', () => {
  const c = parseReportPrompt('new customers this year');
  assert.equal(c.type, 'customers');
  assert.equal(c.metric, 'count');
  assert.equal(c.groupBy, 'none');
});

test('resolveDateRange: this_month starts on the 1st', () => {
  const now = new Date(2026, 9, 13, 12, 0, 0); // Oct 13 2026 local
  const b = resolveDateRange('this_month', now)!;
  assert.equal(b.from.getFullYear(), 2026);
  assert.equal(b.from.getMonth(), 9);
  assert.equal(b.from.getDate(), 1);
  assert.equal(b.to.getTime(), now.getTime());
});

test('resolveDateRange: last_month is the full previous month', () => {
  const now = new Date(2026, 9, 13, 12, 0, 0);
  const b = resolveDateRange('last_month', now)!;
  assert.equal(b.from.getMonth(), 8); // September
  assert.equal(b.from.getDate(), 1);
  assert.equal(b.to.getMonth(), 9); // Oct 1
  assert.equal(b.to.getDate(), 1);
});

test('resolveDateRange: last_30 is 30 days back', () => {
  const now = new Date(2026, 9, 13, 12, 0, 0);
  const b = resolveDateRange('last_30', now)!;
  assert.equal(b.to.getTime(), now.getTime());
  assert.equal(b.from.getTime(), now.getTime() - 30 * 86_400_000);
});

test('resolveDateRange: this_year starts Jan 1', () => {
  const now = new Date(2026, 9, 13, 12, 0, 0);
  const b = resolveDateRange('this_year', now)!;
  assert.equal(b.from.getMonth(), 0);
  assert.equal(b.from.getDate(), 1);
});

test('resolveDateRange: all returns null (no filter)', () => {
  assert.equal(resolveDateRange('all'), null);
});
