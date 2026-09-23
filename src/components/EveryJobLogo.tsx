'use client';

/**
 * The EveryJob brand mark — Vector identity.
 * Charcoal rounded-square tile with lime E-bars (vertical stem + three
 * horizontal bars, round caps). Use everywhere the logo appears (sidebar,
 * mobile nav, auth pages, landing) so the brand stays consistent.
 */
export default function EveryJobLogo({
  size = 32,
  className,
  label = 'EveryJob',
}: {
  size?: number;
  className?: string;
  label?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label={label}
    >
      <rect x="2" y="2" width="60" height="60" rx="16" fill="#161616" />
      <g stroke="#C8F04A" strokeWidth="7" strokeLinecap="round">
        <line x1="24" y1="18" x2="24" y2="46" />
        <line x1="24" y1="18" x2="44" y2="18" />
        <line x1="24" y1="32" x2="40" y2="32" />
        <line x1="24" y1="46" x2="44" y2="46" />
      </g>
    </svg>
  );
}
