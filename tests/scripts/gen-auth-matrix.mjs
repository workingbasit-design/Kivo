#!/usr/bin/env node
/**
 * P4-A-001 — Authorization matrix generator.
 *
 * Scans every API route (src/app/api/.../route.ts) and every server action
 * (src/app/actions/*.ts), then emits tests/auth-matrix/matrix.json.
 *
 * Usage:
 *   node tests/scripts/gen-auth-matrix.mjs            # regenerate template
 *   node tests/scripts/gen-auth-matrix.mjs --check    # CI: fail on drift
 *
 * --check fails when the scanned inventory differs from the checked-in
 * matrix.json (new route/action added without a reviewed allow/deny entry),
 * so new routes can never skip authorization review.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../..', import.meta.url).pathname.replace(/\/$/, '');
const MATRIX_PATH = join(ROOT, 'tests', 'auth-matrix', 'matrix.json');

const PERSONAS = ['anonymous', 'consumer', 'ownerA', 'adminA', 'dispatcherA', 'technicianA', 'ownerB'];

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name === 'route.ts') out.push(p);
  }
  return out;
}

/** Heuristic auth classification from source signals. A human reviews the output. */
function classifyRoute(src) {
  if (/CRON_SECRET/.test(src)) return { auth: 'cron-secret', hint: 'deny:all-personas' };
  if (/stripe.*signature|constructEvent|webhook.*secret/i.test(src)) return { auth: 'webhook-signature', hint: 'deny:all-personas' };
  if (/apiKey|API_KEY|x-api-key/i.test(src)) return { auth: 'api-key', hint: 'deny:all-personas' };
  if (/\[token\]/.test(src) || /token/.test(src) && /params/.test(src)) return { auth: 'token', hint: 'verify:token-flow' };
  if (/requireAuth|getSession/.test(src)) return { auth: 'session', hint: 'allow:business-personas' };
  if (/getCustomerSession|requireCustomer/.test(src)) return { auth: 'customer-session', hint: 'allow:consumer' };
  return { auth: 'unknown', hint: 'REVIEW MANUALLY' };
}

function scanRoutes() {
  const routes = [];
  for (const file of walk(join(ROOT, 'src', 'app', 'api'))) {
    const src = readFileSync(file, 'utf8');
    const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].filter((m) =>
      new RegExp(`export\\s+(async\\s+)?function\\s+${m}\\b`).test(src),
    );
    if (!methods.length) continue;
    const routePath = '/api/' + relative(join(ROOT, 'src', 'app', 'api'), file).replace(/\/route\.ts$/, '');
    const { auth, hint } = classifyRoute(file + '\n' + src);
    routes.push({ type: 'route', path: routePath, methods, auth, hint });
  }
  return routes.sort((a, b) => a.path.localeCompare(b.path));
}

function scanActions() {
  const actions = [];
  const dir = join(ROOT, 'src', 'app', 'actions');
  for (const e of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
    const src = readFileSync(join(dir, e), 'utf8');
    if (!/^'use server'/m.test(src)) continue;
    const fns = [...src.matchAll(/^export\s+async\s+function\s+(\w+)/gm)].map((m) => m[1]);
    const auth = /requireAuth|getSession/.test(src)
      ? 'session'
      : /getCustomerSession|requireCustomer/.test(src)
        ? 'customer-session'
        : 'unknown';
    for (const fn of fns) {
      actions.push({ type: 'action', file: e, function: fn, auth, hint: auth === 'unknown' ? 'REVIEW MANUALLY' : '' });
    }
  }
  return actions.sort((a, b) => (a.file + a.function).localeCompare(b.file + b.function));
}

function templateEntry(item) {
  const expected = {};
  for (const p of PERSONAS) expected[p] = 'TODO';
  return { ...item, expected };
}

const inventory = [...scanRoutes(), ...scanActions()];
console.log(`Scanned: ${inventory.filter((i) => i.type === 'route').length} routes, ${inventory.filter((i) => i.type === 'action').length} actions`);

if (process.argv.includes('--check')) {
  if (!existsSync(MATRIX_PATH)) {
    console.error('matrix.json missing — run without --check first.');
    process.exit(1);
  }
  const checked = JSON.parse(readFileSync(MATRIX_PATH, 'utf8'));
  const key = (i) => (i.type === 'route' ? `route:${i.path}` : `action:${i.file}#${i.function}`);
  const have = new Set(checked.entries.map(key));
  const missing = inventory.filter((i) => !have.has(key(i)));
  const extra = checked.entries.filter((e) => ![...inventory.map(key)].includes(key(e)));
  if (missing.length || extra.length) {
    console.error('DRIFT: matrix.json is out of date.');
    for (const m of missing) console.error('  missing:', key(m));
    for (const e of extra) console.error('  removed:', key(e));
    process.exit(1);
  }
  const unreviewed = checked.entries.filter((e) => Object.values(e.expected).includes('TODO'));
  if (unreviewed.length) {
    console.error(`REVIEW: ${unreviewed.length} entries still have TODO verdicts.`);
    process.exit(1);
  }
  console.log('matrix.json is in sync and fully reviewed.');
} else {
  let entries;
  if (existsSync(MATRIX_PATH)) {
    // Preserve reviewed verdicts; add new entries as TODO.
    const checked = JSON.parse(readFileSync(MATRIX_PATH, 'utf8'));
    const key = (i) => (i.type === 'route' ? `route:${i.path}` : `action:${i.file}#${i.function}`);
    const prev = new Map(checked.entries.map((e) => [key(e), e]));
    entries = inventory.map((i) => prev.get(key(i)) ?? templateEntry(i));
  } else {
    entries = inventory.map(templateEntry);
  }
  writeFileSync(MATRIX_PATH, JSON.stringify({ personas: PERSONAS, entries }, null, 2) + '\n');
  console.log(`Wrote ${MATRIX_PATH} (${entries.length} entries)`);
}
