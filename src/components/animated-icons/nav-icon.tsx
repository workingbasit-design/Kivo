import type { IconComponent } from '@/components/icons';
import { AnimatedIcon, type AnimatedIconName } from './AnimatedIcon';

/** A nav icon is either an icon component or a free animated icon name. */
export type NavIcon = IconComponent | AnimatedIconName;

export function NavIconView({
  icon,
  size = 20,
  className,
  filled = false,
}: {
  icon: NavIcon;
  size?: number;
  className?: string;
  /** Duotone (outline + soft fill) variant for active states. */
  filled?: boolean;
}) {
  if (typeof icon === 'string') {
    return <AnimatedIcon name={icon} size={size} className={className} />;
  }
  const Cmp = icon as IconComponent;
  return (
    <Cmp
      size={size}
      strokeWidth={2}
      className={className}
      weight={filled ? 'duotone' : 'regular'}
    />
  );
}

export { AnimatedIcon, type AnimatedIconName };
