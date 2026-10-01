'use server';

import { redirect } from 'next/navigation';
import { getCustomerSession } from '@/lib/customer-auth';
import {
  createCustomerAgentKey,
  listCustomerAgentKeys,
  revokeCustomerAgentKey,
} from '@/lib/customer-agent-keys';

/** List the signed-in customer's agent keys (for the profile section). */
export async function getAgentKeys() {
  const session = await getCustomerSession();
  if (!session) redirect('/customer/login');
  return listCustomerAgentKeys(session.customer.id);
}

/**
 * Generate a key. Returns the plaintext key ONCE — the client must show
 * it immediately because it is never retrievable again.
 */
export async function generateAgentKeyAction(
  _prev: unknown,
  formData: FormData
): Promise<{ key?: string; label?: string; error?: string } | undefined> {
  const session = await getCustomerSession();
  if (!session) redirect('/customer/login');
  const label = String(formData.get('label') || '').trim().slice(0, 60) || 'AI assistant';
  // Keep the list tidy: max 5 active keys per customer.
  const keys = await listCustomerAgentKeys(session.customer.id);
  if (keys.filter((k) => !k.revokedAt).length >= 5) {
    return { error: 'key-limit' };
  }
  const created = await createCustomerAgentKey(session.customer.id, label);
  return { key: created.key, label: created.label };
}

/** Revoke one of the customer's keys. */
export async function revokeAgentKeyAction(_prev: unknown, formData: FormData) {
  const session = await getCustomerSession();
  if (!session) redirect('/customer/login');
  const keyId = String(formData.get('keyId') || '');
  if (keyId) await revokeCustomerAgentKey(session.customer.id, keyId);
  redirect('/customer/profile');
}
