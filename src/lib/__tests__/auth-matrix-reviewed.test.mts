import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const MATRIX_PATH = new URL('../../../tests/auth-matrix/matrix.json', import.meta.url);

// Regression test for the 2026-10-17 CI incident: validate failed at
// `gen-auth-matrix.mjs --check` because 4 new server actions (Part 0 demo
// actions, onboarding actions) had no reviewed allow/deny entries. The CI
// gate fails on inventory drift AND on TODO verdicts, so every entry in
// matrix.json must carry a human-reviewed verdict for all 7 personas.
test('auth-matrix: every entry is fully reviewed (no TODO verdicts)', () => {
  const matrix = JSON.parse(readFileSync(MATRIX_PATH, 'utf8')) as {
    personas: string[];
    entries: Array<{
      type: string;
      path?: string;
      file?: string;
      function?: string;
      expected: Record<string, string>;
    }>;
  };
  const unreviewed: string[] = [];
  for (const e of matrix.entries) {
    const label =
      e.type === 'route' ? `route:${e.path}` : `action:${e.file}#${e.function}`;
    for (const p of matrix.personas) {
      if (e.expected[p] === 'TODO') unreviewed.push(`${label} [${p}]`);
    }
  }
  assert.deepEqual(
    unreviewed,
    [],
    `unreviewed matrix entries (run: node tests/scripts/gen-auth-matrix.mjs, ` +
      `review the new entries, then --check):\n` +
      unreviewed.join('\n'),
  );
});
