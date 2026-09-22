// Client-safe marketing constants + template renderer.
// NOTE: this module must NOT contain 'use server' — the values here are
// imported by client components (CampaignForm, CampaignDetailClient).
// Server actions import them from here as well.

export type Audience = 'ALL_CUSTOMERS' | 'WITH_UNPAID' | 'RECENT_JOBS';

export const AUDIENCES: { value: Audience; label: string; hint: string }[] = [
  { value: 'ALL_CUSTOMERS', label: 'All customers', hint: 'Everyone in your customer list' },
  { value: 'WITH_UNPAID', label: 'Unpaid invoices', hint: 'Customers with an unpaid or partially paid invoice' },
  { value: 'RECENT_JOBS', label: 'Recent jobs', hint: 'Customers with a job in the last 30 days' },
];

export const AUDIENCE_LABELS: Record<Audience, string> = {
  ALL_CUSTOMERS: 'All customers',
  WITH_UNPAID: 'Unpaid invoices',
  RECENT_JOBS: 'Recent jobs',
};

/** Replace {{name}} and {{business}} template variables. Unknown tags are left as-is. */
export function renderTemplate(
  body: string,
  vars: { name: string; business: string }
): string {
  return body
    .replace(/\{\{\s*name\s*\}\}/gi, vars.name)
    .replace(/\{\{\s*business\s*\}\}/gi, vars.business);
}
