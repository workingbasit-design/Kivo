/**
 * Resolve hook for the B1.1 cross-tenant attachments route test.
 * Redirects framework/data modules to the in-memory stub.
 */
import { existsSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const stubUrl = new URL('./attachments-route-stub.mjs', import.meta.url).href;

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
  if (specifier === '@/lib/upload-validate') {
    // Not needed for the download path; stub to avoid loading.
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
