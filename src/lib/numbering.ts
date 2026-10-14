/**
 * Document numbering via the DocumentCounter table (Prompt 3, M4).
 *
 * Generation MUST happen inside the same transaction as the document
 * insert: SELECT ... FOR UPDATE on the counter row -> format the number ->
 * insert the document -> nextNumber + 1. The row lock serializes
 * concurrent creators per (business, docType): no duplicates, sequential
 * numbers. Gaps happen only when the surrounding transaction rolls back,
 * which is acceptable and documented (invoice numbers must never repeat;
 * they are not required to be gapless).
 *
 * `db` accepts either the PrismaClient or a transaction client - both
 * expose $queryRaw/$executeRaw. Callers MUST pass the transaction the
 * document is created in, never the bare client.
 */
import { Prisma } from '@prisma/client';

export const DOC_TYPES = ['QUOTE', 'INVOICE', 'CREDIT_NOTE'] as const;
export type DocType = (typeof DOC_TYPES)[number];

const PREFIX: Record<DocType, string> = {
  QUOTE: 'Q-',
  INVOICE: 'INV-',
  CREDIT_NOTE: 'CN-',
};

type RawCapable = {
  $queryRaw: <T>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
  $executeRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<number>;
};

export function formatDocumentNumber(prefix: string, n: number, padding: number): string {
  return `${prefix}${String(n).padStart(padding, '0')}`;
}

export async function nextDocumentNumber(
  db: RawCapable,
  businessId: string,
  docType: DocType
): Promise<string> {
  if (!DOC_TYPES.includes(docType)) throw new Error(`Unknown docType: ${docType}`);
  // Lazily create the counter row (covers businesses created before M4 or
  // raced creators - ON CONFLICT makes it safe).
  await db.$executeRaw`
    INSERT INTO "DocumentCounter" ("id", "businessId", "docType", "nextNumber", "prefix", "padding", "updatedAt")
    VALUES (gen_random_uuid()::text, ${businessId}, ${docType}, 1, ${PREFIX[docType]}, 4, CURRENT_TIMESTAMP)
    ON CONFLICT ("businessId", "docType") DO NOTHING`;
  // Row lock: concurrent transactions for the same (business, type) wait
  // here, so each sees the incremented value in turn.
  const rows = await db.$queryRaw<
    Array<{ nextNumber: number; prefix: string; padding: number }>
  >`
    SELECT "nextNumber", "prefix", "padding" FROM "DocumentCounter"
    WHERE "businessId" = ${businessId} AND "docType" = ${docType}
    FOR UPDATE`;
  const counter = rows[0];
  if (!counter) throw new Error(`DocumentCounter row missing for ${businessId}/${docType}`);
  const number = formatDocumentNumber(counter.prefix, counter.nextNumber, counter.padding);
  await db.$executeRaw`
    UPDATE "DocumentCounter"
    SET "nextNumber" = "nextNumber" + 1, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "businessId" = ${businessId} AND "docType" = ${docType}`;
  return number;
}

// Re-exported for call sites that type their tx parameter explicitly.
export type { Prisma };
