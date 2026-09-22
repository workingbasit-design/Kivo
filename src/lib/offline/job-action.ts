'use client';

/**
 * Offline-aware wrapper for the job server action. Drop it in wherever
 * `createJob` is used as a form action:
 *
 *   import { createJobWithOfflineFallback } from '@/lib/offline/job-action';
 *   <JobForm action={createJobWithOfflineFallback} ... />
 *
 * When the device is offline (or the network drops mid-flight), the job
 * payload is queued in IndexedDB and the form reports `queued: true` instead
 * of failing. The outbox auto-syncs on the next `online` event.
 */
import { createJob, type JobActionResult } from '@/app/actions/jobs';
import { enqueueOutboxJob } from './outbox';

function serialize(formData: FormData): Record<string, unknown> {
  const data: Record<string, unknown> = { clientKey: crypto.randomUUID() };
  for (const [k, v] of formData.entries()) {
    data[k] = typeof v === 'string' ? v : '';
  }
  return data;
}

export async function createJobWithOfflineFallback(
  prev: JobActionResult,
  formData: FormData
): Promise<JobActionResult> {
  const queueOffline = async (): Promise<JobActionResult> => {
    await enqueueOutboxJob(serialize(formData));
    return { ok: true, queued: true };
  };

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return queueOffline();
  }

  try {
    return await createJob(prev, formData);
  } catch (e) {
    // Server-action invocation failed at the network layer (device went
    // offline mid-flight). Queue it instead of showing a cryptic error.
    // NEXT_REDIRECT and validation errors are NOT TypeErrors — they pass through.
    if (e instanceof TypeError) return queueOffline();
    throw e;
  }
}
