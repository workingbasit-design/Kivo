/**
 * Offline outbox — queue job creations while offline, auto-sync on reconnect.
 *
 * Field workers lose signal constantly. When a job creation fails because the
 * device is offline, the payload is stored in IndexedDB and retried
 * automatically on the `online` event (or on demand). UI subscribes to sync
 * status via `onOutboxStatus`.
 *
 * Usage:
 *   await enqueueOutboxJob(jobPayload);          // offline-safe save
 *   startOutboxSync(submitJob);                  // once, at app boot
 *   onOutboxStatus((s) => setBadge(s.pending));   // sync indicator
 */
'use client';

export type OutboxKind = 'job';

export interface OutboxItem {
  id?: number;
  kind: OutboxKind;
  payload: Record<string, unknown>;
  createdAt: number;
  attempts: number;
}

export interface OutboxStatus {
  pending: number;
  syncing: boolean;
  lastError: string | null;
}

const DB_NAME = 'kivo-outbox';
const STORE = 'queue';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => {
          resolve(req.result);
          db.close();
        };
        req.onerror = () => {
          reject(req.error);
          db.close();
        };
      })
  );
}

/* ------------------------------------------------------------------ */
/* Status bus                                                          */
/* ------------------------------------------------------------------ */

let status: OutboxStatus = { pending: 0, syncing: false, lastError: null };
const listeners = new Set<(s: OutboxStatus) => void>();

function emit(patch: Partial<OutboxStatus>) {
  status = { ...status, ...patch };
  for (const cb of listeners) {
    try {
      cb(status);
    } catch {
      /* listener errors must not break sync */
    }
  }
}

export function onOutboxStatus(cb: (s: OutboxStatus) => void): () => void {
  listeners.add(cb);
  cb(status);
  return () => {
    listeners.delete(cb);
  };
}

export function getOutboxStatus(): OutboxStatus {
  return status;
}

/* ------------------------------------------------------------------ */
/* Queue ops                                                           */
/* ------------------------------------------------------------------ */

/** Add a job payload to the outbox. Returns the queue id. */
export async function enqueueOutboxJob(payload: Record<string, unknown>): Promise<number> {
  const item: OutboxItem = {
    kind: 'job',
    payload,
    createdAt: Date.now(),
    attempts: 0,
  };
  const id = await tx('readwrite', (s) => s.add(item));
  const pending = await countPending();
  emit({ pending, lastError: null });
  return id as number;
}

export async function listOutbox(): Promise<OutboxItem[]> {
  return tx('readonly', (s) => s.getAll());
}

export async function countPending(): Promise<number> {
  const items = await listOutbox();
  return items.length;
}

export async function removeOutboxItem(id: number): Promise<void> {
  await tx('readwrite', (s) => s.delete(id));
  emit({ pending: await countPending() });
}

/**
 * Try to submit every queued item via `submit`. Successful items are removed;
 * failures stay queued with an incremented attempt counter. Returns the
 * number of items that synced.
 */
export async function drainOutbox(
  submit: (payload: Record<string, unknown>) => Promise<unknown>
): Promise<{ synced: number; failed: number }> {
  const items = await listOutbox();
  if (items.length === 0) return { synced: 0, failed: 0 };

  emit({ syncing: true, lastError: null });
  let synced = 0;
  let failed = 0;
  for (const item of items) {
    try {
      await submit(item.payload);
      if (item.id !== undefined) {
        await tx('readwrite', (s) => s.delete(item.id!));
      }
      synced++;
    } catch (e) {
      failed++;
      if (item.id !== undefined) {
        const next = { ...item, attempts: item.attempts + 1 };
        await tx('readwrite', (s) => s.put(next));
      }
      emit({ lastError: e instanceof Error ? e.message : 'Sync failed' });
    }
    emit({ pending: await countPending() });
  }
  emit({ syncing: false });
  return { synced, failed };
}

/**
 * Start automatic sync: drains on boot (if online) and on every `online`
 * event. Call once from a client component. Returns a cleanup function.
 */
export function startOutboxSync(
  submit: (payload: Record<string, unknown>) => Promise<unknown>
): () => void {
  let stopped = false;

  const tryDrain = () => {
    if (stopped || !navigator.onLine) return;
    void drainOutbox(submit).catch(() => undefined);
  };

  // Refresh the badge count on boot.
  void countPending()
    .then((pending) => emit({ pending }))
    .catch(() => undefined);

  window.addEventListener('online', tryDrain);
  // Small delay so the page can finish hydrating first.
  const timer = setTimeout(tryDrain, 1500);

  return () => {
    stopped = true;
    window.removeEventListener('online', tryDrain);
    clearTimeout(timer);
  };
}
