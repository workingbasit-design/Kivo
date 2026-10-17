/**
 * Part 0 (dashboard rebuild): the demo seed must be reproducible — same
 * fixed seed, same data, same screenshots.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mulberry32,
  seededPick,
  seededInt,
  todayToronto,
  torontoWallToUtc,
  torontoDatePlusDays,
} from '../demo-seed.ts';

test('Part 0: mulberry32 is deterministic for a fixed seed', () => {
  const a = mulberry32(20261017);
  const b = mulberry32(20261017);
  const seqA = Array.from({ length: 200 }, () => a());
  const seqB = Array.from({ length: 200 }, () => b());
  assert.deepEqual(seqA, seqB);
});

test('Part 0: mulberry32 stays in [0, 1)', () => {
  const rng = mulberry32(20261017);
  for (let i = 0; i < 1000; i++) {
    const v = rng();
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
  }
});

test('Part 0: different seeds diverge', () => {
  const a = mulberry32(20261017);
  const b = mulberry32(20261018);
  const seqA = Array.from({ length: 50 }, () => a());
  const seqB = Array.from({ length: 50 }, () => b());
  assert.notDeepEqual(seqA, seqB);
});

test('Part 0: seededPick/seededInt stay in bounds and are deterministic', () => {
  const arr = ['a', 'b', 'c', 'd'];
  const draw = (r: () => number) => [seededPick(r, arr), seededInt(r, 5, 10)] as const;
  const r1 = mulberry32(7);
  const r2 = mulberry32(7);
  for (let i = 0; i < 100; i++) {
    const [p1, n1] = draw(r1);
    const [p2, n2] = draw(r2);
    assert.equal(p1, p2);
    assert.equal(n1, n2);
    assert.ok(n1 >= 5 && n1 <= 10);
  }
  assert.throws(() => seededPick(mulberry32(1), [] as string[]), /empty array/);
  assert.throws(() => seededInt(mulberry32(1), 10, 5), /max < min/);
});

test('Part 0: todayToronto resolves a known instant to the Toronto date', () => {
  // 2026-10-17T03:30:00Z is still Oct 16 in Toronto (UTC-4).
  const t = todayToronto(new Date('2026-10-17T03:30:00Z'));
  assert.deepEqual(t, { y: 2026, m: 10, d: 16 });
  const t2 = todayToronto(new Date('2026-10-17T05:30:00Z'));
  assert.deepEqual(t2, { y: 2026, m: 10, d: 17 });
});

test('Part 0: torontoWallToUtc applies the EDT offset used by the seed window', () => {
  // 9:00 a.m. Toronto (EDT, UTC-4) => 13:00 UTC.
  const d = torontoWallToUtc(2026, 10, 17, 9, 30);
  assert.equal(d.toISOString(), '2026-10-17T13:30:00.000Z');
});

test('Part 0: torontoDatePlusDays shifts across a month boundary', () => {
  const d = torontoDatePlusDays({ y: 2026, m: 10, d: 17 }, -20);
  // Sep 27, 00:00 Toronto = 04:00 UTC.
  assert.equal(d.toISOString(), '2026-09-27T04:00:00.000Z');
});
