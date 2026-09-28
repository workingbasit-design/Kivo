/**
 * Unit tests for job status transition rules (src/lib/job-status.ts).
 * No DB, no network.
 * Run: node --test src/lib/__tests__/job-status.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidTransition,
  validNextStatuses,
  previousPipelineStatus,
} from '@/lib/job-status.ts';

test('forward pipeline moves are allowed', () => {
  assert.equal(isValidTransition('NEW', 'SCHEDULED'), true);
  assert.equal(isValidTransition('SCHEDULED', 'IN PROGRESS'), true);
  assert.equal(isValidTransition('IN PROGRESS', 'COMPLETED'), true);
  assert.equal(isValidTransition('COMPLETED', 'PAID'), true);
  // Multi-step forward jumps are allowed.
  assert.equal(isValidTransition('NEW', 'COMPLETED'), true);
});

test('one step back is allowed (mistake undo)', () => {
  assert.equal(isValidTransition('SCHEDULED', 'NEW'), true);
  assert.equal(isValidTransition('IN PROGRESS', 'SCHEDULED'), true);
  assert.equal(isValidTransition('COMPLETED', 'IN PROGRESS'), true);
  assert.equal(isValidTransition('PAID', 'COMPLETED'), true);
});

test('jumping back more than one step is rejected', () => {
  assert.equal(isValidTransition('COMPLETED', 'SCHEDULED'), false);
  assert.equal(isValidTransition('COMPLETED', 'NEW'), false);
  assert.equal(isValidTransition('PAID', 'IN PROGRESS'), false);
  assert.equal(isValidTransition('PAID', 'NEW'), false);
  assert.equal(isValidTransition('IN PROGRESS', 'NEW'), false);
});

test('CANCELLED rules', () => {
  // Cancellable from anywhere except PAID/CANCELLED.
  assert.equal(isValidTransition('NEW', 'CANCELLED'), true);
  assert.equal(isValidTransition('COMPLETED', 'CANCELLED'), true);
  assert.equal(isValidTransition('PAID', 'CANCELLED'), false);
  assert.equal(isValidTransition('CANCELLED', 'CANCELLED'), true); // no-op
  // Reopen only as NEW or SCHEDULED.
  assert.equal(isValidTransition('CANCELLED', 'NEW'), true);
  assert.equal(isValidTransition('CANCELLED', 'SCHEDULED'), true);
  assert.equal(isValidTransition('CANCELLED', 'IN PROGRESS'), false);
  assert.equal(isValidTransition('CANCELLED', 'COMPLETED'), false);
});

test('same-status is a harmless no-op', () => {
  assert.equal(isValidTransition('SCHEDULED', 'SCHEDULED'), true);
  assert.equal(isValidTransition('PAID', 'PAID'), true);
});

test('unknown statuses are rejected', () => {
  assert.equal(isValidTransition('NEW', 'BOGUS'), false);
  assert.equal(isValidTransition('BOGUS', 'SCHEDULED'), false);
});

test('previousPipelineStatus returns the undo target', () => {
  assert.equal(previousPipelineStatus('PAID'), 'COMPLETED');
  assert.equal(previousPipelineStatus('COMPLETED'), 'IN PROGRESS');
  assert.equal(previousPipelineStatus('IN PROGRESS'), 'SCHEDULED');
  assert.equal(previousPipelineStatus('SCHEDULED'), 'NEW');
  assert.equal(previousPipelineStatus('NEW'), null);
  assert.equal(previousPipelineStatus('CANCELLED'), null);
});

test('validNextStatuses includes the one-step undo', () => {
  const next = validNextStatuses('COMPLETED');
  assert.ok(next.includes('PAID'), 'forward move present');
  assert.ok(next.includes('IN PROGRESS'), 'undo move present');
  assert.ok(next.includes('CANCELLED'), 'cancel present');
  assert.ok(!next.includes('SCHEDULED'), 'two-step back absent');
  assert.ok(!next.includes('NEW'), 'three-step back absent');
});
