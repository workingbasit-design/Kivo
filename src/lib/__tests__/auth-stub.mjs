/**
 * In-memory stand-in for the modules the auth rate-limit tests touch.
 * The REAL @/lib/rate-limit-durable is used (that's what's under test);
 * everything else is stubbed. Pure helper modules (validations,
 * password-policy, password-reset, client-ip, zod) are not intercepted.
 */

let testIp = '9.9.9.9';
export function setTestIp(ip) {
  testIp = ip;
}

let businessUser = null;
let customerUserRow = null;
export function setBusinessUser(u) {
  businessUser = u;
}
export function setCustomerUser(u) {
  customerUserRow = u;
}

export function resetAuthStub() {
  businessUser = null;
  customerUserRow = null;
  testIp = '9.9.9.9';
  rateLimitRows.clear();
  customerResetTokens.clear();
  customerSessions.clear();
}

// next/headers
export async function headers() {
  return {
    get: (name) =>
      String(name).toLowerCase() === 'x-forwarded-for' ? testIp : null,
  };
}

// next/headers — cookie store used by src/lib/auth.ts (createSession /
// destroySession / getSession). In-memory; only the shape matters here.
const _cookieJar = new Map();
export async function cookies() {
  return {
    get: (name) => {
      const value = _cookieJar.get(String(name));
      return value === undefined ? undefined : { name: String(name), value };
    },
    set: (name, value) => {
      _cookieJar.set(String(name), String(value));
    },
    delete: (name) => {
      _cookieJar.delete(String(name));
    },
  };
}

// next/navigation
export function redirect() {
  throw new Error('NEXT_REDIRECT');
}

// next/cache
export function revalidatePath() {}

// bcryptjs (default import)
const bcryptStub = {
  hash: async () => 'hashed',
  compare: async () => false,
};
export default bcryptStub;

// @/lib/prisma
// In-memory RateLimit table for the durable limiter (P1.0 S4): the
// limiter's state lives here, not in module state — that is what makes
// the limit hold across serverless instances. updateMany only touches
// unexpired rows, matching the real implementation's semantics.
const rateLimitRows = new Map();
// In-memory CustomerPasswordResetToken table + customer sessions (P1.0 B-6).
const customerResetTokens = new Map(); // tokenHash -> row
export const __customerResetTokens = customerResetTokens;
const customerSessions = new Map(); // session id -> { customerId }
export function __seedCustomerSession(id, customerId) {
  customerSessions.set(id, { customerId });
}
export function __customerSessionCount(customerId) {
  let n = 0;
  for (const s of customerSessions.values()) if (s.customerId === customerId) n++;
  return n;
}
export const prisma = {
  // $transaction: array form awaits the (already-created) operation promises
  // in order; callback form runs against this stub client.
  $transaction: async (ops) => {
    if (typeof ops === 'function') return ops(prisma);
    const out = [];
    for (const op of ops) out.push(await op);
    return out;
  },
  user: {
    findUnique: async ({ where }) =>
      businessUser && where?.email === businessUser.email ? businessUser : null,
  },
  customerUser: {
    findUnique: async ({ where }) =>
      customerUserRow && where?.email === customerUserRow.email
        ? customerUserRow
        : null,
    update: async ({ where, data }) => {
      if (!customerUserRow || customerUserRow.id !== where?.id) {
        throw new Error('stub: customer row not found');
      }
      Object.assign(customerUserRow, data);
      return customerUserRow;
    },
  },
  customerPasswordResetToken: {
    deleteMany: async ({ where }) => {
      let count = 0;
      for (const [hash, row] of customerResetTokens) {
        const unusedOnly = where?.usedAt === null;
        if (
          row.customerId === where?.customerId &&
          (!unusedOnly || row.usedAt === null)
        ) {
          customerResetTokens.delete(hash);
          count++;
        }
      }
      return { count };
    },
    create: async ({ data }) => {
      const row = {
        id: `crt-${customerResetTokens.size + 1}`,
        ...data,
        usedAt: null,
        createdAt: new Date(),
      };
      customerResetTokens.set(data.tokenHash, row);
      return row;
    },
    findUnique: async ({ where }) => customerResetTokens.get(where?.tokenHash) ?? null,
    update: async ({ where, data }) => {
      for (const row of customerResetTokens.values()) {
        if (row.id === where?.id) {
          Object.assign(row, data);
          return row;
        }
      }
      throw new Error('stub: token row not found');
    },
  },
  customerSession: {
    deleteMany: async ({ where }) => {
      let count = 0;
      for (const [id, s] of customerSessions) {
        if (s.customerId === where?.customerId) {
          customerSessions.delete(id);
          count++;
        }
      }
      return { count };
    },
  },
  rateLimit: {
    updateMany: async ({ where, data }) => {
      const row = rateLimitRows.get(where?.key);
      if (row && row.resetAt > where?.resetAt?.gt) {
        row.count += data?.count?.increment ?? 1;
        return { count: 1 };
      }
      return { count: 0 };
    },
    upsert: async ({ where, create, update }) => {
      const row = { key: where.key, count: 1, resetAt: (create ?? update).resetAt };
      rateLimitRows.set(where.key, row);
      return row;
    },
    findUnique: async ({ where }) => {
      const row = rateLimitRows.get(where?.key);
      return row ? { count: row.count, resetAt: row.resetAt } : null;
    },
  },
};

// @/lib/auth
export async function createSession() {
  return { id: 'sess_1' };
}
export async function destroySession() {}
export async function getSession() {
  return null;
}
export async function requireAuth() {
  throw new Error('not authenticated in tests');
}

// @/lib/customer-auth
export async function createCustomerSession() {
  return { id: 'csess_1' };
}
export async function destroyCustomerSession() {}
export async function hashCustomerPassword() {
  return 'hashed';
}
export async function verifyCustomerPassword() {
  return false;
}
// Same well-formed dummy hash as the real module (hash of 'dummy'); the
// stub verifier always returns false, so this value is never used to
// authenticate — it only satisfies the import in customer-auth actions.
export const DUMMY_CUSTOMER_HASH =
  '1b7441f57320ecf6efd7d34a903babf1:871266671f210956dd05248f527858dbd621f96fecced87f844d2dfa43b9d3481dac5f8d0bfac98f1860622d22d9f2c316b005797b293059837d6515c037ad69';

// @/lib/i18n/server
export async function getLocale() {
  return 'en';
}

// @/lib/i18n
export function t() {
  return '';
}

// @/lib/messaging/platform-email
export async function sendPlatformEmail() {}

// @/lib/messaging/email-templates
export function welcomeEmail() {
  return { subject: '', text: '', html: '' };
}
export function passwordResetEmail() {
  return { subject: '', text: '', html: '' };
}

// @/lib/google-auth
export function validateCanadianPhone() {
  return { ok: true, digits: '5550000000' };
}

// @/lib/app-url
export async function appBaseUrl() {
  return null;
}
