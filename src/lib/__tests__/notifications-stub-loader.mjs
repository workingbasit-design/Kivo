/**
 * Test-only resolve hook for the notification sync test: redirects
 * `@/lib/prisma` to the notification fixtures stub (no database), and
 * resolves extensionless relative imports.
 */
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const stubUrl = new URL('./notifications-stub.mjs', import.meta.url).href;

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
  if (specifier === '@/lib/prisma') {
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
