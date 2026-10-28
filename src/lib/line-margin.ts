/**
 * Slice 3 (2026-10-28): per-line margin math for quote/invoice lines.
 * Pure, integer-cent math — no imports, no I/O — so unit tests can import
 * it under plain node --test and detail pages can compute display values
 * without a server round-trip.
 *
 * The one rule that matters: null cost means UNKNOWN, never $0. A line
 * with no cost is excluded from every margin figure, and a document
 * margin is always over costed lines only (margin % on costed revenue —
 * mixing in uncosted revenue would understate the margin and lie about
 * its base). Callers label partial coverage ("on N of M lines").
 */

export interface LineMarginInput {
  qty: number;
  /** Selling price per unit, integer cents. */
  unitPriceCents: number | bigint;
  /** Owner's cost per unit, integer cents, or null when unknown. */
  unitCostCents: number | bigint | null;
}

export interface LineMargin {
  revenueCents: number;
  costCents: number;
  marginCents: number;
  /** Percent, or null when costed revenue is 0 — never divide by zero. */
  marginPct: number | null;
}

const toNum = (v: number | bigint): number =>
  typeof v === 'bigint' ? Number(v) : v;

/** Margin for one line, or null when its cost is unknown. */
export function lineMargin(input: LineMarginInput): LineMargin | null {
  if (input.unitCostCents == null) return null;
  const qty =
    typeof input.qty === 'number' && Number.isFinite(input.qty) ? input.qty : 0;
  const revenueCents = Math.round(qty * toNum(input.unitPriceCents));
  const costCents = Math.round(qty * toNum(input.unitCostCents));
  const marginCents = revenueCents - costCents;
  return {
    revenueCents,
    costCents,
    marginCents,
    marginPct: revenueCents > 0 ? (marginCents / revenueCents) * 100 : null,
  };
}

export interface LineMarginSummary {
  /** Revenue across ALL lines (display context). */
  totalRevenueCents: number;
  /** Revenue across costed lines only — the margin % base. */
  costedRevenueCents: number;
  costCents: number;
  marginCents: number;
  /** Percent on costed revenue, or null when no costed revenue exists. */
  marginPct: number | null;
  costedLines: number;
  totalLines: number;
}

/** Document margin over costed lines only; see the module rule above. */
export function summarizeLineMargins(lines: LineMarginInput[]): LineMarginSummary {
  let totalRevenueCents = 0;
  let costedRevenueCents = 0;
  let costCents = 0;
  let costedLines = 0;
  for (const line of lines) {
    const qty =
      typeof line.qty === 'number' && Number.isFinite(line.qty) ? line.qty : 0;
    totalRevenueCents += Math.round(qty * toNum(line.unitPriceCents));
    const m = lineMargin(line);
    if (m) {
      costedLines += 1;
      costedRevenueCents += m.revenueCents;
      costCents += m.costCents;
    }
  }
  const marginCents = costedRevenueCents - costCents;
  return {
    totalRevenueCents,
    costedRevenueCents,
    costCents,
    marginCents,
    marginPct:
      costedRevenueCents > 0 ? (marginCents / costedRevenueCents) * 100 : null,
    costedLines,
    totalLines: lines.length,
  };
}
