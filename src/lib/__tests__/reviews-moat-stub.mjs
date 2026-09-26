/**
 * Test-only in-memory stand-in for the modules the review-moat server
 * actions touch: @/lib/prisma, @/lib/auth, @/lib/rate-limit,
 * @/lib/directory (publicClientIp), next/cache.
 *
 * Wired up by reviews-moat-stub-loader.mjs, which redirects all of those
 * specifiers to THIS file. Only the review-moat test registers that
 * loader, so no other test (and never production) is affected.
 *
 * `db` is mutable and exported so tests can seed rows per case; call
 * `resetDb()` between tests.
 */
export const db = {
  businesses: new Map(),
  customers: new Map(),
  jobs: new Map(),
  invoices: [],
  reviewRequests: new Map(),
  reviews: [],
};

export function resetDb() {
  db.businesses.clear();
  db.customers.clear();
  db.jobs.clear();
  db.invoices.length = 0;
  db.reviewRequests.clear();
  db.reviews.length = 0;
}

function whereMatches(row, where) {
  if (!where) return true;
  for (const [key, cond] of Object.entries(where)) {
    if (cond !== null && typeof cond === 'object' && !Array.isArray(cond)) {
      if ('not' in cond && row[key] === cond.not) return false;
      if ('gt' in cond && !(row[key] > cond.gt)) return false;
      if ('gte' in cond && !(row[key] >= cond.gte)) return false;
      if ('lt' in cond && !(row[key] < cond.lt)) return false;
      if ('lte' in cond && !(row[key] <= cond.lte)) return false;
      if ('in' in cond && !cond.in.includes(row[key])) return false;
      continue;
    }
    if (row[key] !== cond) return false;
  }
  return true;
}

/** Resolve relation selects used by getTokenReviewContext. */
function withRelations(row, select) {
  if (!select || typeof select !== 'object') return { ...row };
  const out = { ...row };
  if (select.job) {
    const j = db.jobs.get(row.jobId);
    out.job = j ? { title: j.title, date: j.date } : null;
  }
  if (select.customer) {
    const c = db.customers.get(row.customerId);
    out.customer = c ? { name: c.name } : null;
  }
  if (select.business) {
    const b = db.businesses.get(row.businessId);
    out.business = b ? { name: b.name } : null;
  }
  return out;
}

export const prisma = {
  business: {
    findUnique: async ({ where }) => {
      const b = db.businesses.get(where.id);
      return b ? { ...b } : null;
    },
  },
  job: {
    findFirst: async ({ where }) => {
      for (const j of db.jobs.values()) {
        if (whereMatches(j, where)) return { ...j };
      }
      return null;
    },
    findMany: async ({ where }) => {
      return [...db.jobs.values()]
        .filter((j) => whereMatches(j, where))
        .map((j) => ({ ...j }));
    },
  },
  invoice: {
    findFirst: async ({ where }) => {
      const inv = db.invoices.find((i) => whereMatches(i, where));
      return inv ? { ...inv } : null;
    },
    findMany: async ({ where, distinct }) => {
      const rows = db.invoices
        .filter((i) => whereMatches(i, where))
        .map((i) => ({ ...i }));
      if (distinct && distinct.length > 0) {
        const seen = new Set();
        return rows.filter((r) => {
          const k = distinct.map((d) => r[d]).join('|');
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
      }
      return rows;
    },
  },
  reviewRequest: {
    findUnique: async ({ where, select }) => {
      let row = null;
      if (where.tokenHash !== undefined) {
        for (const r of db.reviewRequests.values()) {
          if (r.tokenHash === where.tokenHash) {
            row = r;
            break;
          }
        }
      } else if (where.id !== undefined) {
        row = db.reviewRequests.get(where.id) ?? null;
      }
      if (!row) return null;
      return withRelations(row, select);
    },
    findFirst: async ({ where }) => {
      for (const r of db.reviewRequests.values()) {
        if (whereMatches(r, where)) return { ...r };
      }
      return null;
    },
    create: async ({ data }) => {
      const id = data.id ?? `rr_${db.reviewRequests.size + 1}`;
      // Mirror the Prisma schema default: status defaults to PENDING.
      const row = { id, status: 'PENDING', ...data };
      db.reviewRequests.set(id, row);
      return { ...row };
    },
    updateMany: async ({ where, data }) => {
      let count = 0;
      for (const [id, r] of db.reviewRequests) {
        if (!whereMatches(r, where)) continue;
        db.reviewRequests.set(id, { ...r, ...data });
        count++;
      }
      return { count };
    },
    update: async ({ where, data }) => {
      const key = where.id ?? [...db.reviewRequests.values()].find((r) => whereMatches(r, where))?.id;
      const r = db.reviewRequests.get(key);
      if (!r) throw new Error('ReviewRequest not found');
      const next = { ...r, ...data };
      db.reviewRequests.set(key, next);
      return { ...next };
    },
  },
  review: {
    create: async ({ data }) => {
      const row = { id: `rev_${db.reviews.length + 1}`, ...data };
      db.reviews.push(row);
      return { ...row };
    },
    findMany: async ({ where }) => {
      return db.reviews
        .filter((r) => whereMatches(r, where))
        .map((r) => ({ ...r }));
    },
  },
  $transaction: async (arg) => {
    // Supports both the array form (sequential ops) and the callback form.
    if (Array.isArray(arg)) {
      const results = [];
      for (const op of arg) results.push(await op);
      return results;
    }
    return arg(prisma);
  },
};

// --- @/lib/auth ------------------------------------------------------------
export async function requireAuth() {
  return {
    user: { id: 'user_1', businessId: 'biz_1' },
    businessId: 'biz_1',
  };
}

// --- @/lib/rate-limit -------------------------------------------------------
export const ACTION_LIMIT = { limit: 30, windowMs: 60_000 };
export function rateLimit() {
  return { ok: true, remaining: 30, retryAfterMs: 0 };
}

// --- @/lib/directory (publicClientIp) ---------------------------------------
export async function publicClientIp() {
  return '127.0.0.1';
}

// --- next/cache -------------------------------------------------------------
export function revalidatePath() {}
