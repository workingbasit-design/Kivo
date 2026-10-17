/**
 * Part 2 (all-modules redesign): list-screen chip counts always match the
 * list, by construction — counts are computed from the rows, never
 * hand-written. Also pins group filtering (empty groups drop out).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeFilterCounts,
  visibleGroupsForFilter,
} from '@/components/patterns/list-logic.ts';
import type { PatternListGroup } from '@/components/patterns/list-logic.ts';

interface Row {
  filterIds: string[];
}
interface Group extends PatternListGroup<Row> {
  id: string;
  rows: Row[];
}

const groups: Group[] = [
  {
    id: 'late',
    rows: [{ filterIds: ['all', 'late'] }],
  },
  {
    id: 'today',
    rows: [
      { filterIds: ['all', 'today', 'invoice'] },
      { filterIds: ['all', 'today', 'invoice'] },
      { filterIds: ['all', 'today', 'upcoming'] },
      { filterIds: ['all', 'today', 'upcoming'] },
    ],
  },
  {
    id: 'tomorrow',
    rows: [
      { filterIds: ['all', 'upcoming'] },
      { filterIds: ['all', 'upcoming'] },
    ],
  },
];

const filterIds = ['all', 'late', 'today', 'upcoming', 'invoice'];

test('counts match the rows for every filter', () => {
  assert.deepEqual(computeFilterCounts(groups, filterIds), {
    all: 7,
    late: 1,
    today: 4,
    upcoming: 4,
    invoice: 2,
  });
});

test('filters with no rows count zero', () => {
  assert.equal(
    computeFilterCounts(groups, ['all', 'archived']).archived,
    0,
  );
});

test('filtering keeps only matching rows and drops empty groups', () => {
  const visible = visibleGroupsForFilter(groups, 'late');
  assert.equal(visible.length, 1);
  assert.equal(visible[0].id, 'late');
  assert.equal(visible[0].rows.length, 1);
});

test('filtering to a filter with no rows yields no groups', () => {
  assert.deepEqual(visibleGroupsForFilter(groups, 'archived'), []);
});

test('group-level fields survive filtering', () => {
  interface RichGroup extends Group {
    heading: string;
  }
  const rich: RichGroup[] = groups.map((g) => ({ ...g, heading: g.id }));
  const visible = visibleGroupsForFilter(rich, 'invoice');
  assert.equal(visible.length, 1);
  assert.equal(visible[0].heading, 'today');
  assert.equal(visible[0].rows.length, 2);
});
