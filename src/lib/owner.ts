/**
 * Product-owner gate for EveryJob's own support inbox.
 *
 * Support tickets are about the EveryJob product itself (not tenant data),
 * so every signed-in business owner could otherwise read and close anyone's
 * tickets. The inbox and the PATCH status endpoint are restricted to the
 * product owner, identified by email via the OWNER_EMAILS env var
 * (comma-separated, e.g. OWNER_EMAILS="you@example.com").
 *
 * Until the owner sets OWNER_EMAILS, the inbox is closed to everyone —
 * fail-closed is the safe default.
 */
export function ownerEmails(): string[] {
  return (process.env.OWNER_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isProductOwner(email: string | null | undefined): boolean {
  if (!email) return false;
  return ownerEmails().includes(email.trim().toLowerCase());
}
