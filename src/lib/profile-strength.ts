/**
 * Profile strength score — computed ONLY from the business's own data.
 *
 * No peer data, no invented benchmarks, no fake numbers. Each check is a
 * factual statement about what this business has or hasn't filled in, with a
 * weight. The UI renders the unfinished checks as concrete next actions.
 */

export interface StrengthInput {
  name: string;
  phone?: string | null;
  address?: string | null;
  workingHours?: string | null;
  logoUrl?: string | null;
  trade?: string | null;
  /** Canadian province code, e.g. "ON" */
  province?: string | null;
  yearsInBusiness?: number | null;
  specialties: string[];
  interacEmail?: string | null;
  taxId?: string | null;
  directoryOptIn?: boolean;
  bookingPageActive?: boolean;
  serviceCount: number;
  designationCount: number;
  teamMemberCount: number; // users on the business, owner included
}

export interface StrengthCheck {
  key: string;
  weight: number;
  done: boolean;
}

/**
 * Returns { score (0–100), checks }. Pure and deterministic.
 */
export function computeProfileStrength(input: StrengthInput): {
  score: number;
  checks: StrengthCheck[];
} {
  const has = (v: string | null | undefined) => !!v && v.trim().length > 0;

  const checks: StrengthCheck[] = [
    { key: 'businessName', weight: 5, done: has(input.name) },
    { key: 'phone', weight: 5, done: has(input.phone) },
    { key: 'address', weight: 5, done: has(input.address) },
    { key: 'workingHours', weight: 10, done: has(input.workingHours) },
    { key: 'logo', weight: 5, done: has(input.logoUrl) },
    { key: 'trade', weight: 5, done: has(input.trade) },
    { key: 'province', weight: 5, done: has(input.province) },
    { key: 'yearsInBusiness', weight: 5, done: (input.yearsInBusiness ?? 0) > 0 },
    { key: 'specialties', weight: 5, done: input.specialties.length > 0 },
    { key: 'paymentContact', weight: 5, done: has(input.interacEmail) || has(input.taxId) },
    { key: 'directoryListing', weight: 5, done: input.directoryOptIn === true },
    { key: 'bookingPage', weight: 5, done: input.bookingPageActive === true },
    { key: 'team', weight: 5, done: input.teamMemberCount > 1 },
    { key: 'servicesOne', weight: 10, done: input.serviceCount >= 1 },
    { key: 'servicesThree', weight: 5, done: input.serviceCount >= 3 },
    { key: 'designationOne', weight: 10, done: input.designationCount >= 1 },
    { key: 'designationThree', weight: 5, done: input.designationCount >= 3 },
  ];

  const score = checks.reduce((sum, c) => sum + (c.done ? c.weight : 0), 0);
  return { score, checks };
}

/** Unfinished checks, highest-weight first — the "what to do next" list. */
export function nextStrengthActions(checks: StrengthCheck[]): StrengthCheck[] {
  return checks.filter((c) => !c.done).sort((a, b) => b.weight - a.weight);
}
