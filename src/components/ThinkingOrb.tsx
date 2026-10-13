'use client';

/**
 * ThinkingOrb - AI state indicator.
 * A breathing orb that shifts between states: thinking (lime pulse),
 * listening (expanding rings), idle (soft glow). Replaces generic spinners
 * in AI interfaces with something that feels alive.
 */
export default function ThinkingOrb({
  state = 'thinking',
  size = 32,
  className = '',
}: {
  state?: 'thinking' | 'listening' | 'idle';
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`ej-thinking-orb ej-thinking-orb--${state} ${className}`}
      style={{ width: size, height: size }}
      role="status"
      aria-label={state === 'thinking' ? 'Thinking' : state === 'listening' ? 'Listening' : 'Ready'}
    >
      <span className="ej-thinking-orb__core" />
      {state === 'listening' && <span className="ej-thinking-orb__ring" />}
    </span>
  );
}
