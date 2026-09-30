/**
 * QuickBooks Online integration — one-way sync EveryJob → QuickBooks.
 *
 * Design goals (vs. syncs that silently drop records):
 *  - Every entity gets a QuickBooksSyncLog row: synced | failed | skipped,
 *    always with a human-readable reason. Nothing vanishes quietly.
 *  - Idempotent: an entity already synced is skipped with a reason, never
 *    duplicated.
 *  - Graceful degradation: expired tokens auto-refresh; unrecoverable auth
 *    failures surface as failed log rows, not crashes.
 *
 * Money stays in CAD; EveryJob never pulls data out of QuickBooks.
 * `fetchFn` is injectable so tests run with zero live Intuit calls.
 *
 * Intuit endpoints (public docs, discovery doc at
 * https://developer.api.intuit.com/.well-known/openid_configuration):
 *  - authorize: https://appcenter.intuit.com/connect/oauth2
 *  - token:     https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer
 *  - API:       https://quickbooks.api.intuit.com/v3/company/{realmId}/
 *  - sandbox:   https://sandbox-quickbooks.api.intuit.com
 */

export const QB_AUTHORIZE_URL = 'https://appcenter.intuit.com/connect/oauth2';
export const QB_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
export const QB_REVOKE_URL = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke';
export const QB_PROD_API_BASE = 'https://quickbooks.api.intuit.com';
export const QB_SANDBOX_API_BASE = 'https://sandbox-quickbooks.api.intuit.com';
/** Scopes for the accounting API plus basic profile. */
export const QB_SCOPES = 'com.intuit.quickbooks.accounting openid email profile';
const QB_MINOR_VERSION = '75';
/** Refresh the access token when fewer than this many ms remain. */
const REFRESH_BUFFER_MS = 120_000;

type FetchFn = typeof fetch;

export function qbApiBase(sandbox: boolean): string {
  return sandbox ? QB_SANDBOX_API_BASE : QB_PROD_API_BASE;
}

export function quickbooksSandbox(): boolean {
  return process.env.QUICKBOOKS_SANDBOX === 'true';
}

/* ------------------------------------------------------------------ */
/* OAuth2                                                               */
/* ------------------------------------------------------------------ */

export interface AuthorizeUrlOptions {
  clientId: string;
  redirectUri: string;
  /** Random CSRF state (generated per attempt, verified on callback). */
  state: string;
}

/** Authorization URL that starts the business's QuickBooks connection. */
export function buildAuthorizeUrl(opts: AuthorizeUrlOptions): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    scope: QB_SCOPES,
    state: opts.state,
  });
  return `${QB_AUTHORIZE_URL}?${params.toString()}`;
}

export interface QBTokenResult {
  ok: boolean;
  accessToken?: string;
  refreshToken?: string;
  /** Seconds until the access token expires (Intuit: 3600). */
  expiresIn?: number;
  error?: string;
}

function basicAuth(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64')}`;
}

async function postToken(
  body: URLSearchParams,
  clientId: string,
  clientSecret: string,
  fetchFn: FetchFn
): Promise<QBTokenResult> {
  let res: Response;
  try {
    res = await fetchFn(QB_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        Authorization: basicAuth(clientId, clientSecret),
      },
      body: body.toString(),
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error.' };
  }
  let payload: Record<string, unknown> = {};
  try {
    payload = (await res.json()) as Record<string, unknown>;
  } catch {
    return { ok: false, error: `QuickBooks token exchange failed (HTTP ${res.status}).` };
  }
  if (!res.ok || typeof payload.access_token !== 'string') {
    const desc =
      typeof payload.error_description === 'string'
        ? payload.error_description
        : typeof payload.error === 'string'
          ? payload.error
          : `QuickBooks token exchange failed (HTTP ${res.status}).`;
    return { ok: false, error: desc };
  }
  return {
    ok: true,
    accessToken: payload.access_token,
    refreshToken: typeof payload.refresh_token === 'string' ? payload.refresh_token : undefined,
    expiresIn: typeof payload.expires_in === 'number' ? payload.expires_in : 3600,
  };
}

/**
 * Exchange the OAuth `code` for tokens. The QuickBooks company id (realmId)
 * arrives as a separate query param on the callback — it is NOT in the
 * token response.
 */
export async function exchangeCode(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string,
  fetchFn: FetchFn = fetch
): Promise<QBTokenResult> {
  return postToken(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
    clientId,
    clientSecret,
    fetchFn
  );
}

/** Trade a refresh token for a fresh token pair (refresh tokens last 100 days). */
export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
  fetchFn: FetchFn = fetch
): Promise<QBTokenResult> {
  return postToken(
    new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    clientId,
    clientSecret,
    fetchFn
  );
}

/** Best-effort token revocation on disconnect. Never throws. */
export async function revokeTokens(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
  fetchFn: FetchFn = fetch
): Promise<void> {
  try {
    await fetchFn(QB_REVOKE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        Authorization: basicAuth(clientId, clientSecret),
      },
      body: new URLSearchParams({ token: refreshToken }).toString(),
    });
  } catch {
    // Revocation is best-effort; the local row is deleted regardless.
  }
}

/* ------------------------------------------------------------------ */
/* Authenticated API calls (with auto-refresh)                          */
/* ------------------------------------------------------------------ */

export interface QBConnectionLike {
  realmId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface QBCreds {
  clientId: string;
  clientSecret: string;
  sandbox: boolean;
}

/** Minimal DB surface the sync functions need (prisma satisfies this). */
export interface QBSyncDb {
  quickBooksSyncLog: {
    create(args: {
      data: {
        businessId: string;
        entityType: string;
        entityId: string;
        qbId?: string | null;
        status: string;
        detail?: string | null;
      };
    }): Promise<unknown>;
    findFirst(args: {
      where: { businessId: string; entityType: string; entityId: string; status: string };
      orderBy?: { createdAt: string };
      select?: { qbId: boolean };
    }): Promise<{ qbId: string | null } | null>;
  };
  quickBooksConnection: {
    update(args: {
      where: { businessId: string };
      data: { accessToken: string; refreshToken: string; expiresAt: Date };
    }): Promise<unknown>;
  };
}

export interface QBApiResult {
  ok: boolean;
  /** Parsed JSON body on success. */
  data?: Record<string, unknown>;
  error?: string;
  status?: number;
}

/** Extract a readable message from a QuickBooks Fault payload. */
export function qbErrorMessage(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const fault = (data as { Fault?: { Error?: Array<{ Message?: string; Detail?: string; code?: string }> } }).Fault;
  const errors = fault?.Error;
  if (Array.isArray(errors) && errors.length > 0) {
    const msgs = errors
      .map((e) => e.Detail || e.Message || (e.code ? `QuickBooks error ${e.code}` : ''))
      .filter(Boolean);
    if (msgs.length > 0) return msgs.join('; ');
  }
  return null;
}

/** QuickBooks error codes from a Fault payload (e.g. "6240" = duplicate name). */
export function qbErrorCodes(data: unknown): string[] {
  if (!data || typeof data !== 'object') return [];
  const fault = (data as { Fault?: { Error?: Array<{ code?: string }> } }).Fault;
  const errors = fault?.Error;
  if (!Array.isArray(errors)) return [];
  return errors.map((e) => e.code).filter((c): c is string => typeof c === 'string');
}

/**
 * Ensure a usable access token: refresh when expiring soon, persist the new
 * pair, and return the token to use. On refresh failure the caller should
 * surface "reconnect" to the user.
 */
export async function getValidAccessToken(
  conn: QBConnectionLike,
  businessId: string,
  creds: QBCreds,
  db: QBSyncDb,
  fetchFn: FetchFn = fetch
): Promise<{ ok: boolean; accessToken?: string; error?: string }> {
  const msLeft = conn.expiresAt.getTime() - Date.now();
  if (msLeft > REFRESH_BUFFER_MS) return { ok: true, accessToken: conn.accessToken };
  const refreshed = await refreshAccessToken(conn.refreshToken, creds.clientId, creds.clientSecret, fetchFn);
  if (!refreshed.ok || !refreshed.accessToken) {
    return { ok: false, error: 'QuickBooks authorization expired — please reconnect.' };
  }
  try {
    await db.quickBooksConnection.update({
      where: { businessId },
      data: {
        accessToken: refreshed.accessToken,
        // Intuit may rotate the refresh token; keep the old one when absent.
        refreshToken: refreshed.refreshToken ?? conn.refreshToken,
        expiresAt: new Date(Date.now() + (refreshed.expiresIn ?? 3600) * 1000),
      },
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not save refreshed tokens.' };
  }
  // Mutate the in-memory copy so the rest of this run uses the fresh token.
  conn.accessToken = refreshed.accessToken;
  if (refreshed.refreshToken) conn.refreshToken = refreshed.refreshToken;
  return { ok: true, accessToken: refreshed.accessToken };
}

interface QBCallArgs {
  conn: QBConnectionLike;
  businessId: string;
  creds: QBCreds;
  db: QBSyncDb;
  /** e.g. "customer", "invoice", "payment", "query" (no leading slash). */
  endpoint: string;
  method?: 'GET' | 'POST';
  body?: unknown;
}

/** Authenticated QuickBooks API call with transparent token refresh. */
export async function qbApiCall(args: QBCallArgs, fetchFn: FetchFn = fetch): Promise<QBApiResult> {
  const tok = await getValidAccessToken(args.conn, args.businessId, args.creds, args.db, fetchFn);
  if (!tok.ok || !tok.accessToken) return { ok: false, error: tok.error ?? 'Not authorized.' };
  const url = `${qbApiBase(args.creds.sandbox)}/v3/company/${encodeURIComponent(args.conn.realmId)}/${args.endpoint}?minorversion=${QB_MINOR_VERSION}`;
  let res: Response;
  try {
    res = await fetchFn(url, {
      method: args.method ?? 'POST',
      headers: {
        Authorization: `Bearer ${tok.accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: args.body === undefined ? undefined : JSON.stringify(args.body),
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error.' };
  }
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    return { ok: false, error: `QuickBooks request failed (HTTP ${res.status}).`, status: res.status };
  }
  if (!res.ok) {
    return {
      ok: false,
      data,
      error: qbErrorMessage(data) ?? `QuickBooks request failed (HTTP ${res.status}).`,
      status: res.status,
    };
  }
  return { ok: true, data };
}

/** Run a QuickBooks query (SQL-like: `select Id from Customer where ...`). */
export async function qbQuery(
  args: Omit<QBCallArgs, 'endpoint' | 'method' | 'body'>,
  sql: string,
  fetchFn: FetchFn = fetch
): Promise<QBApiResult> {
  return qbApiCall({ ...args, endpoint: 'query', method: 'POST', body: sql }, fetchFn);
}

export interface QBItemRef {
  value: string;
  name: string;
}

/**
 * Resolve the QuickBooks item to hang invoice lines on. Prefers an item
 * literally named "Services"; falls back to the conventional default id "1".
 */
export async function resolveServiceItem(
  args: Omit<QBCallArgs, 'endpoint' | 'method' | 'body'>,
  fetchFn: FetchFn = fetch
): Promise<QBItemRef> {
  const res = await qbQuery(args, "select Id, Name from Item where Name = 'Services' maxresults 1", fetchFn);
  if (res.ok) {
    const items = (
      (res.data?.QueryResponse as { Item?: Array<{ Id?: string; Name?: string }> } | undefined)?.Item ?? []
    ).filter((i) => i.Id);
    if (items[0]?.Id) return { value: items[0].Id, name: items[0].Name ?? 'Services' };
  }
  return { value: '1', name: 'Services' };
}

/* ------------------------------------------------------------------ */
/* EveryJob → QuickBooks mapping (pure functions, unit-tested)          */
/* ------------------------------------------------------------------ */

export interface EJCustomer {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  province?: string | null;
  postalCode?: string | null;
}

export interface EJInvoiceLine {
  description: string;
  qty: number;
  unitPrice: number;
}

export interface EJInvoice {
  id: string;
  number: string;
  date: Date;
  taxAmount: number;
  total: number;
  status: string;
  notes?: string | null;
  customerId: string;
}

export interface EJPayment {
  id: string;
  amount: number;
  provider: string;
  transactionId?: string | null;
  invoiceId: string;
  createdAt: Date;
}

/** Round to cents — QuickBooks rejects more than 2 decimals on amounts. */
function cents(n: number): number {
  return Math.round(n * 100) / 100;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** EveryJob customer → QuickBooks Customer create payload. */
export function mapCustomerToQB(c: EJCustomer): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    DisplayName: c.name.slice(0, 100) || 'Customer',
  };
  if (c.email) payload.PrimaryEmailAddr = { Address: c.email };
  if (c.phone) payload.PrimaryPhone = { FreeFormNumber: c.phone };
  if (c.address || c.province || c.postalCode) {
    payload.BillAddr = {
      Line1: c.address ?? undefined,
      CountrySubDivisionCode: c.province ?? undefined,
      PostalCode: c.postalCode ?? undefined,
      Country: 'CA',
    };
  }
  return payload;
}

/**
 * EveryJob invoice → QuickBooks Invoice create payload.
 * Line items map 1:1 (no collapsing) so nothing is ever silently merged —
 * the per-line audit trail survives the sync.
 */
export function mapInvoiceToQB(
  inv: EJInvoice,
  lines: EJInvoiceLine[],
  qbCustomerId: string,
  itemRef: QBItemRef
): Record<string, unknown> {
  const qbLines = lines.map((l) => ({
    DetailType: 'SalesItemLineDetail',
    Amount: cents(l.qty * l.unitPrice),
    Description: l.description.slice(0, 4000),
    SalesItemLineDetail: {
      Qty: l.qty,
      UnitPrice: cents(l.unitPrice),
      ItemRef: { value: itemRef.value, name: itemRef.name },
    },
  }));
  // An invoice with no lines is meaningless in QuickBooks; the caller skips it.
  const payload: Record<string, unknown> = {
    CustomerRef: { value: qbCustomerId },
    DocNumber: inv.number,
    TxnDate: isoDate(inv.date),
    Line: qbLines,
  };
  if (inv.notes) payload.PrivateNote = inv.notes.slice(0, 4000);
  if (inv.taxAmount > 0) {
    payload.TxnTaxDetail = { TotalTax: cents(inv.taxAmount) };
  }
  return payload;
}

/** EveryJob payment → QuickBooks Payment linked to the synced invoice. */
export function mapPaymentToQB(
  p: EJPayment,
  qbCustomerId: string,
  qbInvoiceId: string
): Record<string, unknown> {
  return {
    CustomerRef: { value: qbCustomerId },
    TotalAmt: cents(p.amount),
    TxnDate: isoDate(p.createdAt),
    PrivateNote: `EveryJob payment ${p.id} via ${p.provider}${p.transactionId ? ` (${p.transactionId})` : ''}`.slice(0, 4000),
    Line: [
      {
        Amount: cents(p.amount),
        LinkedTxn: [{ TxnId: qbInvoiceId, TxnType: 'Invoice' }],
      },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Sync — every call writes exactly one QuickBooksSyncLog row            */
/* ------------------------------------------------------------------ */

export type QBSyncStatus = 'synced' | 'failed' | 'skipped';

export interface SyncOutcome {
  entityType: 'customer' | 'invoice' | 'payment';
  entityId: string;
  status: QBSyncStatus;
  qbId?: string;
  detail?: string;
}

async function writeLog(
  db: QBSyncDb,
  businessId: string,
  outcome: SyncOutcome
): Promise<void> {
  try {
    await db.quickBooksSyncLog.create({
      data: {
        businessId,
        entityType: outcome.entityType,
        entityId: outcome.entityId,
        qbId: outcome.qbId ?? null,
        status: outcome.status,
        detail: outcome.detail ?? null,
      },
    });
  } catch {
    // Logging must never break the sync run itself.
  }
}

/** Id of an already-synced entity, or null. */
async function alreadySyncedQbId(
  db: QBSyncDb,
  businessId: string,
  entityType: string,
  entityId: string
): Promise<string | null> {
  try {
    const row = await db.quickBooksSyncLog.findFirst({
      where: { businessId, entityType, entityId, status: 'synced' },
      orderBy: { createdAt: 'desc' },
      select: { qbId: true },
    });
    return row?.qbId ?? null;
  } catch {
    return null;
  }
}

export interface SyncCallBase {
  conn: QBConnectionLike;
  businessId: string;
  creds: QBCreds;
  db: QBSyncDb;
}

function failed(
  entityType: SyncOutcome['entityType'],
  entityId: string,
  detail: string
): SyncOutcome {
  return { entityType, entityId, status: 'failed', detail };
}

/**
 * Sync one customer. On QuickBooks "Duplicate Name Exists" (6240) we link
 * to the existing record instead of failing — the log says what happened.
 */
export async function syncCustomer(
  base: SyncCallBase,
  customer: EJCustomer,
  fetchFn: FetchFn = fetch
): Promise<SyncOutcome> {
  const { businessId, db } = base;
  const existing = await alreadySyncedQbId(db, businessId, 'customer', customer.id);
  if (existing) {
    const outcome: SyncOutcome = {
      entityType: 'customer',
      entityId: customer.id,
      status: 'skipped',
      qbId: existing,
      detail: 'Already synced to QuickBooks.',
    };
    await writeLog(db, businessId, outcome);
    return outcome;
  }

  const res = await qbApiCall({ ...base, endpoint: 'customer', body: mapCustomerToQB(customer) }, fetchFn);
  let qbId: string | undefined;
  let linked = false;
  if (res.ok) {
    qbId = (res.data?.Customer as { Id?: string } | undefined)?.Id;
  } else if (qbErrorCodes(res.data).includes('6240')) {
    // Same DisplayName already exists in QuickBooks — link it, don't fail.
    const q = await qbQuery(base, `select Id from Customer where DisplayName = '${customer.name.replace(/'/g, "\\'")}' maxresults 1`, fetchFn);
    const found = (
      (q.data?.QueryResponse as { Customer?: Array<{ Id?: string }> } | undefined)?.Customer ?? []
    ).find((c) => c.Id);
    if (q.ok && found?.Id) {
      qbId = found.Id;
      linked = true;
    }
  }
  const outcome: SyncOutcome = res.ok || linked
    ? {
        entityType: 'customer',
        entityId: customer.id,
        status: 'synced',
        qbId,
        detail: linked ? 'Linked to the existing QuickBooks customer with the same name.' : undefined,
      }
    : failed('customer', customer.id, res.error ?? 'QuickBooks customer create failed.');
  await writeLog(db, businessId, outcome);
  return outcome;
}

/** Sync one invoice (with its line items, 1:1 — never merged). */
export async function syncInvoice(
  base: SyncCallBase,
  invoice: EJInvoice,
  lines: EJInvoiceLine[],
  qbCustomerId: string | null,
  itemRef: QBItemRef,
  fetchFn: FetchFn = fetch
): Promise<SyncOutcome> {
  const { businessId, db } = base;
  const existing = await alreadySyncedQbId(db, businessId, 'invoice', invoice.id);
  if (existing) {
    const outcome: SyncOutcome = {
      entityType: 'invoice',
      entityId: invoice.id,
      status: 'skipped',
      qbId: existing,
      detail: 'Already synced to QuickBooks.',
    };
    await writeLog(db, businessId, outcome);
    return outcome;
  }
  if (!qbCustomerId) {
    const outcome: SyncOutcome = {
      entityType: 'invoice',
      entityId: invoice.id,
      status: 'skipped',
      detail: 'Customer is not synced to QuickBooks yet — sync customers first.',
    };
    await writeLog(db, businessId, outcome);
    return outcome;
  }
  if (lines.length === 0) {
    const outcome: SyncOutcome = {
      entityType: 'invoice',
      entityId: invoice.id,
      status: 'skipped',
      detail: 'Invoice has no line items.',
    };
    await writeLog(db, businessId, outcome);
    return outcome;
  }
  const res = await qbApiCall(
    { ...base, endpoint: 'invoice', body: mapInvoiceToQB(invoice, lines, qbCustomerId, itemRef) },
    fetchFn
  );
  const outcome: SyncOutcome = res.ok
    ? {
        entityType: 'invoice',
        entityId: invoice.id,
        status: 'synced',
        qbId: (res.data?.Invoice as { Id?: string } | undefined)?.Id,
      }
    : failed('invoice', invoice.id, res.error ?? 'QuickBooks invoice create failed.');
  await writeLog(db, businessId, outcome);
  return outcome;
}

/** Sync one completed payment, linked to the synced QuickBooks invoice. */
export async function syncPayment(
  base: SyncCallBase,
  payment: EJPayment & { status: string },
  qbCustomerId: string | null,
  qbInvoiceId: string | null,
  fetchFn: FetchFn = fetch
): Promise<SyncOutcome> {
  const { businessId, db } = base;
  const existing = await alreadySyncedQbId(db, businessId, 'payment', payment.id);
  if (existing) {
    const outcome: SyncOutcome = {
      entityType: 'payment',
      entityId: payment.id,
      status: 'skipped',
      qbId: existing,
      detail: 'Already synced to QuickBooks.',
    };
    await writeLog(db, businessId, outcome);
    return outcome;
  }
  if (payment.status !== 'COMPLETED') {
    const outcome: SyncOutcome = {
      entityType: 'payment',
      entityId: payment.id,
      status: 'skipped',
      detail: `Only completed payments sync (status: ${payment.status}).`,
    };
    await writeLog(db, businessId, outcome);
    return outcome;
  }
  if (!qbCustomerId || !qbInvoiceId) {
    const outcome: SyncOutcome = {
      entityType: 'payment',
      entityId: payment.id,
      status: 'skipped',
      detail: 'Its customer or invoice is not synced to QuickBooks yet.',
    };
    await writeLog(db, businessId, outcome);
    return outcome;
  }
  const res = await qbApiCall(
    { ...base, endpoint: 'payment', body: mapPaymentToQB(payment, qbCustomerId, qbInvoiceId) },
    fetchFn
  );
  const outcome: SyncOutcome = res.ok
    ? {
        entityType: 'payment',
        entityId: payment.id,
        status: 'synced',
        qbId: (res.data?.Payment as { Id?: string } | undefined)?.Id,
      }
    : failed('payment', payment.id, res.error ?? 'QuickBooks payment create failed.');
  await writeLog(db, businessId, outcome);
  return outcome;
}
