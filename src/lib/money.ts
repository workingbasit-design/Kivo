/**
 * CAD money formatting. Display only — EveryJob never processes
 * payments, so this is purely presentational.
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
