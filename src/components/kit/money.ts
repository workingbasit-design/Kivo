/** Format integer cents as CAD, e.g. 12500 -> "$125.00". */

const cad = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
});

export function formatCAD(cents: number): string {
  return cad.format(cents / 100);
}
