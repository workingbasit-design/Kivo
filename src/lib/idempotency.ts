/**
 * Idempotency keys for payment + message-send endpoints (Prompt 3, M6).
 *
 * The client sends an `Idempotency-Key` header (UUID) with the request.
 * First call with a key executes the work and stores the response; a
 * replay with the same key returns the stored response WITHOUT
 * re-executing. Keys expire after 24h (an expired key is treated as new).
 *
 * Concurrency: the key row is read first, then claimed with an INSERT
 * inside an interactive transaction. A concurrent duplicate's INSERT
 * blocks on the uncommitted row until the winner commits, then raises a
 * unique violation — the loser's transaction aborts and the outer retry
 * re-reads the winner's stored response.
 */
import type { Prisma, PrismaClient } from '@prisma/client';
import { unsafeUnscoped } from './tenant-guard.ts';

export interface IdempotencyScope {
  /** Null for pre-auth endpoints (key scoped by endpoint + caller). */
  businessId: string | null;
  /** e.g. "POST /api/v1/payments" */
  endpoint: string;
  /** Client-supplied UUID from the Idempotency-Key header. */
  key: string;
}

export interface IdempotentOutcome<T> {
  response: T;
  statusCode: number;
  /** True when the stored response was replayed and `fn` did NOT run. */
  replayed: boolean;
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'P2002'
  );
}

async function findKeyRow(
  db: PrismaClient | Prisma.TransactionClient,
  scope: IdempotencyScope
) {
  if (scope.businessId) {
    return db.idempotencyKey.findUnique({
      where: {
        businessId_endpoint_key: {
          businessId: scope.businessId,
          endpoint: scope.endpoint,
          key: scope.key,
        },
      },
    });
  }
  // Null-business rows: the tenant guard requires a non-empty businessId,
  // so these go through the explicit escape hatch (scoped by endpoint+key,
  // exactly what the partial unique index enforces).
  return unsafeUnscoped('idempotency:null-business-replay', () =>
    (db as PrismaClient).idempotencyKey.findFirst({
      where: { businessId: null, endpoint: scope.endpoint, key: scope.key },
    })
  );
}

async function deleteKeyRow(
  db: PrismaClient | Prisma.TransactionClient,
  rowId: string,
  scope: IdempotencyScope
) {
  // deleteMany (not delete) so businessId can ride in the where clause
  // for the tenant guard.
  if (scope.businessId) {
    await db.idempotencyKey.deleteMany({
      where: { id: rowId, businessId: scope.businessId },
    });
    return;
  }
  await unsafeUnscoped('idempotency:null-business-delete', () =>
    (db as PrismaClient).idempotencyKey.deleteMany({ where: { id: rowId } })
  );
}

/**
 * Run `fn` idempotently under `scope`. `fn` receives the transaction the
 * key claim lives in, so the work and the stored response commit together.
 *
 * Flow: read the key row first; replay it when it holds a fresh response.
 * Otherwise INSERT the claim — a concurrent duplicate's INSERT blocks on
 * the uncommitted row until this transaction commits, then raises a
 * unique violation, which aborts that transaction; the outer retry loop
 * re-reads and replays the winner's stored response. (Postgres aborts a
 * transaction on any error, so the violation cannot be caught inside the
 * transaction — hence the retry.)
 */
export async function withIdempotency<T>(
  db: PrismaClient,
  scope: IdempotencyScope,
  fn: (tx: Prisma.TransactionClient) => Promise<{ response: T; statusCode: number }>
): Promise<IdempotentOutcome<T>> {
  if (!scope.key || !scope.endpoint) {
    throw new Error('Idempotency-Key header and endpoint are required.');
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        const now = new Date();
        const existing = await findKeyRow(tx, scope);
        if (existing && existing.expiresAt > now && existing.responseJson != null) {
          return {
            response: JSON.parse(existing.responseJson) as T,
            statusCode: existing.statusCode ?? 200,
            replayed: true,
          };
        }

        const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        if (existing) {
          // Expired (or response-less) key: drop it so the fresh claim
          // can't hit a unique violation.
          await deleteKeyRow(tx, existing.id, scope);
        }
        const claimed = await tx.idempotencyKey.create({
          data: {
            businessId: scope.businessId,
            key: scope.key,
            endpoint: scope.endpoint,
            expiresAt,
          },
        });

        const { response, statusCode } = await fn(tx);
        await tx.idempotencyKey.update({
          where: { id: claimed.id },
          data: { responseJson: JSON.stringify(response), statusCode },
        });
        return { response, statusCode, replayed: false };
      });
    } catch (err) {
      // Lost the claim race: the winner has committed by now, so the next
      // attempt's initial read replays its stored response.
      if (isUniqueViolation(err) && attempt < 2) continue;
      throw err;
    }
  }
  throw new Error('Idempotency claim failed after retries.');
}
