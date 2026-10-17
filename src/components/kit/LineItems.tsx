export interface LineItem {
  title: string;
  detail?: string;
  amountCents: number;
}

export interface LineItemsProps {
  lines: LineItem[];
  subtotalLabel: string;
  subtotalCents: number;
  taxLabel: string;
  taxCents: number;
  totalLabel: string;
  totalCents: number;
  paidLabel?: string;
  paidCents?: number;
}

const cad = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
});

function fmt(cents: number): string {
  return cad.format(cents / 100);
}

/**
 * Invoice-style line items (mockup `.lines` + `.tot`): per-line title /
 * detail / amount, then subtotal, tax, total and an optional paid row.
 * Amounts are integer cents; numbers are wrapped in `.num`.
 */
export function LineItems({
  lines,
  subtotalLabel,
  subtotalCents,
  taxLabel,
  taxCents,
  totalLabel,
  totalCents,
  paidLabel,
  paidCents,
}: LineItemsProps) {
  return (
    <div data-kit="line-items">
      <div className="lines">
        {lines.map((line) => (
          <div
            key={line.title}
            className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-[11px] border-t border-line first:border-t-0 items-start"
          >
            <div className="min-w-0">
              <b className="block font-semibold text-ink">{line.title}</b>
              {line.detail && (
                <span className="block text-[14px] text-ink-2">
                  {line.detail}
                </span>
              )}
            </div>
            <span className="num text-[18px] font-bold text-right text-ink">
              {fmt(line.amountCents)}
            </span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 py-[11px] border-t-[1.5px] border-line-strong text-[15px]">
        <span className="text-ink-2">{subtotalLabel}</span>
        <span className="num text-right font-semibold text-ink">
          {fmt(subtotalCents)}
        </span>
        <span className="text-ink-2">{taxLabel}</span>
        <span className="num text-right font-semibold text-ink">
          {fmt(taxCents)}
        </span>
        <span className="text-[18px] font-bold text-ink">{totalLabel}</span>
        <span className="num text-[22px] font-bold text-right text-ink">
          {fmt(totalCents)}
        </span>
        {paidCents !== undefined && paidLabel && (
          <>
            <span className="text-ink-2">{paidLabel}</span>
            <span className="num text-right font-semibold text-ok">
              {fmt(paidCents)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
