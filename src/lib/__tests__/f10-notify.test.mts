/**
 * F10: event-driven notifications — unit tests.
 *
 * F10-001: event -> notification text (en + fr), rendered at read time.
 * F10-002: preferences + feature flag gate event creation; idempotent.
 *
 * Uses an in-memory prisma stub (no database).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./f10-prisma-stub-loader.mjs', import.meta.url);

const {
  notifyEvent,
  listNotificationsFor,
  getUnreadCountFor,
  renderF10Title,
  renderF10Body,
  FLAG_NOTIFICATIONS,
} = await import('../f10-notify.ts');
const { businesses, notifications, resetF10Stub } = await import('./f10-prisma-stub.mjs');

function biz(id: string, opts: { settings?: string | null; flags?: string | null } = {}) {
  businesses.set(id, {
    notificationSettings: opts.settings ?? null,
    featureFlags: opts.flags ?? JSON.stringify({ [FLAG_NOTIFICATIONS]: true }),
  });
}

test('F10-001: event -> notification text (en)', () => {
  assert.equal(
    renderF10Title('lead_new', { name: 'Jane Doe' }, 'en'),
    'New lead: Jane Doe'
  );
  assert.equal(
    renderF10Body('lead_new', { phone: '416-555-0100', source: 'Website' }, 'en'),
    '416-555-0100, Website'
  );
  assert.equal(
    renderF10Title('quote_accepted', { number: 'Q-1042' }, 'en'),
    'Quote Q-1042 accepted'
  );
  assert.equal(
    renderF10Body('quote_accepted', { customer: 'Jane Doe', amount: '249.9' }, 'en'),
    'Jane Doe, 249.9'
  );
  assert.equal(
    renderF10Title('quote_declined', { number: 'Q-1043' }, 'en'),
    'Quote Q-1043 declined'
  );
});

test('F10-001: event -> notification text (fr)', () => {
  assert.equal(
    renderF10Title('lead_new', { name: 'Jean Tremblay' }, 'fr'),
    'Nouveau prospect : Jean Tremblay'
  );
  assert.equal(
    renderF10Title('quote_accepted', { number: 'Q-1042' }, 'fr'),
    'Soumission Q-1042 acceptée'
  );
  assert.equal(
    renderF10Body('quote_declined', { customer: 'Jean', amount: '100' }, 'fr'),
    'Jean, 100'
  );
  assert.equal(
    renderF10Title('change_requested', { number: 'Q-1050' }, 'fr'),
    'Changement demandé sur la soumission Q-1050'
  );
});

test('F10-002: notifyEvent creates when flag on and type enabled', async () => {
  resetF10Stub();
  biz('b1');
  const ok = await notifyEvent('b1', {
    type: 'lead_new',
    dedupeKey: 'lead_new:lead1',
    href: '/leads/lead1',
    data: { name: 'Jane' },
    entityType: 'LEAD',
    entityId: 'lead1',
  });
  assert.equal(ok, true);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].businessId, 'b1');
  assert.equal(notifications[0].type, 'lead_new');
  assert.equal(notifications[0].entityType, 'LEAD');
  assert.equal(notifications[0].entityId, 'lead1');
});

test('F10-002: notifyEvent blocked when feature flag off', async () => {
  resetF10Stub();
  biz('b1', { flags: JSON.stringify({}) });
  const ok = await notifyEvent('b1', {
    type: 'lead_new',
    dedupeKey: 'lead_new:lead1',
    href: '/leads/lead1',
    data: { name: 'Jane' },
  });
  assert.equal(ok, false);
  assert.equal(notifications.length, 0);
});

test('F10-002: notifyEvent blocked when type disabled in preferences', async () => {
  resetF10Stub();
  biz('b1', { settings: JSON.stringify({ lead_new: false }) });
  const ok = await notifyEvent('b1', {
    type: 'lead_new',
    dedupeKey: 'lead_new:lead1',
    href: '/leads/lead1',
    data: { name: 'Jane' },
  });
  assert.equal(ok, false);
  assert.equal(notifications.length, 0);
});

test('F10-002: notifyEvent is idempotent on dedupeKey', async () => {
  resetF10Stub();
  biz('b1');
  const evt = {
    type: 'quote_accepted',
    dedupeKey: 'quote_decision:q1:APPROVED',
    href: '/quotes/q1',
    data: { number: 'Q-1' },
  };
  assert.equal(await notifyEvent('b1', evt), true);
  assert.equal(await notifyEvent('b1', evt), false); // duplicate
  assert.equal(notifications.length, 1);
});

test('F10-002: unknown business creates nothing', async () => {
  resetF10Stub();
  const ok = await notifyEvent('nope', {
    type: 'lead_new',
    dedupeKey: 'x',
    href: null,
    data: {},
  });
  assert.equal(ok, false);
});

test('F10-007: technician sees only business-wide + own notifications', async () => {
  resetF10Stub();
  biz('b1');
  await notifyEvent('b1', { type: 'lead_new', dedupeKey: 'a', href: null, data: {} });
  await notifyEvent('b1', { type: 'lead_new', dedupeKey: 'b', href: null, data: {}, userId: 'tech1' });
  await notifyEvent('b1', { type: 'lead_new', dedupeKey: 'c', href: null, data: {}, userId: 'tech2' });

  const tech1 = await listNotificationsFor('b1', 'tech1');
  assert.equal(tech1.length, 2); // business-wide + own

  const tech2 = await listNotificationsFor('b1', 'tech2');
  assert.equal(tech2.length, 2);

  const owner = await listNotificationsFor('b1', undefined);
  assert.equal(owner.length, 3);

  assert.equal(await getUnreadCountFor('b1', 'tech1'), 2);
  assert.equal(await getUnreadCountFor('b1', undefined), 3);
});
