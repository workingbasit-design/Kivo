import {
  Broom,
  Drop,
  Flame,
  AppWindow,
  Wrench,
  Lightning,
  Tree,
  Snowflake,
  PaintRoller,
  Hammer,
  type IconProps,
} from '@/components/icons';
import type { TradeKey } from '@/lib/trade-icons';

const COMPONENTS: Record<TradeKey, (props: IconProps) => React.ReactElement> = {
  cleaning: Broom,
  gutters: Drop,
  furnace: Flame,
  windows: AppWindow,
  plumbing: Wrench,
  electrical: Lightning,
  landscaping: Tree,
  snow: Snowflake,
  painting: PaintRoller,
  general: Hammer,
};

/**
 * Trade icon for a job type (Part B). One Phosphor icon per trade, rendered
 * plainly - never inside a coloured tile. `weight="duotone"` gives the
 * outline + soft fill treatment for status/active contexts.
 */
export default function TradeIcon({
  trade,
  size = 20,
  className,
  weight,
}: {
  trade: TradeKey;
  size?: number | string;
  className?: string;
  weight?: IconProps['weight'];
}) {
  const Cmp = COMPONENTS[trade] ?? Hammer;
  return <Cmp size={size} className={className} weight={weight} aria-hidden />;
}
