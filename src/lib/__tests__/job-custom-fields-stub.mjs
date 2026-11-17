/**
 * In-memory stub for the job-custom-fields-save test: a fake prisma client,
 * auth, rate limit, logger, and Next.js cache/navigation/headers helpers,
 * plus a capture of every custom-field write so the test can assert on it.
 *
 * The fixture job is mutable via `db.fixture`; `db.fieldValues` is the
 * jobFieldValue table; `db.upserts` / `db.deletes` record each
 * jobFieldValue write in call order.
 */

export const db = {
  fixture: {
    id: 'job-1',
    businessId: 'biz-1',
    status: 'NEW',
    title: 'QATEST Job',
    customerId: 'cust-1',
    startAt: null,
    endAt: null,
  },
  customer: { id: 'cust-1', businessId: 'biz-1' },
  defs: [{ id: 'field-1', name: 'code', businessId: 'biz-1', target: 'JOB' }],
  fieldValues: [],
  jobUpdates: [],
  upserts: [],
  deletes: [],
  reset() {
    this.fixture = {
      id: 'job-1',
      businessId: 'biz-1',
      status: 'NEW',
      title: 'QATEST Job',
      customerId: 'cust-1',
      startAt: null,
      endAt: null,
    };
    this.fieldValues = [];
    this.jobUpdates = [];
    this.upserts = [];
    this.deletes = [];
  },
};

const jobModel = {
  async findFirst({ where }) {
    if (where && where.id === db.fixture.id && where.businessId === db.fixture.businessId) {
      return { ...db.fixture };
    }
    return null;
  },
  async update({ where, data }) {
    db.jobUpdates.push({ where: { ...where }, data: { ...data } });
    Object.assign(db.fixture, data);
    return { ...db.fixture };
  },
};

const customerModel = {
  async findFirst({ where }) {
    if (where && where.id === db.customer.id && where.businessId === db.customer.businessId) {
      return { ...db.customer };
    }
    return null;
  },
};

const businessModel = {
  async findUnique() {
    return { timezone: 'America/Toronto' };
  },
};

const customFieldDefModel = {
  async findFirst({ where }) {
    const def = db.defs.find(
      (d) =>
        d.id === where.id && d.businessId === where.businessId && d.target === where.target
    );
    return def ? { id: def.id } : null;
  },
  async findMany({ where }) {
    return db.defs
      .filter((d) => d.businessId === where.businessId && d.target === where.target)
      .map((d) => ({ id: d.id, name: d.name }));
  },
};

const jobFieldValueModel = {
  async upsert({ where, create, update }) {
    const { fieldId, jobId } = where.fieldId_jobId;
    db.upserts.push({ fieldId, jobId, value: create.value });
    const existing = db.fieldValues.find(
      (v) => v.fieldId === fieldId && v.jobId === jobId
    );
    if (existing) existing.value = update.value;
    else db.fieldValues.push({ fieldId, jobId, value: create.value });
    return { fieldId, jobId, value: create.value };
  },
  async deleteMany({ where }) {
    const before = db.fieldValues.length;
    db.fieldValues = db.fieldValues.filter(
      (v) => !(v.fieldId === where.fieldId && v.jobId === where.jobId)
    );
    db.deletes.push({ fieldId: where.fieldId, jobId: where.jobId });
    return { count: before - db.fieldValues.length };
  },
  async findMany({ where }) {
    return db.fieldValues
      .filter((v) => v.jobId === where.jobId)
      .map((v) => ({ fieldId: v.fieldId, value: v.value }));
  },
};

export const prisma = {
  job: jobModel,
  customer: customerModel,
  business: businessModel,
  customFieldDef: customFieldDefModel,
  jobFieldValue: jobFieldValueModel,
  $transaction: async (fn) => fn(prisma),
};

export async function requireAuth() {
  return { businessId: 'biz-1', user: { id: 'user-1' } };
}

// B-8: jobs.ts imports requireMembership (deleteJob gate). The stub
// persona is the business owner, so the check always passes.
export async function requireMembership(businessId, ...allowedRoles) {
  return { userId: 'user-1', businessId, role: 'OWNER', membershipId: 'mem-1' };
}

export function rateLimit() {
  return { ok: true, remaining: 120, retryAfterMs: 0 };
}

export const ACTION_LIMIT = { limit: 120, windowMs: 60 * 1000 };

export const logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

export function revalidatePath() {}

export function redirect() {
  throw new Error('redirect() called in test');
}

export async function headers() {
  return new Headers();
}

export async function generatePerVisitInvoice() {}

export async function emitWebhookEvent() {}
