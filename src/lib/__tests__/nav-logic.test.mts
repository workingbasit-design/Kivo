/**
 * Bottom-nav Money-tab gating: viewers without SEE_PRICES (technicians)
 * must not get the /money tab; everyone else keeps the full tab set.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isTabActive, visibleBottomTabs, MONEY_TAB_HREF } from '@/components/nav-logic.ts';

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

/**
 * isTabActive (2026-11-09 dark-mode digest fix): the morning-briefing
 * page (/digest) is the Today view, so the Today tab (/dashboard) reads
 * as active there instead of all five tabs sitting muted grey.
 */
describe('isTabActive', () => {
  it('treats /digest as the Today tab', () => {
    assert.equal(isTabActive('/digest', '/dashboard'), true);
    assert.equal(isTabActive('/digest/x', '/dashboard'), true);
  });

  it('does not light up other tabs on /digest', () => {
    assert.equal(isTabActive('/digest', '/schedule'), false);
    assert.equal(isTabActive('/digest', '/jobs'), false);
    assert.equal(isTabActive('/digest', '/money'), false);
  });

  it('keeps the exact and subpath rules for normal tabs', () => {
    assert.equal(isTabActive('/dashboard', '/dashboard'), true);
    assert.equal(isTabActive('/jobs/cm123', '/jobs'), true);
    assert.equal(isTabActive('/schedule', '/dashboard'), false);
    assert.equal(isTabActive('/dashboard', '/schedule'), false);
  });
});
