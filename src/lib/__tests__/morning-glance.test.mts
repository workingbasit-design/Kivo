import test from 'node:test';
import assert from 'node:assert/strict';
import { selectFirstUpcoming } from '../morning-glance.ts';

const job = (over: Record<string, unknown>) => ({
  id: 'j',
  title: 'Job',
  time: null,
  date: null,
  startAt: null,
  status: 'NEW',
  ...over,
});

test('picks the earliest upcoming job, skipping done and cancelled', () => {
  const first = selectFirstUpcoming([
    job({ id: 'done', status: 'COMPLETED', startAt: new Date('2026-10-27T07:00:00Z') }),
    job({ id: 'late', status: 'CANCELLED', startAt: new Date('2026-10-27T06:00:00Z') }),
    job({ id: 'nine', startAt: new Date('2026-10-27T09:00:00Z') }),
    job({ id: 'eight', startAt: new Date('2026-10-27T08:00:00Z') }),
  ]);
  assert.equal(first?.id, 'eight');
});

test('in-progress counts as upcoming (it is the current job)', () => {
  const first = selectFirstUpcoming([
    job({ id: 'prog', status: 'IN PROGRESS', startAt: new Date('2026-10-27T10:00:00Z') }),
    job({ id: 'next', status: 'NEW', startAt: new Date('2026-10-27T11:00:00Z') }),
  ]);
  assert.equal(first?.id, 'prog');
});

test('jobs with no usable time sort last', () => {
  const first = selectFirstUpcoming([
    job({ id: 'tbd' }),
    job({ id: 'timed', startAt: new Date('2026-10-27T14:00:00Z') }),
  ]);
  assert.equal(first?.id, 'timed');
});

test('null when nothing is upcoming', () => {
  assert.equal(
    selectFirstUpcoming([
      job({ id: 'done', status: 'PAID', startAt: new Date('2026-10-27T07:00:00Z') }),
      job({ id: 'gone', status: 'CANCELLED', startAt: new Date('2026-10-27T06:00:00Z') }),
    ]),
    null,
  );
});
