/**
 * In-memory stand-in for the modules the session-security tests touch.
 * The REAL @/lib/auth, @/lib/customer-auth, @/lib/session-cookie,
 * @/lib/stripe and @/lib/jsonld are under test; framework + data
 * modules are stubbed. Pure helper modules are not intercepted.
 */

const _cookieJar = new Map();
let _sessionCreateArgs = null;
let _customerSessionCreateArgs = null;
let _sessionRow = null;
let _customerSessionRow = null;
const _deletedSessionIds = [];
const _deletedCustomerSessionIds = [];

export function resetSessionStub() {
  _cookieJar.clear();
  _sessionCreateArgs = null;
  _customerSessionCreateArgs = null;
  _sessionRow = null;
  _customerSessionRow = null;
  _deletedSessionIds.length = 0;
  _deletedCustomerSessionIds.length = 0;
}

export function getCookieJar() {
  return _cookieJar;
}
export function getSessionCreateArgs() {
  return _sessionCreateArgs;
}
export function getCustomerSessionCreateArgs() {
  return _customerSessionCreateArgs;
}
export function setSessionRow(row) {
  _sessionRow = row;
}
export function setCustomerSessionRow(row) {
  _customerSessionRow = row;
}
export function getDeletedSessionIds() {
  return _deletedSessionIds;
}
export function getDeletedCustomerSessionIds() {
  return _deletedCustomerSessionIds;
}

// next/headers — cookie store used by src/lib/auth.ts and
// src/lib/customer-auth.ts. In-memory; only the shape matters here.
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

export async function headers() {
  return { get: () => null };
}

// next/navigation
export function redirect() {
  throw new Error('NEXT_REDIRECT');
}

// @/lib/prisma — session tables only; create captures its args so the
// test can assert the id the code generated.
export const prisma = {
  session: {
    create: async ({ data }) => {
      _sessionCreateArgs = data;
      return { ...data };
    },
    findUnique: async ({ where }) =>
      _sessionRow && where?.id === _sessionRow.id ? _sessionRow : null,
    delete: async ({ where }) => {
      _deletedSessionIds.push(where?.id);
      return {};
    },
    deleteMany: async () => ({ count: 0 }),
  },
  customerSession: {
    create: async ({ data }) => {
      _customerSessionCreateArgs = data;
      return { ...data };
    },
    findUnique: async ({ where }) =>
      _customerSessionRow && where?.id === _customerSessionRow.id
        ? _customerSessionRow
        : null,
    delete: async ({ where }) => {
      _deletedCustomerSessionIds.push(where?.id);
      return {};
    },
    deleteMany: async () => ({ count: 0 }),
  },
};

// @/lib/membership — only getActiveMembershipForUser is imported by
// src/lib/auth.ts (used by requireAuth, not by the session functions
// under test). Never called here.
export async function getActiveMembershipForUser() {
  return null;
}

// @/lib/db-errors
export class DatabaseUnavailableError extends Error {
  constructor() {
    super('Database unavailable (stub).');
    this.name = 'DatabaseUnavailableError';
  }
}
