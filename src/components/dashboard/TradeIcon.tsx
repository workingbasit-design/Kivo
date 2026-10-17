/**
 * Part C (dashboard rebuild): render a trade icon by Phosphor component
 * name (see src/lib/trade-icons.ts TRADE_ICON_COMPONENTS). Icons render
 * from the single Phosphor family - never inside coloured tiles.
 */
import * as Icons from "@/components/icons";

const byName = Icons as unknown as Record<string, Icons.IconComponent | undefined>;

export default function TradeIcon({
  name,
  size = 18,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const Cmp = byName[name] ?? byName["Hammer"];
  if (!Cmp) return null;
  return <Cmp size={size} className={className} aria-hidden />;
}
