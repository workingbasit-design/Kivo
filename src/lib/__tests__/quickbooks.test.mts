/**
 * QuickBooks Online integration tests (src/lib/quickbooks.ts).
 * Mapping functions + sync-log behavior with mocked fetch — zero network.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAuthorizeUrl,
  exchangeCode,
  refreshAccessToken,
  mapCustomerToQB,
  mapInvoiceToQB,
  mapPaymentToQB,
  qbErrorMessage,
  qbErrorCodes,
  getValidAccessToken,
  syncCustomer,
  syncInvoice,
  syncPayment,
  type QBSyncDb,
  type QBConnectionLike,
  type QBCreds,
} from '../quickbooks.ts';

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

type FetchFn = typeof fetch;

function mockFetch(handler: (url: string, init?: RequestInit) => unknown): FetchFn {
  return (async (url: unknown, init?: RequestInit) => {
    const out = handler(String(url), init);
    if (out instanceof Response) return out;
    const { status = 200, body = {} } = out as { status?: number; body?: unknown };
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as FetchFn;
}

function makeDb(logs: Array<Record<string, unknown>> = []): QBSyncDb & { logs: typeof logs } {
  return {
    logs,
    quickBooksSyncLog: {
      create: async (args: { data: Record<string, unknown> }) => {
        logs.push({ ...args.data });
        return args.data;
      },
      findFirst: async (args: {
        where: { businessId: string; entityType: string; entityId: string; status: string };
      }) => {
        const hit = logs.find(
          (l) =>
            l.businessId === args.where.businessId &&
            l.entityType === args.where.entityType &&
            l.entityId === args.where.entityId &&
            l.status === args.where.status
        );
        return hit ? { qbId: (hit.qbId as string) ?? null } : null;
      },
    },
    quickBooksConnection: {
      update: async () => ({}),
    },
  };
}

const CREDS: QBCreds = { clientId: 'cid', clientSecret: 'csec', sandbox: true };

function conn(over: Partial<QBConnectionLike> = {}): QBConnectionLike {
  return {
    realmId: '12345',
    accessToken: 'at',
    refreshToken: 'rt',
    expiresAt: new Date(Date.now() + 3600_000),
    ...over,
  };
}

const BASE = {
  businessId: 'biz1',
  creds: CREDS,
  db: makeDb(),
  conn: conn(),
};

/* ------------------------------------------------------------------ */
/* OAuth                                                                */
/* ------------------------------------------------------------------ */

test('buildAuthorizeUrl points at Intuit with the accounting scope', () => {
  const url = buildAuthorizeUrl({
    clientId: 'cid',
    redirectUri: 'https://app.example/api/integrations/quickbooks/callback',
    state: 's123',
  });
  const u = new URL(url);
  assert.equal(`${u.origin}${u.pathname}`, 'https://appcenter.intuit.com/connect/oauth2');
  assert.equal(u.searchParams.get('response_type'), 'code');
  assert.equal(u.searchParams.get('client_id'), 'cid');
  assert.equal(u.searchParams.get('state'), 's123');
  assert.ok(u.searchParams.get('scope')?.includes('com.intuit.quickbooks.accounting'));
});

test('exchangeCode parses the token response', async () => {
  const seen: string[] = [];
  const fetchFn = mockFetch((url, init) => {
    seen.push(String(init?.body));
    assert.ok(String(url).includes('oauth.platform.intuit.com'));
    return { body: { access_token: 'AT', refresh_token: 'RT', expires_in: 3600 } };
  });
  const r = await exchangeCode('code1', 'https://app.example/cb', 'cid', 'csec', fetchFn);
  assert.equal(r.ok, true);
  assert.equal(r.accessToken, 'AT');
  assert.equal(r.refreshToken, 'RT');
  assert.equal(r.expiresIn, 3600);
  assert.ok(seen[0].includes('grant_type=authorization_code'));
});

test('exchangeCode surfaces Intuit error descriptions', async () => {
  const fetchFn = mockFetch(() => ({
    status: 400,
    body: { error: 'invalid_grant', error_description: 'Authorization code expired.' },
  }));
  const r = await exchangeCode('bad', 'https://app.example/cb', 'cid', 'csec', fetchFn);
  assert.equal(r.ok, false);
  assert.equal(r.error, 'Authorization code expired.');
});

test('refreshAccessToken uses the refresh_token grant', async () => {
  const seen: string[] = [];
  const fetchFn = mockFetch((_url, init) => {
    seen.push(String(init?.body));
    return { body: { access_token: 'AT2', refresh_token: 'RT2', expires_in: 3600 } };
  });
  const r = await refreshAccessToken('RT', 'cid', 'csec', fetchFn);
  assert.equal(r.ok, true);
  assert.equal(r.accessToken, 'AT2');
  assert.ok(seen[0].includes('grant_type=refresh_token'));
});

/* ------------------------------------------------------------------ */
/* Mapping                                                              */
/* ------------------------------------------------------------------ */

test('mapCustomerToQB maps contact fields and a Canadian bill-to address', () => {
  const p = mapCustomerToQB({
    id: 'c1',
    name: 'Jane Doe',
    email: 'jane@example.ca',
    phone: '416-555-0100',
    address: '12 Maple St',
    province: 'ON',
    postalCode: 'M4B 1B3',
  });
  assert.equal(p.DisplayName, 'Jane Doe');
  assert.deepEqual(p.PrimaryEmailAddr, { Address: 'jane@example.ca' });
  assert.deepEqual(p.PrimaryPhone, { FreeFormNumber: '416-555-0100' });
  assert.deepEqual(p.BillAddr, {
    Line1: '12 Maple St',
    CountrySubDivisionCode: 'ON',
    PostalCode: 'M4B 1B3',
    Country: 'CA',
  });
});

test('mapCustomerToQB omits empty contact blocks', () => {
  const p = mapCustomerToQB({ id: 'c1', name: 'Bob' });
  assert.equal(p.DisplayName, 'Bob');
  assert.ok(!('PrimaryEmailAddr' in p));
  assert.ok(!('BillAddr' in p));
});

test('mapInvoiceToQB maps every line 1:1 — never merged or dropped', () => {
  const p = mapInvoiceToQB(
    {
      id: 'i1',
      number: 'INV-001',
      date: new Date('2026-09-10T00:00:00Z'),
      taxAmount: 32.5,
      total: 282.5,
      status: 'UNPAID',
      notes: null,
      customerId: 'c1',
    },
    [
      { description: 'Drain cleaning', qty: 1, unitPrice: 199.99 },
      { description: 'Parts', qty: 2, unitPrice: 25.005 },
    ],
    '987',
    { value: '1', name: 'Services' }
  );
  assert.deepEqual(p.CustomerRef, { value: '987' });
  assert.equal(p.DocNumber, 'INV-001');
  assert.equal(p.TxnDate, '2026-09-10');
  const lines = p.Line as Array<Record<string, unknown>>;
  assert.equal(lines.length, 2); // 1:1 — nothing collapsed
  assert.equal(lines[0].DetailType, 'SalesItemLineDetail');
  assert.equal(lines[0].Amount, 199.99);
  assert.equal(lines[1].Amount, 50.01); // 2 × 25.005 rounded to cents
  assert.deepEqual(p.TxnTaxDetail, { TotalTax: 32.5 });
});

test('mapInvoiceToQB omits tax detail when there is no tax', () => {
  const p = mapInvoiceToQB(
    { id: 'i1', number: 'INV-2', date: new Date(), taxAmount: 0, total: 100, status: 'UNPAID', customerId: 'c1' },
    [{ description: 'Labour', qty: 1, unitPrice: 100 }],
    '987',
    { value: '1', name: 'Services' }
  );
  assert.ok(!('TxnTaxDetail' in p));
});

test('mapPaymentToQB links the payment to the QuickBooks invoice', () => {
  const p = mapPaymentToQB(
    { id: 'p1', amount: 150.555, provider: 'INTERAC', transactionId: 'txn_1', invoiceId: 'i1', createdAt: new Date('2026-09-12T00:00:00Z') },
    '987',
    '555'
  );
  assert.equal(p.TotalAmt, 150.56);
  const line = (p.Line as Array<Record<string, unknown>>)[0];
  assert.deepEqual(line.LinkedTxn, [{ TxnId: '555', TxnType: 'Invoice' }]);
  assert.ok(String(p.PrivateNote).includes('INTERAC'));
});

/* ------------------------------------------------------------------ */
/* Fault parsing                                                        */
/* ------------------------------------------------------------------ */

test('qbErrorMessage extracts Intuit fault details', () => {
  const msg = qbErrorMessage({
    Fault: { Error: [{ Message: 'Duplicate Name Exists', Detail: 'The name supplied already exists.', code: '6240' }] },
  });
  assert.ok(msg?.includes('already exists'));
  assert.deepEqual(qbErrorCodes({ Fault: { Error: [{ code: '6240' }] } }), ['6240']);
  assert.equal(qbErrorMessage({}), null);
  assert.equal(qbErrorMessage(null), null);
});

/* ------------------------------------------------------------------ */
/* Token refresh                                                        */
/* ------------------------------------------------------------------ */

test('getValidAccessToken reuses a fresh token without network', async () => {
  let calls = 0;
  const fetchFn = mockFetch(() => {
    calls += 1;
    return { body: {} };
  });
  const db = makeDb();
  const r = await getValidAccessToken(conn(), 'biz1', CREDS, db, fetchFn);
  assert.equal(r.ok, true);
  assert.equal(r.accessToken, 'at');
  assert.equal(calls, 0);
});

test('getValidAccessToken refreshes an expiring token and persists it', async () => {
  const fetchFn = mockFetch(() => ({ body: { access_token: 'NEW', refresh_token: 'NEWRT', expires_in: 3600 } }));
  let saved: unknown = null;
  const db = makeDb();
  db.quickBooksConnection.update = (async (args: { data: unknown }) => {
    saved = args.data;
    return {};
  }) as QBSyncDb['quickBooksConnection']['update'];
  const c = conn({ expiresAt: new Date(Date.now() + 10_000) });
  const r = await getValidAccessToken(c, 'biz1', CREDS, db, fetchFn);
  assert.equal(r.ok, true);
  assert.equal(r.accessToken, 'NEW');
  assert.equal((saved as { accessToken: string }).accessToken, 'NEW');
});

test('getValidAccessToken reports reconnect when refresh fails', async () => {
  const fetchFn = mockFetch(() => ({ status: 400, body: { error: 'invalid_grant' } }));
  const r = await getValidAccessToken(conn({ expiresAt: new Date(Date.now() - 1000) }), 'biz1', CREDS, makeDb(), fetchFn);
  assert.equal(r.ok, false);
  assert.ok(r.error?.toLowerCase().includes('reconnect'));
});

/* ------------------------------------------------------------------ */
/* Sync + per-entity logging                                            */
/* ------------------------------------------------------------------ */

test('syncCustomer writes a synced log row with the QuickBooks id', async () => {
  const fetchFn = mockFetch((url) => {
    assert.ok(String(url).includes('/customer?'));
    return { body: { Customer: { Id: '101' } } };
  });
  const db = makeDb();
  const out = await syncCustomer({ ...BASE, db }, { id: 'c1', name: 'Jane' }, fetchFn);
  assert.equal(out.status, 'synced');
  assert.equal(out.qbId, '101');
  assert.equal(db.logs.length, 1);
  assert.deepEqual(
    { ...db.logs[0], businessId: 'biz1' },
    { businessId: 'biz1', entityType: 'customer', entityId: 'c1', qbId: '101', status: 'synced', detail: null }
  );
});

test('syncCustomer skips (with a log row) when already synced — no duplicate', async () => {
  let calls = 0;
  const fetchFn = mockFetch(() => {
    calls += 1;
    return { body: {} };
  });
  const db = makeDb([
    { businessId: 'biz1', entityType: 'customer', entityId: 'c1', qbId: '101', status: 'synced', detail: null },
  ]);
  const out = await syncCustomer({ ...BASE, db }, { id: 'c1', name: 'Jane' }, fetchFn);
  assert.equal(out.status, 'skipped');
  assert.equal(calls, 0);
  assert.equal(db.logs.length, 2); // the skip itself is logged
  assert.equal(db.logs[1].status, 'skipped');
});

test('syncCustomer links the existing record on duplicate-name (6240)', async () => {
  const fetchFn = mockFetch((url) => {
    if (String(url).includes('/query?')) return { body: { QueryResponse: { Customer: [{ Id: '202' }] } } };
    return {
      status: 400,
      body: { Fault: { Error: [{ code: '6240', Detail: 'Duplicate Name Exists.' }] } },
    };
  });
  const db = makeDb();
  const out = await syncCustomer({ ...BASE, db }, { id: 'c9', name: 'Sam' }, fetchFn);
  assert.equal(out.status, 'synced');
  assert.equal(out.qbId, '202');
  assert.ok(out.detail?.toLowerCase().includes('existing'));
});

test('syncCustomer logs failed with the Intuit reason on other errors', async () => {
  const fetchFn = mockFetch(() => ({
    status: 400,
    body: { Fault: { Error: [{ code: '6000', Detail: 'A business validation error has occurred.' }] } },
  }));
  const db = makeDb();
  const out = await syncCustomer({ ...BASE, db }, { id: 'c2', name: 'Zed' }, fetchFn);
  assert.equal(out.status, 'failed');
  assert.ok(out.detail?.includes('business validation'));
  assert.equal(db.logs[0].status, 'failed');
});

test('syncInvoice skips with a reason when the customer is not synced yet', async () => {
  let calls = 0;
  const fetchFn = mockFetch(() => {
    calls += 1;
    return { body: {} };
  });
  const db = makeDb();
  const out = await syncInvoice(
    { ...BASE, db },
    { id: 'i1', number: 'INV-1', date: new Date(), taxAmount: 0, total: 100, status: 'UNPAID', customerId: 'c1' },
    [{ description: 'Labour', qty: 1, unitPrice: 100 }],
    null, // customer not synced
    { value: '1', name: 'Services' },
    fetchFn
  );
  assert.equal(out.status, 'skipped');
  assert.equal(calls, 0);
  assert.ok(out.detail?.toLowerCase().includes('customer'));
  assert.equal(db.logs.length, 1);
});

test('syncInvoice skips line-less invoices', async () => {
  const db = makeDb();
  const out = await syncInvoice(
    { ...BASE, db },
    { id: 'i2', number: 'INV-2', date: new Date(), taxAmount: 0, total: 0, status: 'UNPAID', customerId: 'c1' },
    [],
    '987',
    { value: '1', name: 'Services' }
  );
  assert.equal(out.status, 'skipped');
  assert.ok(out.detail?.toLowerCase().includes('line items'));
});

test('syncInvoice posts the mapped payload and logs the QuickBooks id', async () => {
  let posted: unknown = null;
  const fetchFn = mockFetch((_url, init) => {
    posted = JSON.parse(String(init?.body));
    return { body: { Invoice: { Id: '303' } } };
  });
  const db = makeDb();
  const out = await syncInvoice(
    { ...BASE, db },
    { id: 'i3', number: 'INV-3', date: new Date('2026-09-10T00:00:00Z'), taxAmount: 13, total: 113, status: 'UNPAID', customerId: 'c1' },
    [{ description: 'Callout', qty: 1, unitPrice: 100 }],
    '987',
    { value: '7', name: 'Services' },
    fetchFn
  );
  assert.equal(out.status, 'synced');
  assert.equal(out.qbId, '303');
  const p = posted as Record<string, unknown>;
  assert.deepEqual(p.CustomerRef, { value: '987' });
  assert.equal((p.Line as unknown[]).length, 1);
});

test('syncPayment skips non-completed payments with a reason', async () => {
  const db = makeDb();
  const out = await syncPayment(
    { ...BASE, db },
    { id: 'p1', amount: 50, provider: 'CASH', invoiceId: 'i1', createdAt: new Date(), status: 'PENDING' },
    '987',
    '303'
  );
  assert.equal(out.status, 'skipped');
  assert.ok(out.detail?.includes('PENDING'));
});

test('syncPayment links to the synced invoice and logs the id', async () => {
  let posted: unknown = null;
  const fetchFn = mockFetch((_url, init) => {
    posted = JSON.parse(String(init?.body));
    return { body: { Payment: { Id: '404' } } };
  });
  const db = makeDb();
  const out = await syncPayment(
    { ...BASE, db },
    { id: 'p2', amount: 113, provider: 'INTERAC', invoiceId: 'i3', createdAt: new Date(), status: 'COMPLETED' },
    '987',
    '303',
    fetchFn
  );
  assert.equal(out.status, 'synced');
  assert.equal(out.qbId, '404');
  const line = ((posted as Record<string, unknown>).Line as Array<Record<string, unknown>>)[0];
  assert.deepEqual(line.LinkedTxn, [{ TxnId: '303', TxnType: 'Invoice' }]);
});
