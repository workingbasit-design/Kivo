/**
 * In-memory stub for the B1.1 cross-tenant attachments route test.
 *
 * Simulates two businesses: biz-a owns attachment att-a; biz-b owns
 * nothing. The stub's findFirst enforces tenant scoping exactly like the
 * real query ({ id, businessId }) would - returning null for cross-tenant
 * lookups, which is what makes the route 404 instead of leaking.
 */
export const calls = { findFirst: [] };

let sessionBusinessId = 'biz-b'; // the caller is always Business B

export function setSessionBusinessId(id) {
  sessionBusinessId = id;
}

export function resetStub() {
  calls.findFirst.length = 0;
}

const ATTACHMENTS = [
  { id: 'att-a', businessId: 'biz-a', blobUrl: 'https://blob.test/att-a', mimeType: 'image/png', fileName: 'a.png' },
];

export const prisma = {
  attachment: {
    findFirst: async ({ where }) => {
      calls.findFirst.push(where);
      // Faithful simulation of { id, businessId } scoping:
      return ATTACHMENTS.find((a) => a.id === where.id && a.businessId === where.businessId) ?? null;
    },
  },
};

export async function getSession() {
  return { user: { id: 'user-b' } };
}

export async function getActiveMembershipForUser() {
  return { businessId: sessionBusinessId, role: 'OWNER' };
}

export class NextResponse {
  static json(data, init) {
    const body = JSON.stringify(data);
    const res = new Response(body, {
      status: init?.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
    res._json = data;
    return res;
  }
  constructor(body, init) {
    const res = new Response(body, init);
    return res;
  }
}
