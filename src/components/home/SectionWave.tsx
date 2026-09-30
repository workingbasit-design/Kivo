/**
 * SectionWave — Haikei-style organic wave divider.
 * Renders a smooth SVG wave filled with `fillClass` that sits on the
 * boundary between two sections. Pass flip to mirror it vertically.
 */
export default function SectionWave({
  fillClass,
  flip = false,
  label,
}: {
  fillClass: string;
  flip?: boolean;
  label: string;
}) {
  return (
    <div aria-hidden className={`relative ${flip ? 'rotate-180' : ''}`}>
      <span className="sr-only">{label}</span>
      <svg
        viewBox="0 0 1440 90"
        preserveAspectRatio="none"
        className={`block h-[54px] w-full md:h-[84px] ${fillClass}`}
      >
        <path
          fill="currentColor"
          d="M0,52 C200,92 420,8 720,34 C1020,60 1220,88 1440,44 L1440,90 L0,90 Z"
        />
      </svg>
    </div>
  );
}
