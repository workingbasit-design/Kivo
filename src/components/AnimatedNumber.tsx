'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * AnimatedNumber — odometer-style rolling number.
 * Animates from the previous value to the new value with an ease-out curve.
 * Respects prefers-reduced-motion (jumps to final value).
 */
export default function AnimatedNumber({
  value,
  format,
  duration = 800,
  className,
}: {
  /** Numeric target value */
  value: number;
  /** Format the displayed number, e.g. (n) => `$${n.toFixed(2)}` */
  format?: (n: number) => string;
  /** Animation duration in ms */
  duration?: number;
  className?: string;
}) {
  // Guard against undefined/null/NaN from server stats — render fallback.
  const safeValue = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  const [display, setDisplay] = useState(safeValue);
  const prevRef = useRef(safeValue);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = prevRef.current;
    const to = safeValue;
    prevRef.current = to;
    if (from === to) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // No animation: jump to the final value on the next frame.
      // Scheduled (not synchronous) so react-hooks/set-state-in-effect holds.
      rafRef.current = requestAnimationFrame(() => setDisplay(to));
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      // easeOutExpo
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setDisplay(from + (to - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [safeValue, duration]);

  const text = format ? format(display) : String(Math.round(display));
  return (
    <span className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {text}
    </span>
  );
}
