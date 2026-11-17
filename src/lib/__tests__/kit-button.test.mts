/**
 * Regression test: disabled kit buttons must LOOK disabled.
 *
 * The kit CSS only styles `.btn:disabled`, but kitButtonClass never emits
 * `.btn`, so a disabled primary button used to render at full hi-vis lime
 * and read as tappable — users tapped Reviews "Save review" (disabled: no
 * completed + paid job) and reported it as broken, with no visible reason.
 * The disabled treatment now lives in the shared base class so every
 * disabled kit button dims and shows not-allowed.
 *
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs
 *   src/lib/__tests__/kit-button.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { kitButtonClass } from '../../components/kit/kit-button.ts';

const VARIANTS = ['primary', 'secondary', 'ghost', 'danger'] as const;

for (const variant of VARIANTS) {
  test(`kitButtonClass(${variant}): disabled state is visibly inert`, () => {
    const cls = kitButtonClass(variant);
    assert.ok(
      cls.includes('disabled:opacity-50'),
      `${variant} must dim when disabled, got: ${cls}`,
    );
    assert.ok(
      cls.includes('disabled:cursor-not-allowed'),
      `${variant} must show not-allowed cursor when disabled, got: ${cls}`,
    );
  });
}

test('kitButtonClass: variants and modifiers still apply', () => {
  assert.ok(kitButtonClass('primary').includes('bg-hivis'));
  assert.ok(kitButtonClass('secondary').includes('bg-surface'));
  assert.ok(kitButtonClass('primary', { sm: true }).includes('min-h-[44px]'));
  assert.ok(kitButtonClass('primary', { block: true }).includes('w-full'));
});
