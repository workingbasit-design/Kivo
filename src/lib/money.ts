/**
 * CAD money formatting. Display only — EveryJob never processes
 * payments, so this is purely presentational.
 *
 * Accepts dollars (number) for backward compatibility.
 * For cents (BigInt), use formatCents().
 *
 * formatMoney(149, 'en') -> "$149.00"
 * formatMoney(149, 'fr') -> "149,00 $" (fr-CA style)
 */

export type CurrencyCode = 'CAD';

/** Canada-only: always CAD. Kept for call-site compatibility. */
export function normalizeCurrency(_currency: string | null | undefined): CurrencyCode {
  return 'CAD';
}

export function currencySymbol(_currency: string | null | undefined): string {
  return '$';
}

export function currencyLabel(_currency: string | null | undefined): string {
  return 'Canadian Dollar (CAD)';
}

/** Convert dollars (float) to cents (BigInt). Use for all money writes. */
export function dollarsToCents(dollars: number | null | undefined): bigint | null {
  if (dollars === null || dollars === undefined || Number.isNaN(dollars)) return null;
  return BigInt(Math.round(dollars * 100));
}

/** Convert cents (BigInt) to dollars (number). Use for calculations needing float. */
export function centsToDollars(cents: bigint | number | null | undefined): number {
  if (cents === null || undefined === cents) return 0;
  return Number(cents) / 100;
}

export function formatMoney(
  amount: number | null | undefined,
  _currency: string | null | undefined,
  locale: 'en' | 'fr' = 'en'
): string {
  const n =
    amount === null || amount === undefined || Number.isNaN(Number(amount))
      ? 0
      : Number(amount);
  // fr-CA: "1 234,56 $" (narrow no-break space, comma decimals) — the
  // standard Quebec price format.
  if (locale === 'fr') {
    return new Intl.NumberFormat('fr-CA', {
      style: 'currency',
      currency: 'CAD',
    }).format(n);
  }
  return (
    '$' +
    n.toLocaleString('en-CA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

/**
 * Format integer cents (BigInt) as CAD.
 * formatCents(14900n, 'en') -> "$149.00"
 */
export function formatCents(
  cents: bigint | number | null | undefined,
  _currency: string | null | undefined,
  locale: 'en' | 'fr' = 'en'
): string {
  const dollars = cents === null || cents === undefined ? 0 : Number(cents) / 100;
  return formatMoney(dollars, _currency, locale);
}
