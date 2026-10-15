#!/usr/bin/env node
/**
 * Fill tests/auth-matrix/matrix.json expected verdicts from auth signals.
 *
 * Verdicts: allow | deny | redirect | TODO (needs human review).
 * This is a first pass — the P4-A tests verify each verdict against the live
 * app; mismatches are triaged as bugs or corrected verdicts.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const PATH = new URL('../auth-matrix/matrix.json', import.meta.url).pathname;
const matrix = JSON.parse(readFileSync(PATH, 'utf8'));

// Path groups for role scoping.
const MONEY = /pay|stripe|export|reports|billing/i;
const SETTINGS_TEAM = /integrations|push\/|api-keys|webhooks/i;
const JOBS_OK = /offline-jobs|locations|tracking|dispatch/i;
const CUSTOMER_RW = /\/api\/v1\/customers|\/api\/customers/i;

function routeVerdicts(entry) {
  const v = {};
  const p = entry.path;
  switch (entry.auth) {
    case 'cron-secret':
    case 'webhook-signature':
    case 'api-key':
      for (const persona of matrix.personas) v[persona] = 'deny';
      return v;
    case 'token':
      // Tested with an invalid token -> 404 for everyone.
      for (const persona of matrix.personas) v[persona] = 'deny';
      return v;
    case 'customer-session':
      for (const persona of matrix.personas) v[persona] = persona === 'consumer' ? 'allow' : 'deny';
      return v;
    case 'session':
      break;
    default:
      for (const persona of matrix.personas) v[persona] = 'TODO';
      return v;
  }
  // session routes:
  v.anonymous = 'deny';
  v.consumer = 'deny';
  v.ownerA = 'allow';
  // ADMIN: everything except team role changes and Stripe Connect.
  v.adminA = /stripe\/connect|integrations\/api-keys/.test(p) ? 'deny' : 'allow';
  // DISPATCHER: jobs/schedule/customers/quotes/invoices; no money settings, no team, no void.
  v.dispatcherA = MONEY.test(p) || SETTINGS_TEAM.test(p) ? 'deny' : 'allow';
  // TECHNICIAN: own jobs, notes/photos/checklist, time; read-only otherwise; no money/settings.
  v.technicianA = JOBS_OK.test(p) ? 'allow' : 'deny';
  // ownerB with A's IDs: cross-tenant -> deny.
  v.ownerB = 'deny';
  return v;
}

function actionVerdicts(entry) {
  const v = {};
  const f = entry.file;
  if (entry.auth !== 'session') {
    for (const persona of matrix.personas) v[persona] = entry.auth === 'unknown' ? 'TODO' : 'deny';
    if (entry.auth === 'customer-session') v.consumer = 'allow';
    return v;
  }
  const moneyFile = /invoice|payment|stripe|billing|money|report|export/i.test(f);
  const settingsFile = /settings|team|membership|integration|push|webhook/i.test(f);
  const jobFile = /job|schedule|dispatch|time|note|photo|checklist|equipment/i.test(f);
  v.anonymous = 'deny';
  v.consumer = 'deny';
  v.ownerA = 'allow';
  v.adminA = /stripe|api-key/i.test(f) ? 'deny' : 'allow';
  v.dispatcherA = moneyFile || settingsFile ? 'deny' : 'allow';
  v.technicianA = jobFile && !moneyFile && !settingsFile ? 'allow' : 'deny';
  v.ownerB = 'deny';
  return v;
}

let todos = 0;
for (const e of matrix.entries) {
  const filled = e.type === 'route' ? routeVerdicts(e) : actionVerdicts(e);
  for (const [persona, verdict] of Object.entries(filled)) {
    if (e.expected[persona] === 'TODO') e.expected[persona] = verdict;
  }
  todos += Object.values(e.expected).filter((x) => x === 'TODO').length;
}

writeFileSync(PATH, JSON.stringify(matrix, null, 2) + '\n');
console.log(`Filled. Remaining TODO verdicts: ${todos}`);
