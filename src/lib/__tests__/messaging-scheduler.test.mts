/**
 * Unit tests for the automation scheduler
 * (src/lib/messaging/scheduler.ts).
 * Run: node --test src/lib/__tests__/messaging-scheduler.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMessageCandidates,
  isQuietHour,
  type SchedInput,
  type SchedJob,
  type SchedInvoice,
  type SchedQuote,
  type AutomationToggles,
} from '../messaging/scheduler.ts';

const TZ = 'America/Toronto';
// Wednesday 2026-09-23 12:00 local (EDT, UTC-4).
const NOW = new Date('2026-09-23T12:00:00-04:00');

const ALL_TOGGLES: AutomationToggles = {
  reminder24h: true,
  reminderDayOf: true,
  invoiceDue: true,
  invoiceOverdue: true,
  quoteFollowup: true,
  reviewRequest: true,
};

function job(overrides: Partial<SchedJob> = {}): SchedJob {
  return {
    id: 'j1',
    title: 'Furnace check',
    date: new Date('2026-09-24T10:00:00-04:00'), // tomorrow
    time: '10:00 AM',
    status: 'SCHEDULED',
    customerId: 'c1',
    customerName: 'Sarah',
    phone: '4165550100',
    email: 'sarah@example.com',
    consent: true,
    locale: 'en',
    ...overrides,
  };
}

function invoice(overrides: Partial<SchedInvoice> = {}): SchedInvoice {
  return {
    id: 'i1',
    number: 'INV-001',
    total: 150,
    date: new Date('2026-09-20T10:00:00-04:00'), // 3 days ago
    status: 'UNPAID',
    customerId: 'c1',
    customerName: 'Sarah',
    phone: '4165550100',
    email: 'sarah@example.com',
    consent: true,
    locale: 'en',
    ...overrides,
  };
}

function quote(overrides: Partial<SchedQuote> = {}): SchedQuote {
  return {
    id: 'q1',
    number: 'Q-042',
    total: 500,
    status: 'SENT',
    createdAt: new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000), // exactly 7 days ago
    customerId: 'c1',
    customerName: 'Sarah',
    phone: '4165550100',
    email: 'sarah@example.com',
    consent: true,
    locale: 'en',
    ...overrides,
  };
}

function baseInput(overrides: Partial<SchedInput> = {}): SchedInput {
  return {
    now: NOW,
    timeZone: TZ,
    toggles: ALL_TOGGLES,
    jobs: [],
    invoices: [],
    quotes: [],
    alreadySentKeys: new Set<string>(),
    businessName: 'Maple Repairs',
    ...overrides,
  };
}

/* ---------------- reminder_24h ---------------- */

test('reminder_24h fires for a scheduled job tomorrow', () => {
  const out = buildMessageCandidates(baseInput({ jobs: [job()] }));
  assert.equal(out.length, 1);
  const c = out[0];
  assert.equal(c.template, 'reminder_24h');
  assert.equal(c.eventKey, 'reminder24h:j1:2026-09-24');
  assert.equal(c.channel, 'WHATSAPP');
  assert.equal(c.href, '/jobs/j1');
  assert.equal(c.params.businessName, 'Maple Repairs');
  assert.equal(c.params.customerName, 'Sarah');
  assert.equal(c.params.jobTitle, 'Furnace check');
  assert.ok(c.params.whenLabel && c.params.whenLabel.includes('Sep 24'));
});

test('reminder_24h fires for NEW and IN PROGRESS jobs too', () => {
  for (const status of ['NEW', 'IN PROGRESS']) {
    const out = buildMessageCandidates(baseInput({ jobs: [job({ status })] }));
    assert.equal(out.length, 1, status);
  }
});

test('reminder_24h does not fire when the toggle is off', () => {
  const out = buildMessageCandidates(baseInput({ jobs: [job()], toggles: { ...ALL_TOGGLES, reminder24h: false } }));
  assert.equal(out.length, 0);
});

test('reminder_24h does not fire for wrong status or wrong date', () => {
  assert.equal(buildMessageCandidates(baseInput({ jobs: [job({ status: 'COMPLETED' })] })).length, 0);
  assert.equal(buildMessageCandidates(baseInput({ jobs: [job({ status: 'CANCELLED' })] })).length, 0);
  // today is not tomorrow
  assert.equal(
    buildMessageCandidates(baseInput({ jobs: [job({ date: new Date('2026-09-23T10:00:00-04:00') })] }))
      .filter((c) => c.template === 'reminder_24h').length,
    0
  );
});

test('reminder_24h is skipped when its eventKey was already sent', () => {
  const out = buildMessageCandidates(
    baseInput({ jobs: [job()], alreadySentKeys: new Set(['reminder24h:j1:2026-09-24']) })
  );
  assert.equal(out.length, 0);
});

/* ---------------- reminder_dayof ---------------- */

test('reminder_dayof fires for a scheduled job today', () => {
  const out = buildMessageCandidates(
    baseInput({ jobs: [job({ date: new Date('2026-09-23T10:00:00-04:00') })] })
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].template, 'reminder_dayof');
  assert.equal(out[0].eventKey, 'reminderDayof:j1:2026-09-23');
});

test('reminder_dayof does not fire when the toggle is off or the date is wrong', () => {
  const off = buildMessageCandidates(
    baseInput({ jobs: [job({ date: new Date('2026-09-23T10:00:00-04:00') })], toggles: { ...ALL_TOGGLES, reminderDayOf: false } })
  );
  assert.equal(off.length, 0);
  const tomorrow = buildMessageCandidates(
    baseInput({ jobs: [job()] })
  ).filter((c) => c.template === 'reminder_dayof');
  assert.equal(tomorrow.length, 0);
});

/* ---------------- invoice_due ---------------- */

test('invoice_due fires for an unpaid invoice from exactly 3 days ago', () => {
  const out = buildMessageCandidates(baseInput({ invoices: [invoice()] }));
  assert.equal(out.length, 1);
  const c = out[0];
  assert.equal(c.template, 'invoice_due');
  assert.equal(c.eventKey, 'invoiceDue:i1');
  assert.equal(c.href, '/invoices/i1');
  assert.equal(c.params.invoiceNumber, 'INV-001');
  assert.match(c.params.amountLabel ?? '', /\$150\.00/);
});

test('invoice_due includes the pay link when payLinkFor provides one', () => {
  const out = buildMessageCandidates(
    baseInput({ invoices: [invoice()], payLinkFor: (id) => (id === 'i1' ? 'https://pay.example.com/i1' : null) })
  );
  assert.equal(out[0].params.payLink, 'https://pay.example.com/i1');
});

test('invoice_due omits payLink when payLinkFor is absent', () => {
  const out = buildMessageCandidates(baseInput({ invoices: [invoice()] }));
  assert.equal(out[0].params.payLink, undefined);
});

test('invoice_due does not fire for paid status, wrong date, or toggle off', () => {
  assert.equal(buildMessageCandidates(baseInput({ invoices: [invoice({ status: 'PAID' })] })).length, 0);
  assert.equal(
    buildMessageCandidates(baseInput({ invoices: [invoice({ date: new Date('2026-09-21T10:00:00-04:00') })] }))
      .filter((c) => c.template === 'invoice_due').length,
    0
  );
  const out = buildMessageCandidates(
    baseInput({ invoices: [invoice()], toggles: { ...ALL_TOGGLES, invoiceDue: false } })
  );
  assert.equal(out.length, 0);
});

test('invoice_due fires for PARTIALLY PAID invoices', () => {
  const out = buildMessageCandidates(baseInput({ invoices: [invoice({ status: 'PARTIALLY PAID' })] }));
  assert.equal(out.length, 1);
  assert.equal(out[0].template, 'invoice_due');
});

/* ---------------- invoice_overdue ---------------- */

test('invoice_overdue fires for an unpaid invoice older than 30 days', () => {
  const out = buildMessageCandidates(
    baseInput({ invoices: [invoice({ date: new Date('2026-07-01T10:00:00-04:00') })] })
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].template, 'invoice_overdue');
  assert.equal(out[0].eventKey, 'invoiceOverdue:i1');
});

test('invoice_overdue respects the 30-day boundary strictly', () => {
  // Exactly 30 days ago: not overdue yet.
  const thirty = buildMessageCandidates(
    baseInput({ invoices: [invoice({ date: new Date('2026-08-24T10:00:00-04:00') })] })
  ).filter((c) => c.template === 'invoice_overdue');
  assert.equal(thirty.length, 0);
  // 31 days ago: overdue.
  const thirtyOne = buildMessageCandidates(
    baseInput({ invoices: [invoice({ date: new Date('2026-08-23T10:00:00-04:00') })] })
  ).filter((c) => c.template === 'invoice_overdue');
  assert.equal(thirtyOne.length, 1);
});

test('invoice_overdue does not fire when toggle off or already sent', () => {
  const off = buildMessageCandidates(
    baseInput({
      invoices: [invoice({ date: new Date('2026-07-01T10:00:00-04:00') })],
      toggles: { ...ALL_TOGGLES, invoiceOverdue: false },
    })
  );
  assert.equal(off.length, 0);
  const sent = buildMessageCandidates(
    baseInput({
      invoices: [invoice({ date: new Date('2026-07-01T10:00:00-04:00') })],
      alreadySentKeys: new Set(['invoiceOverdue:i1']),
    })
  );
  assert.equal(sent.length, 0);
});

/* ---------------- quote_followup_7d ---------------- */

test('quote_followup_7d fires for a SENT quote aged 7 days', () => {
  const out = buildMessageCandidates(baseInput({ quotes: [quote()] }));
  assert.equal(out.length, 1);
  const c = out[0];
  assert.equal(c.template, 'quote_followup_7d');
  assert.equal(c.eventKey, 'quoteFollowup:q1');
  assert.equal(c.href, '/quotes/q1');
  assert.equal(c.params.quoteNumber, 'Q-042');
});

test('quote_followup_7d accepts ages between 6.5 and 7.5 days', () => {
  const day = 24 * 60 * 60 * 1000;
  const ages = [6.6 * day, 7.4 * day];
  for (const ageMs of ages) {
    const out = buildMessageCandidates(
      baseInput({ quotes: [quote({ createdAt: new Date(NOW.getTime() - ageMs) })] })
    );
    assert.equal(out.length, 1, `age ${ageMs / day} days`);
  }
});

test('quote_followup_7d does not fire outside the 6.5–7.5 day window or wrong status', () => {
  const day = 24 * 60 * 60 * 1000;
  assert.equal(
    buildMessageCandidates(baseInput({ quotes: [quote({ createdAt: new Date(NOW.getTime() - 6 * day) })] })).length,
    0
  );
  assert.equal(
    buildMessageCandidates(baseInput({ quotes: [quote({ createdAt: new Date(NOW.getTime() - 8 * day) })] })).length,
    0
  );
  assert.equal(buildMessageCandidates(baseInput({ quotes: [quote({ status: 'DRAFT' })] })).length, 0);
  const off = buildMessageCandidates(
    baseInput({ quotes: [quote()], toggles: { ...ALL_TOGGLES, quoteFollowup: false } })
  );
  assert.equal(off.length, 0);
});

/* ---------------- review_request ---------------- */

test('review_request fires for a job completed 2 days ago', () => {
  const out = buildMessageCandidates(
    baseInput({ jobs: [job({ status: 'COMPLETED', date: new Date('2026-09-21T10:00:00-04:00') })] })
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].template, 'review_request');
  assert.equal(out[0].eventKey, 'reviewRequest:j1');
});

test('review_request accepts jobs completed 0–3 days ago, not 4', () => {
  for (const daysAgo of [0, 1, 3]) {
    const d = new Date(NOW.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const iso = `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const out = buildMessageCandidates(
      baseInput({ jobs: [job({ status: 'COMPLETED', date: new Date(`${iso}T10:00:00-04:00`) })] })
    );
    assert.equal(out.length, 1, `${daysAgo} days ago`);
  }
  const old = buildMessageCandidates(
    baseInput({ jobs: [job({ status: 'COMPLETED', date: new Date('2026-09-19T10:00:00-04:00') })] })
  );
  assert.equal(old.length, 0);
});

test('review_request does not fire for non-completed jobs or when the toggle is off', () => {
  assert.equal(
    buildMessageCandidates(baseInput({ jobs: [job({ status: 'SCHEDULED', date: new Date('2026-09-21T10:00:00-04:00') })] })).length,
    0
  );
  const off = buildMessageCandidates(
    baseInput({
      jobs: [job({ status: 'COMPLETED', date: new Date('2026-09-21T10:00:00-04:00') })],
      toggles: { ...ALL_TOGGLES, reviewRequest: false },
    })
  );
  assert.equal(off.length, 0);
});

/* ---------------- channel selection ---------------- */

test('channel is WHATSAPP with a phone, EMAIL with only an email, skipped with neither', () => {
  const withPhone = buildMessageCandidates(baseInput({ jobs: [job({ phone: '4165550100', email: 'sarah@example.com' })] }));
  assert.equal(withPhone[0].channel, 'WHATSAPP');

  const emailOnly = buildMessageCandidates(baseInput({ jobs: [job({ phone: null, email: 'sarah@example.com' })] }));
  assert.equal(emailOnly.length, 1);
  assert.equal(emailOnly[0].channel, 'EMAIL');
  assert.equal(emailOnly[0].toEmail, 'sarah@example.com');

  const blankPhone = buildMessageCandidates(baseInput({ jobs: [job({ phone: '   ', email: 'sarah@example.com' })] }));
  assert.equal(blankPhone[0].channel, 'EMAIL');

  const none = buildMessageCandidates(baseInput({ jobs: [job({ phone: null, email: null })] }));
  assert.equal(none.length, 0);
});

/* ---------------- isQuietHour ---------------- */

test('isQuietHour handles the overnight 21:00–08:00 window in America/Toronto', () => {
  const at = (utc: string) => new Date(utc);
  // 22:00 local on Sep 23 -> true
  assert.equal(isQuietHour(at('2026-09-24T02:00:00Z'), TZ, 21, 8), true);
  // 10:00 local -> false
  assert.equal(isQuietHour(at('2026-09-23T14:00:00Z'), TZ, 21, 8), false);
  // 07:59 local -> true
  assert.equal(isQuietHour(at('2026-09-23T11:59:00Z'), TZ, 21, 8), true);
  // 08:00 local -> false (end is exclusive)
  assert.equal(isQuietHour(at('2026-09-23T12:00:00Z'), TZ, 21, 8), false);
  // 21:00 local -> true (start is inclusive)
  assert.equal(isQuietHour(at('2026-09-24T01:00:00Z'), TZ, 21, 8), true);
});

test('isQuietHour handles a same-day window without wrap', () => {
  assert.equal(isQuietHour(new Date('2026-09-23T14:00:00Z'), TZ, 9, 17), true); // 10:00
  assert.equal(isQuietHour(new Date('2026-09-23T22:00:00Z'), TZ, 9, 17), false); // 18:00
  assert.equal(isQuietHour(new Date('2026-09-23T13:00:00Z'), TZ, 9, 17), true); // 09:00 inclusive
});
