/**
 * Currency-aware money formatting. Display only — Kivo never processes
 * payments, so this is purely presentational.
 *
 * formatMoney(1499, 'INR') -> "₹1,499"
 * formatMoney(149, 'CAD')  -> "$149.00"
 */

export type CurrencyCode = 'INR' | 'CAD';

export function normalizeCurrency(currency: string | null | undefined): CurrencyCode {
  return (currency || 'INR').toUpperCase() === 'CAD' ? 'CAD' : 'INR';
}

export function currencySymbol(currency: string | null | undefined): string {
  return normalizeCurrency(currency) === 'CAD' ? '$' : '₹';
}

export function currencyLabel(currency: string | null | undefined): string {
  return normalizeCurrency(currency) === 'CAD'
    ? 'Canadian Dollar (CAD)'
    : 'Indian Rupee (INR)';
}

export function formatMoney(
  amount: number | null | undefined,
  currency: string | null | undefined
): string {
  const n =
    amount === null || amount === undefined || Number.isNaN(Number(amount))
      ? 0
      : Number(amount);
  if (normalizeCurrency(currency) === 'CAD') {
    return (
      '$' +
      n.toLocaleString('en-CA', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }
  return (
    '₹' +
    n.toLocaleString('en-IN', {
      maximumFractionDigits: 2,
    })
  );
}
