'use client';

import { useId } from 'react';

/**
 * The Kivo brand mark — Apple-style gradient tile with a twin-sparkle glyph.
 * Use everywhere the logo appears (sidebar, mobile nav, auth pages, landing)
 * so the brand stays consistent.
 */
export default function KivoLogo({
  size = 32,
  className,
  label = 'Kivo',
}: {
  size?: number;
  className?: string;
  label?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const bgId = `kivo-bg-${uid}`;
  const glossId = `kivo-gloss-${uid}`;

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
        <linearGradient id={bgId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8B5CF6" />
          <stop offset="0.55" stopColor="#6D28D9" />
          <stop offset="1" stopColor="#4C1D95" />
        </linearGradient>
        <linearGradient id={glossId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.32" />
          <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="62" height="62" rx="15" fill={`url(#${bgId})`} />
      <rect x="1" y="1" width="62" height="62" rx="15" fill={`url(#glossId)`} />
      <path
        d="M32 13.5 C33.75 26 38 30.25 50.5 32 C38 33.75 33.75 38 32 50.5 C30.25 38 26 33.75 13.5 32 C26 30.25 30.25 26 32 13.5 Z"
        fill="#FFFFFF"
      />
      <path
        d="M46 16 C46.5 19 47.5 20 50.5 20.5 C47.5 21 46.5 22 46 25 C45.5 22 44.5 21 41.5 20.5 C44.5 20 45.5 19 46 16 Z"
        fill="#FFFFFF"
        opacity="0.92"
      />
    </svg>
  );
}
