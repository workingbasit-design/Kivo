/**
 * Unit tests for the profile strength score (src/lib/profile-strength.ts).
 * The score must be 100 for a fully complete profile, 0 for an empty one,
 * and deterministic — it only ever reflects the business's own data.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeProfileStrength,
  nextStrengthActions,
  type StrengthInput,
} from '../profile-strength.ts';

const full: StrengthInput = {
  name: 'Maple Leaf Plumbing',
  phone: '416-555-0100',
  address: '123 King St, Toronto',
  workingHours: '{"mon":["09:00","17:00"]}',
  logoUrl: 'https://example.com/logo.png',
  trade: 'plumbing',
  province: 'ON',
  yearsInBusiness: 12,
  specialties: ['Drain repair'],
  interacEmail: 'pay@example.ca',
  taxId: null,
  directoryOptIn: true,
  bookingPageActive: true,
  serviceCount: 5,
  designationCount: 4,
  teamMemberCount: 3,
};

const empty: StrengthInput = {
  name: '',
  phone: null,
  address: null,
  workingHours: null,
  logoUrl: null,
  trade: null,
  province: null,
  yearsInBusiness: null,
  specialties: [],
  interacEmail: null,
  taxId: null,
  directoryOptIn: false,
  bookingPageActive: false,
  serviceCount: 0,
  designationCount: 0,
  teamMemberCount: 1,
};

test('complete profile scores 100 with no next actions', () => {
  const { score, checks } = computeProfileStrength(full);
  assert.equal(score, 100);
  assert.equal(nextStrengthActions(checks).length, 0);
});

test('empty profile scores 0 and lists every check as a next action', () => {
  const { score, checks } = computeProfileStrength(empty);
  assert.equal(score, 0);
  assert.equal(nextStrengthActions(checks).length, checks.length);
  assert.ok(checks.length > 10, 'should have a meaningful checklist');
});

test('score is the sum of done check weights', () => {
  const { score, checks } = computeProfileStrength({ ...empty, phone: '416-555-0100', trade: 'hvac' });
  const expected = checks.filter((c) => c.done).reduce((s, c) => s + c.weight, 0);
  assert.equal(score, expected);
  assert.equal(score, 10); // phone 5 + trade 5
});

test('partial progress: services and designations tier correctly', () => {
  const one = computeProfileStrength({ ...empty, serviceCount: 1, designationCount: 1 });
  assert.equal(one.score, 20); // servicesOne 10 + designationOne 10
  const three = computeProfileStrength({ ...empty, serviceCount: 3, designationCount: 3 });
  assert.equal(three.score, 30); // +5 each for the second tier
});

test('next actions are sorted by weight, highest first', () => {
  const { checks } = computeProfileStrength(empty);
  const actions = nextStrengthActions(checks);
  for (let i = 1; i < actions.length; i++) {
    assert.ok(actions[i - 1].weight >= actions[i].weight, 'not sorted by weight desc');
  }
});

test('score is deterministic across runs', () => {
  const a = computeProfileStrength(full).score;
  const b = computeProfileStrength(full).score;
  assert.equal(a, b);
});
