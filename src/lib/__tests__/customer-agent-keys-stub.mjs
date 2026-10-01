/**
 * Test-only in-memory stand-in for the prisma bits
 * src/lib/customer-agent-keys.ts touches: the customerAgentKey model only.
 * Wired up by customer-agent-keys-stub-loader.mjs, which redirects
 * `@/lib/prisma` to THIS file for the customer-agent-keys test process only.
 */
export const db = {
  customers: new Map(), // id -> { id, name, phone, email, city }
  agentKeys: new Map(), // id -> row
  byHash: new Map(), // keyHash -> id
};

let seq = 0;

export function resetDb() {
  db.customers.clear();
  db.agentKeys.clear();
  db.byHash.clear();
  seq = 0;
}

export function seedCustomer(c) {
  db.customers.set(c.id, { name: null, phone: null, city: null, ...c });
}

function publicRow(row) {
  const { keyHash, ...rest } = row;
  return rest;
}

export const prisma = {
  customerAgentKey: {
    async findUnique({ where }) {
      const id = db.byHash.get(where.keyHash);
      if (!id) return null;
      const row = db.agentKeys.get(id);
      if (!row) return null;
      const customer = db.customers.get(row.customerId) || null;
      return {
        id: row.id,
        customerId: row.customerId,
        scopes: row.scopes,
        revokedAt: row.revokedAt,
        customer: customer
          ? {
              id: customer.id,
              name: customer.name,
              phone: customer.phone,
              email: customer.email,
              city: customer.city,
            }
          : null,
      };
    },
    async create({ data, select }) {
      const id = `key_${++seq}`;
      const row = {
        id,
        customerId: data.customerId,
        label: data.label,
        keyHash: data.keyHash,
        keyPrefix: data.keyPrefix,
        scopes: data.scopes,
        revokedAt: null,
        lastUsedAt: null,
        createdAt: new Date(),
      };
      db.agentKeys.set(id, row);
      db.byHash.set(data.keyHash, id);
      if (!select) return row;
      const out = {};
      for (const k of Object.keys(select)) if (select[k]) out[k] = row[k];
      return out;
    },
    async update({ where, data }) {
      const row = db.agentKeys.get(where.id);
      if (!row || row.customerId !== where.customerId) throw new Error('not found');
      Object.assign(row, data);
      return row;
    },
    async updateMany({ where, data }) {
      let count = 0;
      for (const row of db.agentKeys.values()) {
        if (where.id && row.id !== where.id) continue;
        if (where.customerId && row.customerId !== where.customerId) continue;
        if (where.revokedAt === null && row.revokedAt !== null) continue;
        Object.assign(row, data);
        count++;
      }
      return { count };
    },
    async findMany({ where, orderBy, select }) {
      let rows = [...db.agentKeys.values()];
      if (where?.customerId) rows = rows.filter((r) => r.customerId === where.customerId);
      rows.sort((a, b) => b.createdAt - a.createdAt);
      if (!select) return rows.map(publicRow);
      return rows.map((r) => {
        const out = {};
        for (const k of Object.keys(select)) if (select[k]) out[k] = r[k];
        return out;
      });
    },
  },
};
