'use client';

/**
 * The EveryJob brand mark — layered "liquid glass" identity.
 * Same layers as public/icons/icon-source.svg (one design, every surface):
 * charcoal squircle base, glass cover sheet, lime E with a darker offset
 * depth layer, and a specular top edge light. Use everywhere the logo
 * appears (sidebar, mobile nav, auth pages, landing) so the brand stays
 * consistent. Original artwork, not an Apple asset.
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
  const eLines = (
    <>
      <line x1="24" y1="18" x2="24" y2="46" />
      <line x1="24" y1="18" x2="44" y2="18" />
      <line x1="24" y1="32" x2="40" y2="32" />
      <line x1="24" y1="46" x2="44" y2="46" />
    </>
  );
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label={label}
    >
      <defs>
        <linearGradient id="ejl-base" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#252527" />
          <stop offset="1" stopColor="#121213" />
        </linearGradient>
        <linearGradient id="ejl-lime" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d9fb6d" />
          <stop offset="1" stopColor="#b9e838" />
        </linearGradient>
        <linearGradient id="ejl-glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.32" />
          <stop offset="0.6" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <clipPath id="ejl-clip">
          <rect x="2" y="2" width="60" height="60" rx="16" />
        </clipPath>
      </defs>
      <g clipPath="url(#ejl-clip)">
        <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#ejl-base)" />
        <rect x="2" y="2" width="60" height="60" fill="url(#ejl-glass)" />
        <g
          stroke="#87ad2b"
          strokeWidth="7"
          strokeLinecap="round"
          fill="none"
          transform="translate(0,1.4)"
        >
          {eLines}
        </g>
        <g stroke="url(#ejl-lime)" strokeWidth="7" strokeLinecap="round" fill="none">
          {eLines}
        </g>
        <rect x="2" y="2" width="60" height="3" fill="#ffffff" opacity="0.18" />
      </g>
    </svg>
  );
}
