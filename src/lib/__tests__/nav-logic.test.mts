/**
 * Bottom-nav Money-tab gating: viewers without SEE_PRICES (technicians)
 * must not get the /money tab; everyone else keeps the full tab set.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { visibleBottomTabs, MONEY_TAB_HREF } from '@/components/nav-logic.ts';

const TABS = [
  { href: '/dashboard' },
  { href: '/schedule' },
  { href: '/jobs' },
  { href: '/money' },
];

describe('visibleBottomTabs', () => {
  it('keeps every tab (including Money) when showMoney is true', () => {
    const out = visibleBottomTabs(TABS, true);
    assert.deepEqual(
      out.map((t) => t.href),
      ['/dashboard', '/schedule', '/jobs', '/money']
    );
  });

  it('removes only the Money tab when showMoney is false', () => {
    const out = visibleBottomTabs(TABS, false);
    assert.deepEqual(
      out.map((t) => t.href),
      ['/dashboard', '/schedule', '/jobs']
    );
    assert.equal(out.some((t) => t.href === MONEY_TAB_HREF), false);
  });

  it('does not mutate the input array', () => {
    const input = [...TABS];
    visibleBottomTabs(input, false);
    assert.equal(input.length, 4);
  });
});
