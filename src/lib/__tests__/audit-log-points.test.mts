/**
 * P1.0 F1a: money actions write an audit row.
 *
 * The audit log is the tamper-evident record of who moved money: every
 * consequential money action must call auditUserAction with the right
 * vocabulary action (src/lib/audit.ts AUDIT_ACTIONS) and entity type.
 * Transactional sites write inside the tx (a failed audit write rolls
 * the mutation back); non-transactional sites write after the mutation
 * and swallow failures (the mutation already committed).
 *
 * These are source-wiring pins in the repo's readFileSync style, like
 * role-enforcement.test.mts: for each money function, its body slice
 * must contain the auditUserAction call with the expected action. The
 * writer itself (scrubbing, append-only trigger) is covered by
 * audit-append-only.test.mts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { register } from 'node:module';

register('./register-loader.mjs', import.meta.url);

const { auditUserAction } = await import('../audit.ts');

const REPO = join(import.meta.dirname, '..', '..', '..');

function readRel(rel: string): string {
  return readFileSync(join(REPO, rel), 'utf8');
}

function bodyOf(src: string, fn: string): string {
  const start = src.indexOf(`export async function ${fn}(`);
  assert.ok(start > -1, `${fn} not found`);
  const next = src.indexOf('export async function', start + 10);
  return next === -1 ? src.slice(start) : src.slice(start, next);
}

interface AuditPoint {
  file: string;
  fn: string;
  action: string;
  entity: string;
  inTx: boolean;
}

const MONEY_POINTS: AuditPoint[] = [
  { file: 'src/app/actions/invoices.ts', fn: 'createInvoice', action: 'MONEY_CREATE', entity: 'Invoice', inTx: true },
  { file: 'src/app/actions/invoices.ts', fn: 'updateInvoiceStatus', action: 'MONEY_UPDATE', entity: 'Invoice', inTx: false },
  { file: 'src/app/actions/invoices.ts', fn: 'deleteInvoice', action: 'DELETE', entity: 'Invoice', inTx: false },
  { file: 'src/app/actions/invoices.ts', fn: 'voidInvoice', action: 'MONEY_VOID', entity: 'Invoice', inTx: false },
  { file: 'src/app/actions/invoices.ts', fn: 'voidPayment', action: 'PAYMENT_VOID', entity: 'Payment', inTx: true },
  { file: 'src/app/actions/invoices.ts', fn: 'createCreditNote', action: 'CREDIT_NOTE_CREATE', entity: 'CreditNote', inTx: true },
  { file: 'src/app/actions/invoices.ts', fn: 'recordPayment', action: 'PAYMENT_RECORD', entity: 'Payment', inTx: true },
  { file: 'src/app/actions/invoices.ts', fn: 'sendInvoiceEmail', action: 'INVOICE_SEND', entity: 'Invoice', inTx: false },
];

// F1b: team/settings, deletes, auth events. All non-transactional.
const F1B_POINTS: AuditPoint[] = [
  { file: 'src/app/actions/settings.ts', fn: 'updateBusinessSettings', action: 'SETTINGS_CHANGE', entity: 'Business', inTx: false },
  { file: 'src/app/actions/settings.ts', fn: 'inviteTeamMember', action: 'TEAM_INVITE', entity: 'Membership', inTx: false },
  { file: 'src/app/actions/settings.ts', fn: 'removeTeamMember', action: 'TEAM_REMOVE', entity: 'Membership', inTx: false },
  { file: 'src/app/actions/settings.ts', fn: 'suspendTeamMember', action: 'ARCHIVE', entity: 'Membership', inTx: false },
  { file: 'src/app/actions/settings.ts', fn: 'unsuspendTeamMember', action: 'RESTORE', entity: 'Membership', inTx: false },
  { file: 'src/app/actions/settings.ts', fn: 'changeTeamMemberRole', action: 'ROLE_CHANGE', entity: 'Membership', inTx: false },
  { file: 'src/app/actions/jobs.ts', fn: 'deleteJob', action: 'DELETE', entity: 'Job', inTx: false },
  { file: 'src/app/actions/customers.ts', fn: 'deleteCustomer', action: 'DELETE', entity: 'Customer', inTx: false },
  { file: 'src/app/actions/quotes.ts', fn: 'deleteQuote', action: 'DELETE', entity: 'Quote', inTx: false },
  { file: 'src/app/actions/quotes.ts', fn: 'recordQuoteDeposit', action: 'PAYMENT_RECORD', entity: 'QuoteDeposit', inTx: false },
  { file: 'src/app/actions/auth.ts', fn: 'login', action: 'LOGIN', entity: 'User', inTx: false },
  { file: 'src/app/actions/auth.ts', fn: 'logout', action: 'LOGOUT', entity: 'User', inTx: false },
  { file: 'src/app/actions/password-reset.ts', fn: 'resetPassword', action: 'PASSWORD_CHANGE', entity: 'User', inTx: false },
];

const SRC_CACHE = new Map<string, string>();
function srcOf(file: string): string {
  let src = SRC_CACHE.get(file);
  if (!src) {
    src = readRel(file);
    SRC_CACHE.set(file, src);
  }
  return src;
}

for (const { file, fn, action, entity, inTx } of [...MONEY_POINTS, ...F1B_POINTS]) {
  test(`${file} :: ${fn} audits ${action} on ${entity}`, () => {
    const body = bodyOf(srcOf(file), fn);
    assert.match(body, /auditUserAction\(/, `${fn} never calls auditUserAction`);
    assert.ok(
      body.includes(`'${action}'`),
      `${fn} must audit with action '${action}'`
    );
    assert.ok(
      body.includes(`'${entity}'`),
      `${fn} must audit entity type '${entity}'`
    );
    // The audit call itself must carry the actor (user / actorId).
    const callAt = body.indexOf('auditUserAction(');
    const call = body.slice(callAt, callAt + 200);
    assert.ok(
      call.includes('user') || call.includes('actorId'),
      `${fn} must pass the actor to the audit call`
    );
    if (inTx) {
      // Transactional sites pass the tx client, not the base client.
      assert.match(
        body,
        /auditUserAction\(\s*tx,/,
        `${fn} must audit inside the transaction (tx client)`
      );
    } else {
      // Non-transactional sites must not fail the response on audit error.
      assert.match(
        body,
        /catch \(err\) \{\s*\n?\s*console\.error\('[^']*: audit write failed/,
        `${fn} must swallow audit failures after the mutation committed`
      );
    }
  });
}

test('auditUserAction passes actor + action through to writeAuditEvent', async () => {
  const created: unknown[] = [];
  const fakeDb = {
    auditEvent: {
      create: async (args: unknown) => {
        created.push(args);
        return { id: 'ev1' };
      },
    },
  };
  await auditUserAction(
    fakeDb as never,
    { businessId: 'biz1', user: { id: 'user9' } },
    'PAYMENT_RECORD',
    'Payment',
    'pay1',
    { status: 'COMPLETED' },
    { amountCents: '1000' }
  );
  assert.equal(created.length, 1);
  const data = (created[0] as { data: Record<string, unknown> }).data;
  assert.equal(data.businessId, 'biz1');
  assert.equal(data.actorId, 'user9');
  assert.equal(data.actorType, 'USER');
  assert.equal(data.action, 'PAYMENT_RECORD');
  assert.equal(data.entityType, 'Payment');
  assert.equal(data.entityId, 'pay1');
});
