/**
 * Test-only resolve hook for the copilot engine test (registered from inside
 * that test file, so it only affects its subprocess):
 *  1. Redirects `@/lib/prisma` to the in-memory stub (no database).
 *  2. Resolves extensionless relative imports (`./parse` -> `./parse.ts`),
 *     which the @/ alias loader does not handle.
 */
import { existsSync, statSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const stubUrl = new URL('./prisma-stub.mjs', import.meta.url).href;

function tryTs(basePath) {
  for (const ext of ['.ts', '.tsx', '.mts', '']) {
    const full = basePath + ext;
    try {
      if (existsSync(full) && statSync(full).isFile()) {
        return pathToFileURL(full).href;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (
    specifier === '@/lib/prisma' ||
    specifier.endsWith('/lib/prisma') ||
    specifier.endsWith('/lib/prisma.ts')
  ) {
    return { url: stubUrl, shortCircuit: true };
  }
  if (
    (specifier.startsWith('./') || specifier.startsWith('../')) &&
    context.parentURL &&
    context.parentURL.startsWith('file:')
  ) {
    const base = path.resolve(fileURLToPath(new URL(specifier, context.parentURL)));
    const url = tryTs(base);
    if (url) return { url, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
