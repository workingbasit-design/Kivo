/**
 * Stub for concierge action tests.
 *
 * In-memory prisma double with transaction snapshot/rollback, a stubbed
 * customer session, and unsafeUnscoped passthrough. Controlled via
 * `__resetConciergeStub`, `__seedConciergeStub`, and `__failNext`.
 */
const db = {
  businesses: new Map(),
  conciergeSends: new Map(), // by idempotencyKey
  quoteRequests: [],
  leads: [],
};

let failNext = null; // { on: 'lead.create' } etc.
let sessionCustomer = { id: 'cust-1', email: 'c@example.com', locale: 'en' };
let idSeq = 0;
const nid = (p) => `${p}-${++idSeq}`;

function matchesWhere(rec, where) {
  if (!where) return true;
  for (const [k, v] of Object.entries(where)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if ('in' in v) {
        if (!v.in.includes(rec[k])) return false;
        continue;
      }
      if ('not' in v) {
        if (v.not === null && rec[k] === null) return false;
        continue;
      }
    }
    if (rec[k] !== v) return false;
  }
  return true;
}

function maybeFail(op) {
  if (failNext && failNext.on === op) {
    const err = new Error(`injected failure at ${op}`);
    failNext = null;
    throw err;
  }
}

const business = {
  findMany: async ({ where } = {}) =>
    [...db.businesses.values()].filter((b) => matchesWhere(b, where)),
};

const conciergeSend = {
  findUnique: async ({ where }) => db.conciergeSends.get(where.idempotencyKey) ?? null,
  create: async ({ data }) => {
    maybeFail('conciergeSend.create');
    if (db.conciergeSends.has(data.idempotencyKey)) {
      const e = new Error('Unique constraint failed on the fields: (`idempotencyKey`)');
      e.code = 'P2002';
      throw e;
    }
    const rec = { id: nid('cs'), ...data };
    db.conciergeSends.set(data.idempotencyKey, rec);
    return rec;
  },
};

const quoteRequest = {
  create: async ({ data }) => {
    maybeFail('quoteRequest.create');
    const messages = data.messages?.create ? [{ id: nid('qm'), ...data.messages.create }] : [];
    const rec = { id: nid('qr'), ...data, messages };
    delete rec.messages;
    rec._messages = messages;
    db.quoteRequests.push(rec);
    return { id: rec.id };
  },
};

const lead = {
  create: async ({ data }) => {
    maybeFail('lead.create');
    const rec = { id: nid('lead'), ...data };
    db.leads.push(rec);
    return rec;
  },
};

const txApi = { business, conciergeSend, quoteRequest, lead };

export const prisma = {
  business,
  conciergeSend,
  quoteRequest,
  lead,
  $transaction: async (fn) => {
    // Snapshot for rollback.
    const snap = {
      sends: new Map(db.conciergeSends),
      qrs: [...db.quoteRequests],
      leads: [...db.leads],
    };
    try {
      return await fn(txApi);
    } catch (e) {
      db.conciergeSends = snap.sends;
      db.quoteRequests = snap.qrs;
      db.leads = snap.leads;
      throw e;
    }
  },
};

export async function getCustomerSession() {
  return sessionCustomer ? { customer: sessionCustomer } : null;
}

export function unsafeUnscoped(fn) {
  return fn(prisma);
}

export async function findDirectoryMatches() {
  return [];
}

export function __resetConciergeStub() {
  db.businesses.clear();
  db.conciergeSends.clear();
  db.quoteRequests.length = 0;
  db.leads.length = 0;
  failNext = null;
  sessionCustomer = { id: 'cust-1', email: 'c@example.com', locale: 'en' };
  idSeq = 0;
}

export function __seedConciergeStub(businesses) {
  for (const b of businesses) db.businesses.set(b.id, b);
}

export function __setConciergeSession(c) {
  sessionCustomer = c;
}

export function __failNext(op) {
  failNext = { on: op };
}

export function __conciergeDb() {
  return db;
}
