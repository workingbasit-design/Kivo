'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { finalFrame, renderIcon, type LottieDocument } from './lottie-lite';
import bellJson from './icons/bell.json';
import calendarJson from './icons/calendar.json';
import customersJson from './icons/customers.json';
import locationJson from './icons/location.json';
import settingsJson from './icons/settings.json';
import successJson from './icons/success.json';

export type AnimatedIconName =
  | 'calendar'
  | 'bell'
  | 'success'
  | 'customers'
  | 'settings'
  | 'location';

const DATA: Record<AnimatedIconName, LottieDocument> = {
  bell: bellJson as unknown as LottieDocument,
  calendar: calendarJson as unknown as LottieDocument,
  customers: customersJson as unknown as LottieDocument,
  location: locationJson as unknown as LottieDocument,
  settings: settingsJson as unknown as LottieDocument,
  success: successJson as unknown as LottieDocument,
};

export function isAnimatedIconName(v: string): v is AnimatedIconName {
  return v in DATA;
}

/**
 * Dependency-free animated icon (MIT-licensed Lottie assets, rendered via
 * lottie-lite — no lottie-react / lottie-web, $0).
 *
 * Plays once on mount, replays on hover/focus. Respects
 * prefers-reduced-motion by rendering the final frame statically.
 * Black strokes follow `currentColor`; the bell's white detail stays white.
 */
export function AnimatedIcon({
  name,
  size = 24,
  className,
  style,
  label,
}: {
  name: AnimatedIconName;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  /** Accessible label; defaults to the icon name. */
  label?: string;
}) {
  const doc = DATA[name];
  const [frame, setFrame] = useState<number>(() => finalFrame(doc));
  const [reducedMotion, setReducedMotion] = useState<boolean>(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const rafRef = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const play = useCallback(() => {
    // Reduced motion: the render below shows the final frame; nothing to play.
    if (reducedMotion) return;
    cancelAnimationFrame(rafRef.current);
    const dur = Math.max(1, ((doc.op - doc.ip) / doc.fr) * 1000);
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      setFrame(doc.ip + p * (doc.op - doc.ip) - 0.001 * p);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [doc, reducedMotion]);

  useEffect(() => {
    const id = requestAnimationFrame(() => play());
    return () => {
      cancelAnimationFrame(id);
      cancelAnimationFrame(rafRef.current);
    };
  }, [play]);

  const displayFrame = reducedMotion ? finalFrame(doc) : frame;
  const model = useMemo(() => renderIcon(doc, displayFrame), [doc, displayFrame]);

  return (
    <svg
      viewBox={`0 0 ${model.width} ${model.height}`}
      width={size}
      height={size}
      className={className}
      style={style}
      role="img"
      aria-label={label ?? name}
      onMouseEnter={play}
      onFocus={play}
    >
      {model.paths.map((p, i) => (
        <path
          key={`${name}-${i}`}
          d={p.d}
          transform={p.transform || undefined}
          fill="none"
          stroke={p.stroke}
          strokeWidth={p.strokeWidth}
          strokeLinecap={p.linecap}
          strokeLinejoin={p.linejoin}
          opacity={p.opacity}
          strokeDasharray={p.dashArray}
          strokeDashoffset={p.dashOffset}
        />
      ))}
    </svg>
  );
}
