export interface MarginBarProps {
  profitLabel: string;
  profitCents: number;
  marginPct: number;
  marginLabel: string;
  costLabel: string;
  barLabel: string;
}

const cad = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
});

/**
 * Profit / margin bar (mockup `.marg`): label row with profit + margin %,
 * a fill bar (clamped to 0–100), and a cost breakdown line.
 */
export function MarginBar({
  profitLabel,
  profitCents,
  marginPct,
  marginLabel,
  costLabel,
  barLabel,
}: MarginBarProps) {
  const pct = Math.min(100, Math.max(0, marginPct));

  return (
    <div data-kit="margin-bar">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold text-ink">
          {profitLabel}{' '}
          <span className="num text-[18px] font-bold">
            {cad.format(profitCents / 100)}
          </span>
        </span>
        <span className="text-[14px] font-semibold text-ink-2">
          <span className="num">{marginPct}%</span> {marginLabel}
        </span>
      </div>
      <div
        role="img"
        aria-label={barLabel}
        className="h-2.5 rounded-full bg-line overflow-hidden my-2"
      >
        <span className="block h-full bg-ok" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-[14px] font-semibold text-ink-2">{costLabel}</div>
    </div>
  );
}
