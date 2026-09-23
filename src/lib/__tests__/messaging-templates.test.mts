/**
 * Unit tests for the automated-messaging templates
 * (src/lib/messaging/templates.ts).
 * Run: node --test src/lib/__tests__/messaging-templates.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  renderTemplate,
  TEMPLATE_IDS,
  type MessageTemplateId,
  type MsgLocale,
  type TemplateParams,
} from '../messaging/templates.ts';

const FULL_PARAMS: TemplateParams = {
  businessName: 'Maple Repairs',
  customerName: 'Sarah',
  jobTitle: 'Furnace check',
  whenLabel: 'Thu, Sep 24 at 10:00 AM',
  invoiceNumber: 'INV-001',
  amountLabel: '$150.00',
  payLink: 'https://pay.example.com/inv-001',
  quoteNumber: 'Q-042',
};

test('TEMPLATE_IDS lists all six templates', () => {
  const ids: MessageTemplateId[] = [
    'reminder_24h',
    'reminder_dayof',
    'invoice_due',
    'invoice_overdue',
    'quote_followup_7d',
    'review_request',
  ];
  assert.deepEqual([...TEMPLATE_IDS].sort(), ids.sort());
});

for (const id of TEMPLATE_IDS) {
  for (const locale of ['en', 'fr'] as MsgLocale[]) {
    test(`${id} renders in ${locale} with subject and body`, () => {
      const r = renderTemplate(id, locale, FULL_PARAMS);
      assert.ok(r.subject.length > 0, 'subject must not be empty');
      assert.ok(r.body.length > 0, 'body must not be empty');
      assert.ok(r.body.length < 600, `body must be WhatsApp-friendly (<600 chars), got ${r.body.length}`);
    });
  }
}

test('every body includes the business name', () => {
  for (const id of TEMPLATE_IDS) {
    for (const locale of ['en', 'fr'] as MsgLocale[]) {
      const r = renderTemplate(id, locale, FULL_PARAMS);
      assert.match(r.body, /Maple Repairs/, `${id}/${locale} must include the business name`);
    }
  }
});

test('opt-out footer is present and locale-correct', () => {
  for (const id of TEMPLATE_IDS) {
    const en = renderTemplate(id, 'en', FULL_PARAMS);
    assert.ok(en.body.endsWith('Reply STOP to opt out.'), `${id}/en footer`);

    const fr = renderTemplate(id, 'fr', FULL_PARAMS);
    assert.ok(fr.body.endsWith('Répondez ARRÊT pour vous désinscrire.'), `${id}/fr footer`);
  }
});

test('no cross-locale leakage: French bodies have no English opt-out or English sentences', () => {
  for (const id of TEMPLATE_IDS) {
    const fr = renderTemplate(id, 'fr', FULL_PARAMS);
    assert.doesNotMatch(fr.body, /Reply STOP/, `${id}/fr must not contain "Reply STOP"`);
    assert.doesNotMatch(fr.body, /\bHi \b/, `${id}/fr must not contain English "Hi " greeting`);
    assert.doesNotMatch(fr.subject, /reminder|Reminder|Overdue|Following up|How was your/i, `${id}/fr subject must not be English`);
  }
});

test('no cross-locale leakage: English bodies have no French opt-out', () => {
  for (const id of TEMPLATE_IDS) {
    const en = renderTemplate(id, 'en', FULL_PARAMS);
    assert.doesNotMatch(en.body, /ARRÊT|désinscrire/, `${id}/en must not contain the French opt-out`);
    assert.doesNotMatch(en.body, /Bonjour/, `${id}/en must not contain "Bonjour"`);
  }
});

test('subjects are bilingual (en != fr) and mention the business where natural', () => {
  for (const id of TEMPLATE_IDS) {
    const en = renderTemplate(id, 'en', FULL_PARAMS);
    const fr = renderTemplate(id, 'fr', FULL_PARAMS);
    assert.notEqual(en.subject, fr.subject, `${id} subjects must differ by locale`);
  }
});

test('invoice_due includes the pay link when present', () => {
  const en = renderTemplate('invoice_due', 'en', FULL_PARAMS);
  assert.match(en.body, /https:\/\/pay\.example\.com\/inv-001/);
  const fr = renderTemplate('invoice_due', 'fr', FULL_PARAMS);
  assert.match(fr.body, /https:\/\/pay\.example\.com\/inv-001/);
});

test('invoice_due omits the pay line gracefully when no payLink', () => {
  const params = { ...FULL_PARAMS, payLink: undefined };
  const en = renderTemplate('invoice_due', 'en', params);
  assert.doesNotMatch(en.body, /pay here/);
  assert.match(en.body, /INV-001/);
  const fr = renderTemplate('invoice_due', 'fr', params);
  assert.doesNotMatch(fr.body, /payer ici/);
});

test('invoice_overdue includes the pay link when present and is firmer in tone', () => {
  const en = renderTemplate('invoice_overdue', 'en', FULL_PARAMS);
  assert.match(en.body, /overdue/);
  assert.match(en.body, /https:\/\/pay\.example\.com\/inv-001/);
  const fr = renderTemplate('invoice_overdue', 'fr', FULL_PARAMS);
  assert.match(fr.body, /en retard/);
});

test('quote_followup_7d invites questions about the week-old quote', () => {
  const en = renderTemplate('quote_followup_7d', 'en', FULL_PARAMS);
  assert.match(en.body, /Q-042/);
  assert.match(en.body, /questions/i);
  const fr = renderTemplate('quote_followup_7d', 'fr', FULL_PARAMS);
  assert.match(fr.body, /Q-042/);
  assert.match(fr.body, /questions/);
});

test('review_request thanks the customer and asks for a Google review (no invented URL)', () => {
  const en = renderTemplate('review_request', 'en', FULL_PARAMS);
  assert.match(en.body, /thanks for choosing/i);
  assert.match(en.body, /Google review/);
  assert.doesNotMatch(en.body, /https?:\/\//, 'must not invent a review URL');
  const fr = renderTemplate('review_request', 'fr', FULL_PARAMS);
  assert.match(fr.body, /merci/i);
  assert.match(fr.body, /avis Google/);
});

test('templates degrade gracefully with minimal params', () => {
  const minimal: TemplateParams = { businessName: 'Maple Repairs', customerName: 'Sarah' };
  for (const id of TEMPLATE_IDS) {
    for (const locale of ['en', 'fr'] as MsgLocale[]) {
      const r = renderTemplate(id, locale, minimal);
      assert.ok(r.body.length > 0);
      assert.match(r.body, /Maple Repairs/);
      assert.doesNotMatch(r.body, /undefined/, `${id}/${locale} must not leak "undefined"`);
    }
  }
});
