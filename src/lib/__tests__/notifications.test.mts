/**
 * Notification generation-logic tests (Track 3). The builders are pure —
 * fixtures in, candidates out — so generation is verified without a database.
 * Also covers settings defaults/parsing and locale-aware rendering.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// Redirect @/lib/prisma (and relative ./prisma) to the stub BEFORE the
// notifications module is imported. Tests only touch pure functions, so no
// database is ever contacted. The import must be dynamic: static imports
// hoist above register().
register('./prisma-stub-loader.mjs', import.meta.url);

const {
  NOTIFICATION_TYPES,
  defaultSettings,
  parseSettings,
  serializeSettings,
  fill,
  parseTimeMinutes,
  buildJobTomorrow,
  buildJobSoon,
  buildInvoiceOverdue,
  buildQuoteExpiring,
  buildBookingNew,
  buildPaymentRecorded,
  renderNotificationTitle,
  renderNotificationBody,
} = await import('../notifications.ts');

interface JobRow {
  id: string;
  title: string;
  date: Date;
  time: string | null;
  status: string;
  customerName: string;
}

const DAY = 24 * 60 * 60 * 1000;
const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * DAY);
const daysAhead = (n: number) => new Date(now.getTime() + n * DAY);
const isoOf = (d: Date) => {
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

function job(over: Partial<JobRow>): JobRow {
  return {
    id: 'job-1',
    title: 'AC Repair',
    date: daysAhead(1),
    time: '10:00',
    status: 'SCHEDULED',
    customerName: 'Sarah Tremblay',
    ...over,
  };
}

// --- settings ---------------------------------------------------------------

test('settings default to all ON', () => {
  const s = defaultSettings();
  assert.equal(NOTIFICATION_TYPES.length, 6);
  for (const k of NOTIFICATION_TYPES) assert.equal(s[k], true, k);
});

test('parseSettings: null/undefined -> all on', () => {
  assert.deepEqual(parseSettings(null), defaultSettings());
  assert.deepEqual(parseSettings(undefined), defaultSettings());
});

test('parseSettings: partial JSON keeps the rest on', () => {
  const s = parseSettings('{"job_soon": false}');
  assert.equal(s.job_soon, false);
  assert.equal(s.job_tomorrow, true);
  assert.equal(s.invoice_overdue, true);
});

test('parseSettings: corrupt JSON -> safe default (all on)', () => {
  assert.deepEqual(parseSettings('not-json{{{'), defaultSettings());
});

test('serializeSettings round-trips', () => {
  const s = { ...defaultSettings(), quote_expiring: false };
  assert.deepEqual(parseSettings(serializeSettings(s)), s);
});

// --- job_tomorrow ------------------------------------------------------------

test('job_tomorrow: active job tomorrow generates a candidate', () => {
  const c = buildJobTomorrow([job({})], isoOf(daysAhead(1)));
  assert.equal(c.length, 1);
  assert.equal(c[0].type, 'job_tomorrow');
  assert.equal(c[0].href, '/jobs/job-1');
  assert.ok(c[0].dedupeKey.includes('job-1'));
  assert.equal(c[0].data.customer, 'Sarah Tremblay');
});

test('job_tomorrow: cancelled/completed jobs and other days are skipped', () => {
  const rows = [
    job({ id: 'a', status: 'CANCELLED' }),
    job({ id: 'b', status: 'COMPLETED' }),
    job({ id: 'c', date: daysAhead(2) }),
    job({ id: 'd', date: daysAhead(0) }),
  ];
  assert.equal(buildJobTomorrow(rows, isoOf(daysAhead(1))).length, 0);
});

// --- job_soon -----------------------------------------------------------------

test('job_soon: job today within 2h generates a candidate', () => {
  const rows = [job({ id: 's1', date: daysAhead(0), time: '14:00' })];
  const c = buildJobSoon(rows, isoOf(daysAhead(0)), 13 * 60);
  assert.equal(c.length, 1);
  assert.equal(c[0].type, 'job_soon');
});

test('job_soon: jobs outside the window are skipped', () => {
  const rows = [
    job({ id: 's1', date: daysAhead(0), time: '16:30' }), // >2h away
    job({ id: 's2', date: daysAhead(0), time: '12:00' }), // already started
    job({ id: 's3', date: daysAhead(0), time: null }), // no time -> unknown
    job({ id: 's4', date: daysAhead(0), time: 'sometime' }), // unparseable
    job({ id: 's5', date: daysAhead(1), time: '14:00' }), // tomorrow, not today
  ];
  assert.equal(buildJobSoon(rows, isoOf(daysAhead(0)), 13 * 60).length, 0);
});

test('parseTimeMinutes handles 24h and am/pm', () => {
  assert.equal(parseTimeMinutes('15:00'), 900);
  assert.equal(parseTimeMinutes('09:30'), 570);
  assert.equal(parseTimeMinutes('9:30 pm'), 1290);
  assert.equal(parseTimeMinutes(null), null);
  assert.equal(parseTimeMinutes('sometime'), null);
});

// --- invoice_overdue ------------------------------------------------------------

test('invoice_overdue: unpaid 40d ago generates; recent or paid do not', () => {
  const rows = [
    { id: 'i1', number: 'INV-1', date: daysAgo(40), total: 500, status: 'UNPAID', customerName: 'Marc' },
    { id: 'i2', number: 'INV-2', date: daysAgo(10), total: 200, status: 'UNPAID', customerName: 'Marc' },
    { id: 'i3', number: 'INV-3', date: daysAgo(40), total: 300, status: 'PAID', customerName: 'Marc' },
    { id: 'i4', number: 'INV-4', date: daysAgo(90), total: 150, status: 'PARTIALLY PAID', customerName: 'Luc' },
  ];
  const c = buildInvoiceOverdue(rows, daysAgo(30));
  assert.deepEqual(c.map((x) => x.dedupeKey).sort(), ['invoice_overdue:i1', 'invoice_overdue:i4']);
  assert.equal(c[0].href, '/invoices/i1');
});

// --- quote_expiring ---------------------------------------------------------------

test('quote_expiring: SENT 40d ago generates; recent/approved do not', () => {
  const rows = [
    { id: 'q1', number: 'Q-1', total: 900, status: 'SENT', createdAt: daysAgo(40), customerName: 'Ava' },
    { id: 'q2', number: 'Q-2', total: 900, status: 'SENT', createdAt: daysAgo(5), customerName: 'Ava' },
    { id: 'q3', number: 'Q-3', total: 900, status: 'APPROVED', createdAt: daysAgo(40), customerName: 'Ava' },
  ];
  const c = buildQuoteExpiring(rows, daysAgo(30));
  assert.equal(c.length, 1);
  assert.equal(c[0].dedupeKey, 'quote_expiring:q1');
  assert.equal(c[0].href, '/quotes/q1');
});

// --- booking_new -------------------------------------------------------------------

test('booking_new: NEW jobs generate; other statuses do not', () => {
  const rows = [
    job({ id: 'n1', status: 'NEW' }),
    job({ id: 'n2', status: 'SCHEDULED' }),
  ];
  const c = buildBookingNew(rows, daysAgo(7));
  assert.equal(c.length, 1);
  assert.equal(c[0].dedupeKey, 'booking_new:n1');
  assert.equal(c[0].href, '/jobs/n1');
});

// --- payment_recorded ----------------------------------------------------------------

test('payment_recorded: recent payments generate; old ones do not', () => {
  const rows = [
    { id: 'p1', amount: 250, createdAt: daysAgo(1), invoiceId: 'i1', invoiceNumber: 'INV-1', customerName: 'Marc' },
    { id: 'p2', amount: 100, createdAt: daysAgo(30), invoiceId: 'i1', invoiceNumber: 'INV-1', customerName: 'Marc' },
  ];
  const c = buildPaymentRecorded(rows, daysAgo(7));
  assert.equal(c.length, 1);
  assert.equal(c[0].dedupeKey, 'payment_recorded:p1');
  assert.equal(c[0].href, '/invoices/i1');
});

// --- rendering --------------------------------------------------------------------------

test('fill replaces params and blanks missing ones', () => {
  assert.equal(fill('Hi {name}, {missing}!', { name: 'Jo' }), 'Hi Jo, !');
});

test('rendered titles/bodies are complete in EN and FR', () => {
  for (const locale of ['en', 'fr'] as const) {
    for (const type of NOTIFICATION_TYPES) {
      const data = {
        job: 'AC Repair',
        customer: 'Sarah',
        time: '10:00',
        number: 'INV-1',
        amount: '$500.00',
        when: '2026-01-01',
      };
      const title = renderNotificationTitle(type, data, locale);
      const body = renderNotificationBody(type, data, locale);
      assert.ok(title.length > 3, `${locale}/${type} title empty`);
      assert.ok(body.length > 3, `${locale}/${type} body empty`);
      assert.ok(!/\{\w+\}/.test(title), `${locale}/${type} title has unfilled param`);
      assert.ok(!/\{\w+\}/.test(body), `${locale}/${type} body has unfilled param`);
    }
  }
});

test('dedupe keys are unique per record and type', () => {
  const keys = new Set<string>();
  const rows = [job({ id: 'x1' }), job({ id: 'x2' })];
  for (const c of [
    ...buildJobTomorrow(rows, isoOf(daysAhead(1))),
    ...buildJobSoon(
      rows.map((r) => ({ ...r, date: daysAhead(0), time: '14:00' })),
      isoOf(daysAhead(0)),
      13 * 60
    ),
    ...buildBookingNew(rows, daysAgo(7)),
  ]) {
    assert.ok(!keys.has(c.dedupeKey), `duplicate dedupeKey ${c.dedupeKey}`);
    keys.add(c.dedupeKey);
  }
});
