'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/**
 * Scroll-reveal island for the landing page. Wraps a section/block and adds
 * `.ej-reveal-visible` when it enters the viewport (once). The CSS in
 * globals.css handles the transition; prefers-reduced-motion shows content
 * immediately.
 */
export default function Reveal({
  children,
  className = '',
  delay = 0,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  /** Stagger delay in ms, applied through --ej-delay. */
  delay?: number;
  as?: 'div' | 'section' | 'li' | 'span';
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -48px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      className={`ej-reveal${visible ? ' ej-reveal-visible' : ''}${className ? ` ${className}` : ''}`}
      style={{ '--ej-delay': `${delay}ms` } as CSSProperties}
    >
      {children}
    </Tag>
  );
}
