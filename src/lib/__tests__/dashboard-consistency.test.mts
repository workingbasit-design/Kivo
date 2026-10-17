/**
 * Part D (dashboard rebuild): dashboard numbers equal their lists.
 *
 * Runs against a fixed in-memory dataset (dashboard-consistency-stub)
 * with the clock frozen at 11:30 p.m. business-local time in
 * America/Toronto, America/Vancouver and America/St_Johns. This pins the
 * Part A day-boundary rule: a payment stamped 22:45 local time lands in
 * *today's* bucket in Toronto/Vancouver, but in *tomorrow's* (future)
 * bucket in St_Johns, where 02:45 UTC is already 00:15 the next day.
 *
 * Run: node --test --import ./src/lib/__tests__/dashboard-consistency-stub-loader.mjs
 *      src/lib/__tests__/dashboard-consistency.test.mts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getKeyNumbers,
  getMoneyPipeline,
  getHeaderSummary,
  getCollected,
  getTodaysVisits,
} from '../dashboard-sections.ts';

const RealDate = globalThis.Date;

const SCENARIOS = [
  {
    name: 'America/Toronto at 11:30 p.m. EDT',
    timezone: 'America/Toronto',
    nowMs: Date.UTC(2026, 9, 18, 3, 30), // 2026-10-18T03:30Z = 23:30 EDT Oct 17
    boundaryPaymentIsToday: true,
  },
  {
    name: 'America/Vancouver at 11:30 p.m. PDT',
    timezone: 'America/Vancouver',
    nowMs: Date.UTC(2026, 9, 18, 6, 30), // 2026-10-18T06:30Z = 23:30 PDT Oct 17
    boundaryPaymentIsToday: true,
  },
  {
    name: 'America/St_Johns at 11:30 p.m. NDT',
    timezone: "America/St_Johns",
    nowMs: Date.UTC(2026, 9, 18, 2, 0), // 2026-10-18T02:00Z = 23:30 NDT Oct 17
    boundaryPaymentIsToday: false, // 02:45Z is 00:15 NDT Oct 18: tomorrow
  },
] as const;

/** Freeze the clock at `ms`; restore afterwards. */
async function withFrozenNow<T>(ms: number, fn: () => Promise<T>): Promise<T> {
  class FakeDate extends RealDate {
    constructor(...args: unknown[]) {
      // @ts-expect-error - passthrough constructor
      super(...(args.length === 0 ? [ms] : args));
    }
    static now() {
      return ms;
    }
  }
  const prev = globalThis.Date;
  // @ts-expect-error - test-only clock mock
  globalThis.Date = FakeDate;
  try {
    return await fn();
  } finally {
    globalThis.Date = prev;
  }
}

for (const s of SCENARIOS) {
  test(`key numbers equal their lists (${s.name})`, async () => {
    await withFrozenNow(s.nowMs, async () => {
      const k = await getKeyNumbers('biz', { timezone: s.timezone });

      // Owed = the unpaid-invoices total (UNPAID + PARTIALLY PAID, not
      // voided; outstanding = total - completed payments).
      assert.equal(k.owed.total, 210); // 60 + 150
      // Overdue slice: only inv-open (due Oct 1, 16 days overdue).
      assert.equal(k.owed.overdue, 60);
      // Aging buckets partition the owed total.
      const agingSum =
        k.owed.aging.current + k.owed.aging.d1_30 + k.owed.aging.d31_60 + k.owed.aging.over60;
      assert.equal(agingSum, k.owed.total);
      assert.equal(k.owed.aging.d1_30, 60);
      assert.equal(k.owed.aging.current, 150);

      // Ready to invoice = COMPLETED jobs with no invoice yet.
      assert.equal(k.readyToInvoice.amount, 200); // 150 + 50
      assert.equal(k.readyToInvoice.jobs, 2);

      // Quotes waiting = SENT quotes; expiring soon via the 30-day heuristic.
      assert.equal(k.quotesWaiting.amount, 550); // 250 + 300
      assert.equal(k.quotesWaiting.count, 2);
      assert.equal(k.quotesWaiting.expiringSoon, 1);

      // New leads + first-reply stats from Communication rows.
      assert.equal(k.newLeads.waiting, 2);
      assert.equal(k.newLeads.avgFirstReplyMin, 12);
      assert.equal(k.newLeads.oldestWaitingMin, 40);
    });
  });

  test(`money pipeline matches key numbers (${s.name})`, async () => {
    await withFrozenNow(s.nowMs, async () => {
      const p = await getMoneyPipeline('biz');
      const byKey = Object.fromEntries(p.stages.map((st) => [st.key, st]));

      assert.equal(byKey.invoiced.count, 2);
      assert.equal(byKey.invoiced.amount, 210);
      assert.equal(byKey.invoiced.overdue, 60);
      assert.equal(byKey.done.count, 2);
      assert.equal(byKey.done.amount, 200);
      assert.equal(byKey.done.leak, true);
      assert.equal(byKey.quotes.count, 2);
      assert.equal(byKey.quotes.amount, 550);
      assert.equal(byKey.approved.count, 1);
      assert.equal(byKey.approved.amount, 120);
      assert.equal(byKey.approved.leak, true);
      // job-sched ($90) + job-today ($70): both SCHEDULED.
      assert.equal(byKey.scheduled.count, 2);
      assert.equal(byKey.scheduled.amount, 160);
      assert.equal(byKey.leads.count, 2);
      assert.equal(byKey.leads.amount, null);
      // Total = quotes + approved + scheduled + done + invoiced.
      assert.equal(p.totalInProgress, 550 + 120 + 160 + 200 + 210);

      // Cross-check against the key-numbers section (same definitions).
      const k = await getKeyNumbers('biz', { timezone: s.timezone });
      assert.equal(byKey.invoiced.amount, k.owed.total);
      assert.equal(byKey.done.amount, k.readyToInvoice.amount);
      assert.equal(byKey.done.count, k.readyToInvoice.jobs);
      assert.equal(byKey.quotes.amount, k.quotesWaiting.amount);
      assert.equal(byKey.leads.count, k.newLeads.waiting);
    });
  });

  test(`header uses the business-local day at 11:30 p.m. (${s.name})`, async () => {
    await withFrozenNow(s.nowMs, async () => {
      const h = await getHeaderSummary('biz', { timezone: s.timezone });
      // 23:30 local is still Oct 17 in the business timezone, even
      // though it is already Oct 18 in UTC.
      assert.equal(h.dateKey, '2026-10-17');
      assert.equal(h.visitsToday, 1);
      assert.equal(h.doneToday, 0);
      assert.equal(h.readyToInvoice, 200);
    });
  });

  test(`collected buckets the 11:30 p.m. payment in the business day (${s.name})`, async () => {
    await withFrozenNow(s.nowMs, async () => {
      const c = await getCollected('biz', { timezone: s.timezone });
      const todayBar = c.week.bars.find((b) => b.isToday);
      assert.ok(todayBar, 'exactly one today bar');
      assert.equal(todayBar.key, '2026-10-17');

      if (s.boundaryPaymentIsToday) {
        // 02:45Z is 22:45 local Oct 17 in Toronto/Vancouver: today.
        assert.equal(todayBar.amount, 60);
        const sunday = c.week.bars.find((b) => b.key === '2026-10-18');
        assert.equal(sunday?.isFuture, true);
      } else {
        // 02:45Z is 00:15 NDT Oct 18 in St_Johns: tomorrow (future).
        assert.equal(todayBar.amount, 0);
        const sunday = c.week.bars.find((b) => b.key === '2026-10-18');
        assert.equal(sunday?.isFuture, true);
        assert.equal(sunday?.amount, 60);
      }

      // The older payment (Oct 15) is in the week total in all zones.
      const weekTotal = c.week.bars
        .slice(0, c.week.bars.findIndex((b) => b.isToday) + 1)
        .reduce((sum, b) => sum + b.amount, 0);
      assert.equal(c.week.total, weekTotal);
      assert.ok(c.week.total >= 120, 'Oct 15 payment is in the week total');

      // Month view: six bars, oldest first, ending with the current month.
      assert.equal(c.month.bars.length, 6);
      assert.equal(c.month.bars[5].key, '2026-10');
    });
  });

  test(`today's visits use the business-local day (${s.name})`, async () => {
    await withFrozenNow(s.nowMs, async () => {
      const { visits } = await getTodaysVisits('biz', { timezone: s.timezone });
      assert.equal(visits.length, 1);
      assert.equal(visits[0].title, 'Today visit');
      assert.equal(visits[0].customerName, 'Fay');
    });
  });
}

test('clock is restored after the scenarios', () => {
  assert.equal(globalThis.Date, RealDate);
  assert.ok(Math.abs(Date.now() - RealDate.now()) < 1000);
});
