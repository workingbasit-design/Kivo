/**
 * Unit tests for the reminder queue / missed-call text-back / booking
 * availability pure logic (src/lib/reminders.ts).
 * Run: node --test src/lib/__tests__/reminders.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeWaDigits,
  waChatLink,
  smsDraftLink,
  mailtoDraftLink,
  formatSlotLabel,
  formatWhenLabel,
  buildJobReminderDraft,
  buildInvoiceFollowupDraft,
  buildMissedCallDraft,
  generateDaySlots,
  computeSlotAvailability,
  isSlotStillAvailable,
  dayKeyForDate,
  SLOT_MINUTES,
  DEFAULT_JOB_MINUTES,
} from '../reminders.ts';

const HOURS = JSON.stringify({
  mon: ['09:00', '18:00'],
  tue: ['09:00', '18:00'],
  wed: ['09:00', '18:00'],
  thu: ['09:00', '18:00'],
  fri: ['09:00', '18:00'],
});

/* ---------------- phone normalization ---------------- */

test('normalizeWaDigits prepends 1 to 10-digit NANP numbers', () => {
  assert.equal(normalizeWaDigits('(416) 555-0100'), '14165550100');
  assert.equal(normalizeWaDigits('4165550100'), '14165550100');
});

test('normalizeWaDigits keeps numbers that already carry a country code', () => {
  assert.equal(normalizeWaDigits('+1 416 555 0100'), '14165550100');
  assert.equal(normalizeWaDigits('14165550100'), '14165550100');
});

test('normalizeWaDigits returns empty for blank input', () => {
  assert.equal(normalizeWaDigits(''), '');
  assert.equal(normalizeWaDigits(null), '');
  assert.equal(normalizeWaDigits(undefined), '');
});

test('waChatLink builds a wa.me link with encoded text', () => {
  const link = waChatLink('416-555-0100', 'Hi there!');
  assert.equal(link, 'https://wa.me/14165550100?text=Hi%20there!');
});

test('waChatLink returns empty string without a usable phone', () => {
  assert.equal(waChatLink(null, 'Hi'), '');
  assert.equal(waChatLink('   ', 'Hi'), '');
});

test('smsDraftLink uses the cross-platform ?&body= form', () => {
  const link = smsDraftLink('(416) 555-0100', 'Sorry I missed your call');
  assert.equal(link, 'sms:14165550100?&body=Sorry%20I%20missed%20your%20call');
});

test('smsDraftLink returns empty string without a usable phone', () => {
  assert.equal(smsDraftLink(null, 'Hi'), '');
});

test('mailtoDraftLink builds a mailto link with subject and body', () => {
  const link = mailtoDraftLink('client@example.com', 'Reminder', 'Hi there');
  assert.equal(link, 'mailto:client%40example.com?subject=Reminder&body=Hi%20there');
});

test('mailtoDraftLink returns empty string without an email', () => {
  assert.equal(mailtoDraftLink('  ', 's', 'b'), '');
});

/* ---------------- time labels ---------------- */

test('formatSlotLabel renders 12h EN and Canadian FR', () => {
  assert.equal(formatSlotLabel('09:30', 'en'), '9:30 AM');
  assert.equal(formatSlotLabel('13:00', 'en'), '1:00 PM');
  assert.equal(formatSlotLabel('09:30', 'fr'), '9 h 30');
  assert.equal(formatSlotLabel('13:00', 'fr'), '13 h 00');
});

test('formatWhenLabel combines date and parseable time', () => {
  const d = new Date(2026, 8, 24, 10, 0); // Thursday
  assert.equal(formatWhenLabel(d, '10:00 AM', 'en'), 'Thu, Sep 24 at 10:00 AM');
  assert.equal(formatWhenLabel(d, '10:00 AM', 'fr'), 'jeu. 24 sept. à 10 h 00');
});

test('formatWhenLabel falls back to the date alone for free-text times', () => {
  const d = new Date(2026, 8, 24, 10, 0);
  assert.equal(formatWhenLabel(d, 'morning', 'en'), 'Thu, Sep 24');
  assert.equal(formatWhenLabel(d, null, 'fr'), 'jeu. 24 sept.');
});

/* ---------------- draft builders ---------------- */

test('buildJobReminderDraft includes names, title and when (en)', () => {
  const text = buildJobReminderDraft({
    locale: 'en',
    businessName: 'Maple Repairs',
    customerName: 'Sarah',
    jobTitle: 'Furnace check',
    whenLabel: 'Thu, Sep 24 at 10:00 AM',
  });
  assert.match(text, /Sarah/);
  assert.match(text, /Maple Repairs/);
  assert.match(text, /Furnace check/);
  assert.match(text, /Thu, Sep 24 at 10:00 AM/);
  assert.match(text, /reschedule/);
});

test('buildJobReminderDraft is French when locale is fr', () => {
  const text = buildJobReminderDraft({
    locale: 'fr',
    businessName: 'Maple Repairs',
    customerName: 'Sarah',
    jobTitle: 'Furnace check',
    whenLabel: 'jeu. 24 sept. à 10 h 00',
  });
  assert.match(text, /Bonjour Sarah/);
  assert.match(text, /reporter le rendez-vous/);
});

test('buildInvoiceFollowupDraft mentions Interac only when an email is set', () => {
  const withInterac = buildInvoiceFollowupDraft({
    locale: 'en',
    businessName: 'Maple Repairs',
    customerName: 'Sarah',
    invoiceNumber: 'INV-001',
    amountLabel: '$150.00',
    interacEmail: 'pay@maple.ca',
  });
  assert.match(withInterac, /Interac e-Transfer to pay@maple\.ca/);

  const without = buildInvoiceFollowupDraft({
    locale: 'en',
    businessName: 'Maple Repairs',
    customerName: 'Sarah',
    invoiceNumber: 'INV-001',
    amountLabel: '$150.00',
  });
  assert.doesNotMatch(without, /Interac/);
});

test('buildInvoiceFollowupDraft fr mentions Virement Interac', () => {
  const text = buildInvoiceFollowupDraft({
    locale: 'fr',
    businessName: 'Maple Repairs',
    customerName: 'Sarah',
    invoiceNumber: 'INV-001',
    amountLabel: '150,00 $',
    interacEmail: 'pay@maple.ca',
  });
  assert.match(text, /Virement Interac à pay@maple\.ca/);
  assert.match(text, /impayée/);
});

test('buildMissedCallDraft never claims automatic detection', () => {
  const en = buildMissedCallDraft({ locale: 'en', businessName: 'Maple Repairs', customerName: 'Sarah' });
  assert.match(en, /sorry I missed your call/i);
  assert.match(en, /Maple Repairs/);
  assert.doesNotMatch(en, /detected|automatically/i);

  const fr = buildMissedCallDraft({ locale: 'fr', businessName: 'Maple Repairs', customerName: 'Sarah' });
  assert.match(fr, /manqué votre appel/);
});

/* ---------------- slot generation ---------------- */

test('dayKeyForDate maps dates to weekday keys', () => {
  assert.equal(dayKeyForDate('2026-09-28'), 'mon'); // Monday
  assert.equal(dayKeyForDate('2026-09-27'), 'sun'); // Sunday
  assert.equal(dayKeyForDate('not-a-date'), null);
});

test('generateDaySlots produces 30-minute slots inside working hours', () => {
  const gen = generateDaySlots(HOURS, '2026-09-28'); // Monday 09:00-18:00
  assert.equal(gen.closed, false);
  assert.equal(gen.hoursNotSet, false);
  if (gen.closed || gen.hoursNotSet) return;
  assert.equal(gen.slots.length, 18);
  assert.equal(gen.slots[0].start, '09:00');
  assert.equal(gen.slots[0].end, '09:30');
  assert.equal(gen.slots[17].start, '17:30');
  assert.equal(gen.slots[17].end, '18:00');
  for (const s of gen.slots) {
    assert.equal(s.endMinutes - s.startMinutes, SLOT_MINUTES);
  }
});

test('generateDaySlots reports closed for days without hours', () => {
  const gen = generateDaySlots(HOURS, '2026-09-27'); // Sunday, not configured
  assert.equal(gen.closed, true);
});

test('generateDaySlots reports hoursNotSet when hours are missing or invalid', () => {
  assert.equal(generateDaySlots(null, '2026-09-28').hoursNotSet, true);
  assert.equal(generateDaySlots('not json', '2026-09-28').hoursNotSet, true);
});

/* ---------------- overlap computation ---------------- */

function slotsForMonday() {
  const gen = generateDaySlots(HOURS, '2026-09-28');
  assert.equal(gen.closed, false);
  assert.equal(gen.hoursNotSet, false);
  if (gen.closed || gen.hoursNotSet) throw new Error('unexpected');
  return gen.slots;
}

test('a 60-minute job blocks the two slots it overlaps', () => {
  const slots = slotsForMonday();
  const { slots: avail, unscheduledCount } = computeSlotAvailability(slots, [
    { startMinutes: 10 * 60 }, // 10:00 job, default 60 min
  ]);
  const byStart = new Map(avail.map((s) => [s.start, s.available]));
  assert.equal(byStart.get('09:30'), true);
  assert.equal(byStart.get('10:00'), false);
  assert.equal(byStart.get('10:30'), false);
  assert.equal(byStart.get('11:00'), true);
  assert.equal(unscheduledCount, 0);
});

test('adjacent bookings do not block each other', () => {
  const slots = slotsForMonday();
  const { slots: avail } = computeSlotAvailability(slots, [
    { startMinutes: 9 * 60, durationMinutes: 30 }, // 09:00-09:30
  ]);
  const byStart = new Map(avail.map((s) => [s.start, s.available]));
  assert.equal(byStart.get('09:00'), false);
  assert.equal(byStart.get('09:30'), true); // exactly adjacent: free
});

test('jobs without a parseable time block nothing but are counted', () => {
  const slots = slotsForMonday();
  const { slots: avail, unscheduledCount } = computeSlotAvailability(slots, [
    { startMinutes: null },
    { startMinutes: 600 },
  ]);
  assert.equal(avail.every((s) => s.available || s.start === '10:00' || s.start === '10:30'), true);
  assert.equal(unscheduledCount, 1);
});

test('DEFAULT_JOB_MINUTES is the assumed job length', () => {
  assert.equal(DEFAULT_JOB_MINUTES, 60);
});

test('isSlotStillAvailable accepts free slots and rejects taken/unknown ones', () => {
  const slots = slotsForMonday();
  const { slots: avail } = computeSlotAvailability(slots, [{ startMinutes: 600 }]);
  assert.equal(isSlotStillAvailable('09:00', avail), true);
  assert.equal(isSlotStillAvailable('10:00', avail), false);
  assert.equal(isSlotStillAvailable('99:99', avail), false);
});
