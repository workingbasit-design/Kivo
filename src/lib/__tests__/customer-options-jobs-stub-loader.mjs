/**
 * Resolve hook for the customer-options jobs route test (2026-11-08).
 * Redirects framework/data modules to the in-memory stub.
 */
import { existsSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const stubUrl = new URL('./customer-options-jobs-stub.mjs', import.meta.url).href;

const STUBBED = new Set([
  'next/server',
  '@/lib/prisma',
  '@/lib/auth',
  '@/lib/membership',
]);

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
  if (STUBBED.has(specifier)) {
    return { url: stubUrl, shortCircuit: true };
  }
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !path.extname(specifier)) {
      const parentPath = path.dirname(pathToFileURL(context.parentURL).pathname);
      const resolved = tryTs(path.resolve(parentPath, specifier));
      if (resolved) return { url: resolved, shortCircuit: true };
    }
    throw err;
  }
}
