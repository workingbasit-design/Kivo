import test from 'node:test';
import assert from 'node:assert/strict';
import { selectTodayCards, type TodayCardJob } from '../today-cards.ts';

const TZ = 'America/Toronto';
// 2026-10-27 11:00 a.m. EDT.
const NOW = new Date('2026-10-27T15:00:00Z');

function job(
  partial: Partial<TodayCardJob> & { id: string },
): TodayCardJob {
  return {
    date: new Date('2026-10-27T04:00:00Z'),
    time: '10:00',
    timeTbd: false,
    startAt: null,
    endAt: null,
    status: 'SCHEDULED',
    ...partial,
  };
}

test('late jobs come first, then today in start-time order', () => {
  const late = job({
    id: 'late',
    date: new Date('2026-10-26T04:00:00Z'),
    time: '10:00',
    status: 'NEW',
  });
  const morning = job({ id: 'morning', time: '08:00' });
  const afternoon = job({ id: 'afternoon', time: '14:00' });
  const done = job({ id: 'done', time: '07:00', status: 'COMPLETED' });
  const cards = selectTodayCards([afternoon, morning, done], [late], NOW, TZ);
  assert.deepEqual(
    cards.map((c) => c.job.id),
    ['late', 'done', 'morning', 'afternoon'],
  );
  assert.equal(cards[0].late, true);
  assert.equal(cards[1].late, false);
});

test('in-progress past jobs are never late, cancelled jobs never appear', () => {
  const running = job({
    id: 'running',
    date: new Date('2026-10-26T04:00:00Z'),
    time: '09:00',
    status: 'IN PROGRESS',
  });
  const cancelled = job({ id: 'cancelled', status: 'CANCELLED' });
  const cards = selectTodayCards([cancelled], [running], NOW, TZ);
  assert.deepEqual(cards, []);
});

test('time-TBD jobs sort last within today', () => {
  const timed = job({ id: 'timed', time: '09:00' });
  const tbd = job({ id: 'tbd', time: null, timeTbd: true });
  const cards = selectTodayCards([tbd, timed], [], NOW, TZ);
  assert.deepEqual(
    cards.map((c) => c.job.id),
    ['timed', 'tbd'],
  );
});

test('canonical startAt beats the date+time fallback for ordering', () => {
  const early = job({
    id: 'early',
    time: '14:00',
    startAt: new Date('2026-10-27T12:00:00Z'),
  });
  const late = job({ id: 'late', time: '09:00' });
  const cards = selectTodayCards([late, early], [], NOW, TZ);
  assert.deepEqual(
    cards.map((c) => c.job.id),
    ['early', 'late'],
  );
});
