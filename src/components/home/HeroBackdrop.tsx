import type { CSSProperties } from 'react';

/**
 * HeroBackdrop — reel-inspired premium hero background.
 * Layered, slowly-drifting organic gradient blobs (Haikei-style) that give
 * the hero depth and motion without any image assets or JS.
 * Pure CSS animation; disabled under prefers-reduced-motion.
 *
 * NOTE: positioning lives on the outer wrapper; the animated blob is the
 * inner div, because the drift keyframes animate `transform` and would
 * override any Tailwind translate utilities on the same element.
 */
export default function HeroBackdrop() {
  const blobs: { wrapper: string; blob: string; style: CSSProperties }[] = [
    {
      wrapper: 'left-1/2 top-[-12rem] -translate-x-1/2',
      blob: 'h-[34rem] w-[54rem] bg-lime/[0.32]',
      style: { animationDuration: '26s, 19s' },
    },
    {
      wrapper: 'left-[-10rem] top-[16rem]',
      blob: 'h-[22rem] w-[22rem] bg-amber-200/[0.45]',
      style: { animationDuration: '21s, 15s', animationDelay: '-8s, -4s' },
    },
    {
      wrapper: 'right-[-9rem] top-[22rem]',
      blob: 'h-[20rem] w-[20rem] bg-sky-200/[0.5]',
      style: { animationDuration: '24s, 17s', animationDelay: '-13s, -9s' },
    },
    {
      wrapper: 'left-[38%] top-[30rem]',
      blob: 'h-[16rem] w-[26rem] bg-lime/[0.18]',
      style: { animationDuration: '29s, 22s', animationDelay: '-5s, -11s' },
    },
  ];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {blobs.map((b, i) => (
        <div key={i} className={`absolute ${b.wrapper}`}>
          <div className={`ej-blob blur-3xl ${b.blob}`} style={b.style} />
        </div>
      ))}
      {/* faint vignette so text stays crisp */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(250,250,247,0.7)_100%)]" />
    </div>
  );
}
