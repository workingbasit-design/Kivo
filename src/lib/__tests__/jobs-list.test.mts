/**
 * Unit tests for the Jobs list view-model (Part 3 group 1).
 * Pure helpers: src/lib/jobs-list.ts -> classifyJobRow / searchJobRows /
 * sortJobRows / formatWasDueDate.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyJobRow,
  searchJobRows,
  sortJobRows,
  type JobListInput,
} from '../jobs-list.ts';

const TZ = 'America/Toronto';
// 2026-10-17 14:00 UTC = 10:00 Toronto (Saturday).
const NOW = new Date('2026-10-17T14:00:00Z');

function job(over: Partial<JobListInput> = {}): JobListInput {
  return {
    id: 'j1',
    title: 'Furnace tune-up',
    date: new Date('2026-10-17T04:00:00Z'),
    time: '14:00',
    timeTbd: false,
    startAt: null,
    endAt: null,
    status: 'SCHEDULED',
    priceCents: 21357,
    noCharge: false,
    address: '88 Birchmount Ave',
    technician: null,
    customer: { id: 'c1', name: 'Marc Tremblay' },
    service: null,
    assignedTo: null,
    invoices: [],
    ...over,
  };
}

test('classifyJobRow: today job lands in the today group + today filter', () => {
  const r = classifyJobRow(job(), NOW, TZ);
  assert.equal(r.groupId, 'today');
  assert.deepEqual(r.filterIds, ['all', 'today']);
  assert.equal(r.late, false);
  assert.equal(r.runningOver, false);
});

test('classifyJobRow: unstarted past-start job is late (startAt precision)', () => {
  const r = classifyJobRow(
    job({
      id: 'j2',
      date: new Date('2026-10-17T04:00:00Z'),
      startAt: new Date('2026-10-17T13:00:00Z'), // 09:00 Toronto, now 10:00
      status: 'NEW',
    }),
    NOW,
    TZ,
  );
  assert.equal(r.late, true);
  assert.equal(r.groupId, 'late');
  assert.deepEqual(r.filterIds, ['all', 'late']);
});

test('classifyJobRow: in-progress past end is running over, never late', () => {
  const r = classifyJobRow(
    job({
      id: 'j3',
      status: 'IN PROGRESS',
      startAt: new Date('2026-10-17T12:00:00Z'),
      endAt: new Date('2026-10-17T13:00:00Z'), // 09:00 Toronto, now 10:00
    }),
    NOW,
    TZ,
  );
  assert.equal(r.late, false);
  assert.equal(r.runningOver, true);
  assert.equal(r.groupId, 'today');
  assert.deepEqual(r.filterIds, ['all', 'today']);
});

test('classifyJobRow: tomorrow and later jobs are upcoming', () => {
  const tm = classifyJobRow(
    job({ id: 'j4', date: new Date('2026-10-18T04:00:00Z') }),
    NOW,
    TZ,
  );
  assert.equal(tm.groupId, 'tomorrow');
  assert.deepEqual(tm.filterIds, ['all', 'upcoming']);
  const later = classifyJobRow(
    job({ id: 'j5', date: new Date('2026-10-25T04:00:00Z') }),
    NOW,
    TZ,
  );
  assert.equal(later.groupId, 'later');
  assert.deepEqual(later.filterIds, ['all', 'upcoming']);
});

test('classifyJobRow: completed uninvoiced job is earlier + to-invoice', () => {
  const r = classifyJobRow(
    job({
      id: 'j6',
      date: new Date('2026-10-15T04:00:00Z'),
      status: 'COMPLETED',
    }),
    NOW,
    TZ,
  );
  assert.equal(r.groupId, 'earlier');
  assert.equal(r.uninvoiced, true);
  assert.deepEqual(r.filterIds, ['all', 'invoice']);
});

test('classifyJobRow: completed invoiced job has no invoice filter', () => {
  const r = classifyJobRow(
    job({
      id: 'j7',
      date: new Date('2026-10-15T04:00:00Z'),
      status: 'COMPLETED',
      invoices: [{ id: 'i1' }],
    }),
    NOW,
    TZ,
  );
  assert.equal(r.uninvoiced, false);
  assert.deepEqual(r.filterIds, ['all']);
});

test('classifyJobRow: cancelled past job is earlier, never late', () => {
  const r = classifyJobRow(
    job({
      id: 'j8',
      date: new Date('2026-10-10T04:00:00Z'),
      status: 'CANCELLED',
    }),
    NOW,
    TZ,
  );
  assert.equal(r.late, false);
  assert.equal(r.groupId, 'earlier');
});

test('searchJobRows: matches title, customer, address', () => {
  const rows = [
    classifyJobRow(job({ id: 'a', title: 'Furnace tune-up' }), NOW, TZ),
    classifyJobRow(
      job({ id: 'b', title: 'Gutter cleaning', customer: { id: 'c2', name: 'Ava Haddad' } }),
      NOW,
      TZ,
    ),
    classifyJobRow(
      job({ id: 'c', title: 'Window washing', address: '12 King St' }),
      NOW,
      TZ,
    ),
  ];
  assert.deepEqual(searchJobRows(rows, 'furnace').map((r) => r.id), ['a']);
  assert.deepEqual(searchJobRows(rows, 'haddad').map((r) => r.id), ['b']);
  assert.deepEqual(searchJobRows(rows, 'king').map((r) => r.id), ['c']);
  assert.equal(searchJobRows(rows, '').length, 3);
});

test('sortJobRows: soonest first / highest value / customer A-Z', () => {
  const rows = [
    classifyJobRow(
      job({ id: 'a', date: new Date('2026-10-20T04:00:00Z'), priceCents: 10000, customer: { id: 'c3', name: 'Zoe' } }),
      NOW,
      TZ,
    ),
    classifyJobRow(
      job({ id: 'b', date: new Date('2026-10-18T04:00:00Z'), priceCents: 50000, customer: { id: 'c1', name: 'Amy' } }),
      NOW,
      TZ,
    ),
  ];
  assert.deepEqual(sortJobRows(rows, 'date').map((r) => r.id), ['b', 'a']);
  assert.deepEqual(sortJobRows(rows, 'amount').map((r) => r.id), ['b', 'a']);
  assert.deepEqual(
    sortJobRows(rows, 'customer', 'en').map((r) => r.id),
    ['b', 'a'],
  );
});
