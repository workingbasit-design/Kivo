/**
 * E7 - first-run onboarding schema: valid and invalid answers.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  onboardingSchema,
  ONBOARDING_TRADES,
  ONBOARDING_TEAM_SIZES,
  ONBOARDING_PROVINCES,
} from '../validations.ts';

const okAnswers = { trade: 'plumbing', teamSize: '2-5', province: 'ON' };

test('E7: onboardingSchema accepts a complete valid answer set', () => {
  const parsed = onboardingSchema.safeParse(okAnswers);
  assert.ok(parsed.success);
  assert.deepEqual(parsed.data, okAnswers);
});

test('E7: onboardingSchema accepts every trade, team size and province', () => {
  for (const trade of ONBOARDING_TRADES) {
    assert.ok(
      onboardingSchema.safeParse({ ...okAnswers, trade }).success,
      `trade ${trade} rejected`
    );
  }
  for (const teamSize of ONBOARDING_TEAM_SIZES) {
    assert.ok(
      onboardingSchema.safeParse({ ...okAnswers, teamSize }).success,
      `teamSize ${teamSize} rejected`
    );
  }
  for (const province of ONBOARDING_PROVINCES) {
    assert.ok(
      onboardingSchema.safeParse({ ...okAnswers, province }).success,
      `province ${province} rejected`
    );
  }
});

test('E7: onboardingSchema rejects missing or invalid answers', () => {
  assert.ok(!onboardingSchema.safeParse({}).success, 'empty answers accepted');
  assert.ok(
    !onboardingSchema.safeParse({ teamSize: '1', province: 'ON' }).success,
    'missing trade accepted'
  );
  assert.ok(
    !onboardingSchema.safeParse({ ...okAnswers, trade: 'astronaut' }).success,
    'unknown trade accepted'
  );
  assert.ok(
    !onboardingSchema.safeParse({ ...okAnswers, teamSize: '100' }).success,
    'unknown team size accepted'
  );
  assert.ok(
    !onboardingSchema.safeParse({ ...okAnswers, province: 'XX' }).success,
    'unknown province accepted'
  );
});

test('E7: all 13 provinces and territories are offered', () => {
  assert.equal(ONBOARDING_PROVINCES.length, 13);
});
