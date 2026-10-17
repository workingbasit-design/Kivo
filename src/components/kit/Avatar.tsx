import { cn } from '@/lib/utils';

export type AvatarSize = 'md' | 'lg';

export interface AvatarProps {
  initials: string;
  size?: AvatarSize;
}

/** Initials circle (mockup `.av`). */
export function Avatar({ initials, size = 'md' }: AvatarProps) {
  return (
    <span
      data-kit="avatar"
      aria-hidden="true"
      className={cn(
        'rounded-full bg-surface-2 ring-1 ring-inset ring-line',
        'grid place-items-center font-bold text-ink flex-none',
        size === 'md' ? 'w-[42px] h-[42px] text-[15px]' : 'w-16 h-16 text-[22px]',
      )}
    >
      {initials}
    </span>
  );
}
