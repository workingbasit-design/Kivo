import EveryJobLogo from './EveryJobLogo';
import { cn } from '@/lib/utils';

/**
 * EveryJob wordmark lockup: Vector mark + "EveryJob" in 800 weight with
 * tight tracking and the signature lime full-stop.
 *
 * Contrast rule: lime is reserved for dark surfaces. On dark backgrounds the
 * wordmark is white with a lime full-stop; on light backgrounds the wordmark
 * is ink and the full-stop stays lime only when large enough to be purely
 * decorative — the readable text itself always meets contrast.
 */
export default function Logo({
  size = 32,
  tone = 'onLight',
  className,
  wordmarkClassName,
}: {
  size?: number;
  /** 'onDark' for charcoal/dark surfaces, 'onLight' for paper/white surfaces. */
  tone?: 'onDark' | 'onLight';
  className?: string;
  wordmarkClassName?: string;
}) {
  const onDark = tone === 'onDark';
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <EveryJobLogo size={size} />
      <span
        aria-label="EveryJob"
        className={cn(
          'font-extrabold leading-none tracking-[-0.03em]',
          onDark ? 'text-white' : 'text-ink',
          wordmarkClassName
        )}
        style={{ fontSize: size * 0.72 }}
      >
        EveryJob<span className="text-lime" aria-hidden="true">.</span>
      </span>
    </span>
  );
}
