/**
 * Test-only ESM loader: maps the `@/` path alias to `src/` so pure modules
 * that use `@/lib/...` imports (e.g. src/lib/copilot/parse.ts) can run under
 * plain `node --test` without a bundler.
 *
 * Usage: node --test --import ./src/lib/__tests__/loader.mjs 'src/lib/__tests__/*.test.mts'
 */
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));

function tryFile(base) {
  for (const ext of ['.ts', '.tsx', '.mts', '']) {
    const full = base + ext;
    try {
      if (existsSync(full) && statSync(full).isFile()) {
        return pathToFileURL(full).href;
      }
    } catch {
      /* ignore */
    }
  }
  // Directory import (e.g. `@/lib/i18n` → `src/lib/i18n/index.ts`).
  try {
    if (existsSync(base) && statSync(base).isDirectory()) {
      for (const ext of ['.ts', '.tsx', '.mts']) {
        const indexFile = path.join(base, 'index' + ext);
        if (existsSync(indexFile) && statSync(indexFile).isFile()) {
          return pathToFileURL(indexFile).href;
        }
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const url = tryFile(path.join(SRC_DIR, specifier.slice(2)));
    if (url) return { url, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
