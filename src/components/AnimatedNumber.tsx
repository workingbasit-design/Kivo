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
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    prevRef.current = value;
    if (from === to) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(to);
      return;
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
  }, [value, duration]);

  const text = format ? format(display) : String(Math.round(display));
  return (
    <span className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {text}
    </span>
  );
}
