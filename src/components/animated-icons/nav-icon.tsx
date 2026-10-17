import type { LucideIcon } from 'lucide-react';
import { AnimatedIcon, type AnimatedIconName } from './AnimatedIcon';

/** A nav icon is either a Lucide component or a free animated icon name. */
export type NavIcon = LucideIcon | AnimatedIconName;

export function NavIconView({
  icon,
  size = 20,
  className,
  filled = false,
}: {
  icon: NavIcon;
  size?: number;
  className?: string;
  /** Filled variant for active states (Part D: active tab shows filled icon). */
  filled?: boolean;
}) {
  if (typeof icon === 'string') {
    return <AnimatedIcon name={icon} size={size} className={className} />;
  }
  const Cmp = icon as LucideIcon;
  return <Cmp size={size} strokeWidth={2} className={className} fill={filled ? 'currentColor' : 'none'} />;
}

export { AnimatedIcon, type AnimatedIconName };
