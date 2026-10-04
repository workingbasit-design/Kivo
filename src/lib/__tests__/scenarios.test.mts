/**
 * Tests for the what-if scenario arithmetic (src/lib/scenarios.ts).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeScenarios } from '../scenarios.ts';

test('revenue drop 10% projects from the monthly average', () => {
  const s = computeScenarios({ revenue90d: 90000, jobs90d: 90, teamSize: 3 });
  assert.equal(s.monthlyRevenue, 30000);
  assert.equal(s.revenueDrop.projected, 27000);
  assert.equal(s.revenueDrop.shortfall, 3000);
});

test('price rise 5% scales with average job value and volume', () => {
  const s = computeScenarios({ revenue90d: 90000, jobs90d: 90, teamSize: 3 });
  assert.equal(s.avgJobValue, 1000);
  assert.equal(s.priceRise.extraPerJob, 50);
  assert.equal(s.priceRise.monthlyUpside, 1500); // 30 jobs/mo * $1000 * 5%
});

test('hire-a-tech models capacity from the current average', () => {
  const s = computeScenarios({ revenue90d: 90000, jobs90d: 90, teamSize: 3 });
  assert.equal(s.hireTech.jobsPerTechPerMonth, 10);
  assert.equal(s.hireTech.extraCapacityJobs, 10);
  assert.equal(s.hireTech.revenuePotential, 10000);
});

test('empty business degrades gracefully to nulls, not NaN', () => {
  const s = computeScenarios({ revenue90d: 0, jobs90d: 0, teamSize: 0 });
  assert.equal(s.monthlyRevenue, 0);
  assert.equal(s.hireTech.jobsPerTechPerMonth, null);
  assert.equal(s.hireTech.revenuePotential, null);
  assert.ok(Number.isFinite(s.priceRise.monthlyUpside));
});
