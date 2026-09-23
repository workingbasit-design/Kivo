/**
 * Infinite CSS trades marquee (server component — animation is pure CSS).
 * The list is duplicated once so the -50% translate loop is seamless.
 * Pauses on hover; disabled under prefers-reduced-motion.
 */
export default function TradesMarquee({ trades, label }: { trades: string[]; label: string }) {
  const doubled = [...trades, ...trades];
  return (
    <div className="ej-marquee overflow-hidden" role="presentation">
      <p className="sr-only">{label}</p>
      <div className="ej-marquee-track flex w-max items-center gap-10 pr-10">
        {doubled.map((trade, i) => (
          <span key={i} className="flex items-center gap-10" aria-hidden={i >= trades.length}>
            <span className="whitespace-nowrap text-[15px] font-medium text-zinc-400">{trade}</span>
            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-graphite/30" aria-hidden />
          </span>
        ))}
      </div>
    </div>
  );
}
